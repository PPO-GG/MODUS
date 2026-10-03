import { describe, expect, it } from "vitest";
import type { SuggestionRow } from "@modus/db";
import { buildSuggestionMessage, embedInputFromRow, voteCustomId, type SuggestionEmbedInput } from "./embed";
import { STATUS_META } from "./status";

const input = (over: Partial<SuggestionEmbedInput> = {}): SuggestionEmbedInput => ({
  id: "sug-1",
  number: 12,
  title: "Add a movie night",
  body: "Let's watch movies on Fridays.",
  authorId: "u1",
  status: "pending",
  statusReason: null,
  reviewedBy: null,
  up: 4,
  down: 1,
  votingLocked: false,
  createdAtMs: Date.parse("2026-10-02T12:00:00Z"),
  ...over,
});

describe("voteCustomId", () => {
  it("encodes the module, action, suggestion id and direction", () => {
    expect(voteCustomId("abc", "up")).toBe("suggestions:vote:abc:up");
    expect(voteCustomId("abc", "down")).toBe("suggestions:vote:abc:down");
  });
});

describe("buildSuggestionMessage", () => {
  it("renders number, title, body, author and a pending status", () => {
    const { embeds } = buildSuggestionMessage(input());
    const embed = embeds[0]!;
    expect(embed.title).toBe("#12 Add a movie night");
    expect(embed.description).toBe("Let's watch movies on Fridays.");
    expect(embed.color).toBe(STATUS_META.pending.color);
    expect(embed.timestamp).toBe("2026-10-02T12:00:00.000Z");
    expect(embed.fields).toEqual([
      { name: "Submitted by", value: "<@u1>", inline: true },
      { name: "Status", value: "🕓 **Pending**", inline: true },
    ]);
  });

  it("shows reviewer and reason once a decision exists, in the status colour", () => {
    const embed = buildSuggestionMessage(
      input({ status: "approved", reviewedBy: "mod1", statusReason: "Sounds fun" }),
    ).embeds[0]!;
    expect(embed.color).toBe(STATUS_META.approved.color);
    expect(embed.fields).toEqual([
      { name: "Submitted by", value: "<@u1>", inline: true },
      { name: "Status", value: "✅ **Approved** — <@mod1>", inline: true },
      { name: "Reason", value: "Sounds fun", inline: false },
    ]);
  });

  it("renders two vote buttons with live counts that carry the vote custom ids", () => {
    const { components } = buildSuggestionMessage(input());
    expect(components).toEqual([
      {
        type: 1,
        components: [
          { type: 2, style: 2, custom_id: "suggestions:vote:sug-1:up", label: "▲ 4", disabled: false },
          { type: 2, style: 2, custom_id: "suggestions:vote:sug-1:down", label: "▼ 1", disabled: false },
        ],
      },
    ]);
  });

  it("disables the vote buttons when voting is locked", () => {
    const row = buildSuggestionMessage(input({ votingLocked: true })).components[0]!;
    expect(row.components.every((b) => (b as { disabled: boolean }).disabled)).toBe(true);
  });

  it("stays within Discord's limits for maximum-length input", () => {
    const { embeds } = buildSuggestionMessage(
      input({
        title: "t".repeat(100),
        body: "b".repeat(1500),
        statusReason: "r".repeat(500),
        status: "denied",
        reviewedBy: "mod1",
      }),
    );
    const embed = embeds[0]!;
    expect(embed.title!.length).toBeLessThanOrEqual(256);
    expect(embed.description!.length).toBeLessThanOrEqual(4000);
    for (const field of embed.fields!) expect(field.value.length).toBeLessThanOrEqual(1024);
  });

  it("truncates oversize fields instead of exceeding the limits", () => {
    const embed = buildSuggestionMessage(
      input({ title: "t".repeat(400), body: "b".repeat(9000), statusReason: "r".repeat(3000) }),
    ).embeds[0]!;
    expect(embed.title!.length).toBe(256);
    expect(embed.description!.length).toBe(4000);
    expect(embed.fields!.find((f) => f.name === "Reason")!.value.length).toBe(1024);
  });
});

describe("embedInputFromRow", () => {
  const row = (over: Partial<SuggestionRow> = {}): SuggestionRow => ({
    id: "sug-1",
    guildId: "g1",
    number: 3,
    authorId: "u1",
    title: "T",
    body: "B",
    status: "denied",
    statusReason: "no",
    reviewedBy: "mod1",
    reviewedAt: new Date(),
    channelId: "c1",
    messageId: "m1",
    threadId: null,
    createdAt: new Date("2026-10-02T12:00:00Z"),
    ...over,
  });

  it("maps a row and tally, locking voting for a denied suggestion when configured", () => {
    expect(embedInputFromRow(row(), { up: 2, down: 5 }, true)).toEqual({
      id: "sug-1",
      number: 3,
      title: "T",
      body: "B",
      authorId: "u1",
      status: "denied",
      statusReason: "no",
      reviewedBy: "mod1",
      up: 2,
      down: 5,
      votingLocked: true,
      createdAtMs: Date.parse("2026-10-02T12:00:00Z"),
    });
  });

  it("leaves voting open for a denied suggestion when closeVotingOnDecision is off", () => {
    expect(embedInputFromRow(row(), { up: 0, down: 0 }, false).votingLocked).toBe(false);
  });
});
