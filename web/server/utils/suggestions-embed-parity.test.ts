import { describe, expect, it } from "vitest";
import { buildSuggestionMessage as botBuild } from "../../../bot/modules/suggestions/embed";
import { buildSuggestionMessage as webBuild } from "../api/suggestions/_embed";
import {
  isVotingLocked as botIsVotingLocked,
  STATUS_META as BOT_STATUS_META,
} from "../../../bot/modules/suggestions/status";
import {
  isVotingLocked as webIsVotingLocked,
  STATUS_META as WEB_STATUS_META,
} from "../api/suggestions/_embed";

const STATUSES = ["pending", "considering", "approved", "denied", "implemented", "withdrawn"] as const;

describe("suggestion embed parity (bot ↔ web copy)", () => {
  it("renders identically for every status, lock state, and optional field combination", () => {
    for (const status of STATUSES) {
      for (const votingLocked of [false, true]) {
        for (const withReview of [false, true]) {
          const input = {
            id: "sug-1",
            number: 42,
            title: "Add a movie night",
            body: "Let's watch movies on Fridays.",
            authorId: "u1",
            status,
            statusReason: withReview ? "Because reasons" : null,
            reviewedBy: withReview ? "mod1" : null,
            up: 7,
            down: 3,
            votingLocked,
            createdAtMs: Date.parse("2026-10-02T12:00:00Z"),
          };
          expect(webBuild(input)).toEqual(botBuild(input));
        }
      }
    }
  });

  it("renders identically for oversize input (truncation behaves the same)", () => {
    const input = {
      id: "sug-2",
      number: 1,
      title: "t".repeat(400),
      body: "b".repeat(9000),
      authorId: "u1",
      status: "denied" as const,
      statusReason: "r".repeat(3000),
      reviewedBy: "mod1",
      up: 0,
      down: 0,
      votingLocked: true,
      createdAtMs: 0,
    };
    expect(webBuild(input)).toEqual(botBuild(input));
  });

  it("isVotingLocked and STATUS_META match bot behavior exactly", () => {
    // Test STATUS_META constants
    expect(WEB_STATUS_META).toEqual(BOT_STATUS_META);

    // Test isVotingLocked for all statuses and flag combinations
    for (const status of STATUSES) {
      for (const closeVotingOnDecision of [false, true]) {
        const webResult = webIsVotingLocked(status, closeVotingOnDecision);
        const botResult = botIsVotingLocked(status, closeVotingOnDecision);
        expect(webResult).toBe(botResult);
      }
    }
  });
});
