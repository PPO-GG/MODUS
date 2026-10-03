import { describe, expect, it, vi } from "vitest";
import type { SuggestionRow } from "@modus/db";
import { applyReview, type ReviewDeps } from "./review";

const row = (over: Partial<SuggestionRow> = {}): SuggestionRow => ({
  id: "sug-1",
  guildId: "g1",
  number: 7,
  authorId: "author",
  title: "T",
  body: "B",
  status: "pending",
  statusReason: null,
  reviewedBy: null,
  reviewedAt: null,
  channelId: "c1",
  messageId: "m1",
  threadId: "t1",
  createdAt: new Date("2026-10-02T12:00:00Z"),
  ...over,
});

function makeDeps(over: Partial<ReviewDeps> = {}) {
  const deps = {
    suggestions: {
      setStatus: vi.fn(async (_id: string, change: { status: any; reason: string | null; reviewedBy: string }) =>
        row({ status: change.status, statusReason: change.reason, reviewedBy: change.reviewedBy, reviewedAt: new Date() }),
      ),
      markWithdrawn: vi.fn(async () => undefined),
    },
    votes: { tally: vi.fn(async () => ({ up: 5, down: 2 })) },
    editMessage: vi.fn(async () => "ok" as const),
    postThreadNote: vi.fn(async () => undefined),
    ...over,
  };
  return deps;
}

const review = {
  status: "approved" as const,
  reason: "Sounds good" as string | null,
  reviewerId: "mod1",
  closeVotingOnDecision: true,
};

describe("applyReview", () => {
  it("writes the status, re-renders the embed with live counts, and notes the thread", async () => {
    const deps = makeDeps();
    const result = await applyReview(deps, row(), review);
    expect(deps.suggestions.setStatus).toHaveBeenCalledWith("sug-1", {
      status: "approved",
      reason: "Sounds good",
      reviewedBy: "mod1",
    });
    const [, payload] = deps.editMessage.mock.calls[0] as unknown as [SuggestionRow, any];
    const embed = payload.embeds[0];
    expect(embed.fields.find((f: any) => f.name === "Status").value).toBe("✅ **Approved** — <@mod1>");
    expect(embed.fields.find((f: any) => f.name === "Reason").value).toBe("Sounds good");
    expect(payload.components[0].components[0].label).toBe("▲ 5");
    expect(payload.components[0].components[0].disabled).toBe(false);
    expect(deps.postThreadNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sug-1" }),
      "Marked **Approved** by <@mod1>: Sounds good",
    );
    expect(result).toMatchObject({ ok: true, embedUpdated: true, withdrawn: false });
  });

  it("locks the vote buttons when a denial closes voting", async () => {
    const deps = makeDeps();
    await applyReview(deps, row(), { ...review, status: "denied" });
    const [, payload] = deps.editMessage.mock.calls[0] as unknown as [SuggestionRow, any];
    expect(payload.components[0].components.every((b: any) => b.disabled)).toBe(true);
  });

  it("omits the reason from the thread note when there is none", async () => {
    const deps = makeDeps();
    await applyReview(deps, row(), { ...review, reason: null });
    expect(deps.postThreadNote).toHaveBeenCalledWith(expect.anything(), "Marked **Approved** by <@mod1>");
  });

  it("rejects reviewing a withdrawn suggestion without writing anything", async () => {
    const deps = makeDeps();
    const result = await applyReview(deps, row({ status: "withdrawn" }), review);
    expect(result).toEqual({ ok: false, reason: "withdrawn" });
    expect(deps.suggestions.setStatus).not.toHaveBeenCalled();
  });

  it("marks the suggestion withdrawn when its message was deleted, reports it, and posts no thread note", async () => {
    const deps = makeDeps({ editMessage: vi.fn(async () => "missing" as const) });
    const result = await applyReview(deps, row(), review);
    expect(deps.suggestions.markWithdrawn).toHaveBeenCalledWith("sug-1");
    expect(result).toMatchObject({ ok: true, embedUpdated: false, withdrawn: true });
    expect(deps.postThreadNote).not.toHaveBeenCalled();
  });

  it("keeps the new status and reports embedUpdated=false when the edit fails for another reason", async () => {
    const deps = makeDeps({
      editMessage: vi.fn(async () => {
        throw new Error("Missing Permissions");
      }),
    });
    const result = await applyReview(deps, row(), review);
    expect(deps.suggestions.markWithdrawn).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, embedUpdated: false, withdrawn: false });
  });

  it("does not let a failing thread note fail the review", async () => {
    const deps = makeDeps({
      postThreadNote: vi.fn(async () => {
        throw new Error("thread archived");
      }),
    });
    const result = await applyReview(deps, row(), review);
    expect(result).toMatchObject({ ok: true, embedUpdated: true, withdrawn: false });
  });

  it("skips the thread note when the suggestion has no thread", async () => {
    const deps = makeDeps();
    deps.suggestions.setStatus = vi.fn(async () => row({ status: "approved", threadId: null }));
    await applyReview(deps, row({ threadId: null }), review);
    expect(deps.postThreadNote).not.toHaveBeenCalled();
  });

  it("returns withdrawn when setStatus returns null due to a race with deletion", async () => {
    const deps = makeDeps({
      suggestions: {
        setStatus: vi.fn(async () => null),
        markWithdrawn: vi.fn(async () => undefined),
      },
      votes: { tally: vi.fn(async () => ({ up: 5, down: 2 })) },
      editMessage: vi.fn(async () => "ok" as const),
      postThreadNote: vi.fn(async () => undefined),
    });
    const result = await applyReview(deps, row(), review);
    expect(result).toEqual({ ok: false, reason: "withdrawn" });
    expect(deps.votes.tally).not.toHaveBeenCalled();
    expect(deps.editMessage).not.toHaveBeenCalled();
    expect(deps.postThreadNote).not.toHaveBeenCalled();
  });
});
