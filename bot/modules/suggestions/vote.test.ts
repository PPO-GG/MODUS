import { describe, expect, it, vi } from "vitest";
import type { SuggestionRow } from "@modus/db";
import { castVote, type VoteDeps } from "./vote";

const row = (over: Partial<SuggestionRow> = {}): SuggestionRow => ({
  id: "sug-1",
  guildId: "g1",
  number: 1,
  authorId: "author",
  title: "T",
  body: "B",
  status: "pending",
  statusReason: null,
  reviewedBy: null,
  reviewedAt: null,
  channelId: "c1",
  messageId: "m1",
  threadId: null,
  createdAt: new Date("2026-10-02T12:00:00Z"),
  ...over,
});

function makeDeps(suggestion: SuggestionRow | null) {
  const deps = {
    suggestions: { getById: vi.fn(async () => suggestion) },
    votes: {
      toggle: vi.fn(async () => "added" as const),
      tally: vi.fn(async () => ({ up: 3, down: 1 })),
    },
  };
  return deps satisfies VoteDeps;
}

const vote = { suggestionId: "sug-1", userId: "voter", direction: "up" as const, closeVotingOnDecision: true, guildId: "g1" };

describe("castVote", () => {
  it("records the vote and returns the recounted tally for an in-place update", async () => {
    const deps = makeDeps(row());
    const outcome = await castVote(deps, vote);
    expect(deps.votes.toggle).toHaveBeenCalledWith("sug-1", "voter", "up");
    expect(outcome).toEqual({ kind: "update", suggestion: row(), tally: { up: 3, down: 1 } });
  });

  it("returns the suggestion re-read after the tally so a concurrent review is not overwritten", async () => {
    const before = row();
    const after = row({ status: "approved", statusReason: "Done", reviewedBy: "mod1" });
    const deps = makeDeps(before);
    deps.suggestions.getById = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    const outcome = await castVote(deps, { ...vote, closeVotingOnDecision: false });
    expect(deps.suggestions.getById).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ kind: "update", suggestion: after, tally: { up: 3, down: 1 } });
  });

  it("falls back to the earlier row when the re-read finds nothing", async () => {
    const before = row();
    const deps = makeDeps(before);
    deps.suggestions.getById = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(null);
    const outcome = await castVote(deps, vote);
    expect(outcome).toEqual({ kind: "update", suggestion: before, tally: { up: 3, down: 1 } });
  });

  it("replies ephemerally and writes nothing for a missing suggestion", async () => {
    const deps = makeDeps(null);
    const outcome = await castVote(deps, vote);
    expect(outcome).toEqual({ kind: "reply", content: "This suggestion is no longer available." });
    expect(deps.votes.toggle).not.toHaveBeenCalled();
  });

  it("replies and writes nothing for a withdrawn suggestion", async () => {
    const deps = makeDeps(row({ status: "withdrawn" }));
    const outcome = await castVote(deps, vote);
    expect(outcome.kind).toBe("reply");
    expect(deps.votes.toggle).not.toHaveBeenCalled();
  });

  it("replies and writes nothing for a suggestion from another guild", async () => {
    const deps = makeDeps(row());
    const outcome = await castVote(deps, { ...vote, guildId: "other" });
    expect(outcome).toEqual({ kind: "reply", content: "This suggestion is no longer available." });
    expect(deps.votes.toggle).not.toHaveBeenCalled();
    expect(deps.votes.tally).not.toHaveBeenCalled();
  });

  it("refuses the author's own vote", async () => {
    const deps = makeDeps(row());
    const outcome = await castVote(deps, { ...vote, userId: "author" });
    expect(outcome).toEqual({ kind: "reply", content: "You can't vote on your own suggestion." });
    expect(deps.votes.toggle).not.toHaveBeenCalled();
  });

  it("refuses votes once a decision locked voting", async () => {
    const deps = makeDeps(row({ status: "denied" }));
    const outcome = await castVote(deps, vote);
    expect(outcome).toEqual({ kind: "reply", content: "Voting is closed for this suggestion." });
    expect(deps.votes.toggle).not.toHaveBeenCalled();
  });

  it("still accepts votes on a denied suggestion when closeVotingOnDecision is off", async () => {
    const deps = makeDeps(row({ status: "denied" }));
    const outcome = await castVote(deps, { ...vote, closeVotingOnDecision: false });
    expect(outcome.kind).toBe("update");
  });
});
