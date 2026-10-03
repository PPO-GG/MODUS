import { describe, expect, it } from "vitest";
import type { StarboardBoard } from "../../lib/schemas";
import { decide, isEligibleChannel, isLeakToPublicBoard, type ExistingPost } from "./evaluate";

const posted = (over: Partial<ExistingPost> = {}): ExistingPost => ({
  id: "p1",
  boardMessageId: "bm1",
  starCount: 3,
  ...over,
});

describe("decide", () => {
  const base = { threshold: 3, deleteBelowThreshold: false };

  it("does nothing below threshold when nothing was posted", () => {
    expect(decide({ ...base, count: 2, existing: null })).toEqual({ type: "noop" });
    expect(decide({ ...base, count: 0, existing: null })).toEqual({ type: "noop" });
  });

  it("creates when the threshold is reached with no post", () => {
    expect(decide({ ...base, count: 3, existing: null })).toEqual({ type: "create" });
  });

  it("reposts when the row exists but the board message was deleted by hand", () => {
    expect(decide({ ...base, count: 4, existing: posted({ boardMessageId: null }) })).toEqual({
      type: "create",
    });
  });

  it("is a noop when the count is unchanged and updates when it changes", () => {
    expect(decide({ ...base, count: 3, existing: posted() })).toEqual({ type: "noop" });
    expect(decide({ ...base, count: 5, existing: posted() })).toEqual({ type: "update" });
  });

  it("deletes below threshold when deleteBelowThreshold is on", () => {
    expect(
      decide({ ...base, deleteBelowThreshold: true, count: 2, existing: posted() }),
    ).toEqual({ type: "delete" });
  });

  it("keeps the post and updates the count below threshold when deleteBelowThreshold is off", () => {
    expect(decide({ ...base, count: 2, existing: posted() })).toEqual({ type: "update" });
    expect(decide({ ...base, count: 0, existing: posted({ starCount: 0 }) })).toEqual({
      type: "noop",
    });
  });

  it("drops a row with no board message once it falls below threshold", () => {
    expect(decide({ ...base, count: 1, existing: posted({ boardMessageId: null }) })).toEqual({
      type: "delete",
    });
  });
});

describe("isEligibleChannel", () => {
  const board = (over: Partial<StarboardBoard> = {}): StarboardBoard => ({
    id: "b1",
    name: "S",
    enabled: true,
    emoji: "⭐",
    threshold: 3,
    channelId: "board-chan",
    ignoredChannelIds: ["ignored"],
    deleteBelowThreshold: false,
    ...over,
  });
  const channel = (over: Partial<{ id: string; parentId: string | null; nsfw: boolean }> = {}) => ({
    id: "general",
    parentId: null,
    nsfw: false,
    ...over,
  });
  const boardChannels = new Set(["board-chan", "other-board-chan"]);

  it("accepts an ordinary channel", () => {
    expect(isEligibleChannel(board(), channel(), boardChannels)).toBe(true);
  });

  it("rejects NSFW channels", () => {
    expect(isEligibleChannel(board(), channel({ nsfw: true }), boardChannels)).toBe(false);
  });

  it("rejects ignored channels", () => {
    expect(isEligibleChannel(board(), channel({ id: "ignored" }), boardChannels)).toBe(false);
  });

  it("rejects a thread whose parent channel is ignored", () => {
    expect(
      isEligibleChannel(board(), channel({ id: "thread-1", parentId: "ignored" }), boardChannels),
    ).toBe(false);
  });

  it("rejects a thread whose NSFW parent was resolved by the caller as nsfw", () => {
    expect(
      isEligibleChannel(board(), channel({ id: "thread-2", parentId: "general", nsfw: true }), boardChannels),
    ).toBe(false);
  });

  it("rejects messages inside any board channel (no starring the board post)", () => {
    expect(isEligibleChannel(board(), channel({ id: "board-chan" }), boardChannels)).toBe(false);
    expect(isEligibleChannel(board(), channel({ id: "other-board-chan" }), boardChannels)).toBe(false);
  });

  it("rejects a thread started on a board post (its parent is a board channel)", () => {
    expect(
      isEligibleChannel(board(), channel({ id: "thread-3", parentId: "other-board-chan" }), boardChannels),
    ).toBe(false);
  });
});

describe("isLeakToPublicBoard", () => {
  it("only flags a private source mirrored into a public board", () => {
    expect(isLeakToPublicBoard(false, true)).toBe(true);
    expect(isLeakToPublicBoard(false, false)).toBe(false);
    expect(isLeakToPublicBoard(true, true)).toBe(false);
    expect(isLeakToPublicBoard(true, false)).toBe(false);
  });
});
