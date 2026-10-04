import { describe, expect, it, vi } from "vitest";
import type { StarboardBoard } from "../../lib/schemas";
import {
  hasImage,
  isSeedCandidate,
  planReactions,
  seedReactions,
  type AutoReactMessage,
} from "./autoreact";

const msg = (over: Partial<AutoReactMessage> = {}): AutoReactMessage => ({
  guildId: "g1",
  authorBot: false,
  system: false,
  content: "",
  attachments: [],
  ...over,
});

describe("hasImage", () => {
  it("accepts an image attachment, whatever the subtype", () => {
    expect(hasImage(msg({ attachments: [{ contentType: "image/png" }] }))).toBe(true);
    expect(hasImage(msg({ attachments: [{ contentType: "image/gif" }] }))).toBe(true);
    expect(hasImage(msg({ attachments: [{ contentType: "IMAGE/WEBP" }] }))).toBe(true);
  });

  it("rejects non-image attachments and attachments with no content type", () => {
    expect(hasImage(msg({ attachments: [{ contentType: "video/mp4" }] }))).toBe(false);
    expect(hasImage(msg({ attachments: [{ contentType: "application/pdf" }] }))).toBe(false);
    expect(hasImage(msg({ attachments: [{ contentType: null }] }))).toBe(false);
  });

  it("accepts a link whose path ends in an image extension", () => {
    for (const ext of ["png", "jpg", "jpeg", "gif", "webp", "PNG", "JpEg"]) {
      expect(hasImage(msg({ content: `look https://x.com/a/b.${ext}` }))).toBe(true);
    }
  });

  it("allows a query string, a fragment, angle brackets and brackets around the link", () => {
    expect(hasImage(msg({ content: "https://cdn.discordapp.com/a/b/c.png?ex=1&is=2&hm=3" }))).toBe(true);
    expect(hasImage(msg({ content: "https://x.com/a.jpg#frag" }))).toBe(true);
    expect(hasImage(msg({ content: "<https://x.com/a.jpg>" }))).toBe(true);
    expect(hasImage(msg({ content: "(https://x.com/a.gif)" }))).toBe(true);
  });

  it("tolerates trailing sentence punctuation", () => {
    expect(hasImage(msg({ content: "see https://x.com/a.png." }))).toBe(true);
    expect(hasImage(msg({ content: "https://x.com/a.png, nice" }))).toBe(true);
    expect(hasImage(msg({ content: "wow https://x.com/a.png!" }))).toBe(true);
  });

  it("rejects look-alikes: other extensions, extra suffixes, extension only in the query", () => {
    expect(hasImage(msg({ content: "https://x.com/a.png.exe" }))).toBe(false);
    expect(hasImage(msg({ content: "https://x.com/a.pngfoo" }))).toBe(false);
    expect(hasImage(msg({ content: "https://x.com/view?img=a.png" }))).toBe(false);
    expect(hasImage(msg({ content: "https://x.com/page" }))).toBe(false);
    expect(hasImage(msg({ content: "https://x.com/clip.mp4" }))).toBe(false);
    expect(hasImage(msg({ content: "just a.png in prose, no link" }))).toBe(false);
  });

  it("is false for an empty message", () => {
    expect(hasImage(msg())).toBe(false);
  });
});

describe("isSeedCandidate", () => {
  const withImage = { attachments: [{ contentType: "image/png" }] };

  it("accepts a human image message in a guild", () => {
    expect(isSeedCandidate(msg(withImage))).toBe(true);
  });

  it("rejects bot-authored, system and DM messages even with an image", () => {
    expect(isSeedCandidate(msg({ ...withImage, authorBot: true }))).toBe(false);
    expect(isSeedCandidate(msg({ ...withImage, system: true }))).toBe(false);
    expect(isSeedCandidate(msg({ ...withImage, guildId: null }))).toBe(false);
  });

  it("rejects a human message with no image", () => {
    expect(isSeedCandidate(msg({ content: "hello" }))).toBe(false);
  });
});

describe("planReactions", () => {
  const board = (over: Partial<StarboardBoard> = {}): StarboardBoard => ({
    id: "b1",
    name: "S",
    enabled: true,
    emoji: "⭐",
    threshold: 3,
    channelId: "board-fame",
    ignoredChannelIds: [],
    watchedChannelIds: ["gallery"],
    autoReact: true,
    deleteBelowThreshold: false,
    ...over,
  });
  const channel = (over: Partial<{ id: string; parentId: string | null; nsfw: boolean }> = {}) => ({
    id: "gallery",
    parentId: null,
    nsfw: false,
    ...over,
  });
  const boardChannels = new Set(["board-fame", "board-shame"]);

  it("returns each qualifying board's emoji in config order", () => {
    const boards = [board(), board({ id: "b2", emoji: "💀", channelId: "board-shame" })];
    expect(planReactions(boards, channel(), boardChannels)).toEqual(["⭐", "💀"]);
  });

  it("skips boards with autoReact off or the board disabled", () => {
    const boards = [
      board({ autoReact: false }),
      board({ id: "b2", emoji: "💀", channelId: "board-shame", enabled: false }),
      board({ id: "b3", emoji: "🔥", channelId: "board-fire" }),
    ];
    expect(planReactions(boards, channel(), boardChannels)).toEqual(["🔥"]);
  });

  it("skips boards that do not watch this channel", () => {
    const boards = [board({ watchedChannelIds: ["elsewhere"] })];
    expect(planReactions(boards, channel(), boardChannels)).toEqual([]);
  });

  it("treats a thread under a watched channel as watched", () => {
    expect(planReactions([board()], channel({ id: "t1", parentId: "gallery" }), boardChannels)).toEqual(["⭐"]);
  });

  it("lets the ignored list win", () => {
    const boards = [board({ ignoredChannelIds: ["gallery"] })];
    expect(planReactions(boards, channel(), boardChannels)).toEqual([]);
  });

  it("never seeds NSFW channels or board channels", () => {
    expect(planReactions([board()], channel({ nsfw: true }), boardChannels)).toEqual([]);
    const inBoard = board({ watchedChannelIds: ["board-fame"] });
    expect(planReactions([inBoard], channel({ id: "board-fame" }), boardChannels)).toEqual([]);
  });

  it("de-duplicates the same emoji across boards, treating ❤ and ❤️ as equal", () => {
    const boards = [
      board({ emoji: "❤" }),
      board({ id: "b2", emoji: "❤️", channelId: "board-shame" }),
      board({ id: "b3", emoji: "⭐", channelId: "board-star2" }),
    ];
    expect(planReactions(boards, channel(), boardChannels)).toEqual(["❤", "⭐"]);
  });

  it("passes a custom-emoji id through as stored", () => {
    const boards = [board({ emoji: "123456789012345678" })];
    expect(planReactions(boards, channel(), boardChannels)).toEqual(["123456789012345678"]);
  });

  it("returns nothing when there are no boards", () => {
    expect(planReactions([], channel(), boardChannels)).toEqual([]);
  });
});

describe("seedReactions", () => {
  it("reacts with every emoji in order", async () => {
    const react = vi.fn().mockResolvedValue("ok");
    await seedReactions(react, ["⭐", "💀"]);
    expect(react.mock.calls.map((c) => c[0])).toEqual(["⭐", "💀"]);
  });

  it("does not wait for the next emoji until the previous finished (sequential)", async () => {
    const order: string[] = [];
    const react = async (emoji: string) => {
      order.push(`start ${emoji}`);
      await Promise.resolve();
      order.push(`end ${emoji}`);
      return "ok" as const;
    };
    await seedReactions(react, ["⭐", "💀"]);
    expect(order).toEqual(["start ⭐", "end ⭐", "start 💀", "end 💀"]);
  });

  it("keeps going after an emoji the bot cannot use", async () => {
    const react = vi
      .fn()
      .mockResolvedValueOnce("failed")
      .mockResolvedValueOnce("ok");
    await seedReactions(react, ["123456789012345678", "💀"]);
    expect(react).toHaveBeenCalledTimes(2);
  });

  it("stops when the message is gone", async () => {
    const react = vi.fn().mockResolvedValue("gone");
    await seedReactions(react, ["⭐", "💀"]);
    expect(react).toHaveBeenCalledTimes(1);
  });

  it("treats a throwing react as a failure and never throws itself", async () => {
    const react = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(seedReactions(react, ["⭐", "💀"])).resolves.toBeUndefined();
    expect(react).toHaveBeenCalledTimes(2);
  });

  it("does nothing for an empty plan", async () => {
    const react = vi.fn();
    await seedReactions(react, []);
    expect(react).not.toHaveBeenCalled();
  });
});
