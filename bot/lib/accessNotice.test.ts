import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_NOTICE_COOLDOWN_MS,
  dmGuildOwner,
  isDiscordAccessError,
  permissionsUrl,
  reportAccessError,
  resetAccessNotices,
} from "./accessNotice";

const accessError = (code: number) => Object.assign(new Error("Missing Access"), { code });

function makeCtx(over: { dmFails?: boolean; channelId?: string } = {}) {
  const send = over.dmFails
    ? vi.fn().mockRejectedValue(accessError(50007))
    : vi.fn().mockResolvedValue({});
  const guild: any = {
    id: "g1",
    name: "Test Guild",
    channels: { cache: new Map([["c1", { name: "logs" }]]) },
    fetchOwner: vi.fn().mockResolvedValue({ send }),
  };
  const logger: any = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return {
    send,
    logger,
    guild,
    ctx: {
      guild,
      channelId: over.channelId ?? "c1",
      module: "logging",
      feature: "send audit logs",
      logger,
    },
  };
}

beforeEach(() => resetAccessNotices());

describe("isDiscordAccessError", () => {
  it.each([
    [50001, true],
    [50013, true],
    [10003, false],
    [undefined, false],
  ])("code %s -> %s", (code, expected) => {
    expect(isDiscordAccessError(Object.assign(new Error("x"), { code }))).toBe(expected);
  });

  it("is false for non-errors", () => {
    expect(isDiscordAccessError(null)).toBe(false);
    expect(isDiscordAccessError("Missing Access")).toBe(false);
  });
});

describe("permissionsUrl", () => {
  it("points at the guild's permissions page", () => {
    expect(permissionsUrl("g1")).toMatch(/\/dashboard\/server\/g1\/permissions$/);
  });
});

describe("reportAccessError", () => {
  it("ignores errors that are not access errors", async () => {
    const { ctx, logger, send } = makeCtx();
    expect(await reportAccessError(accessError(10003), ctx, 0)).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("warns once and DMs the owner the first time", async () => {
    const { ctx, logger, send } = makeCtx();
    expect(await reportAccessError(accessError(50001), ctx, 0)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain("#logs");
    expect(logger.warn.mock.calls[0][0]).toContain("send audit logs");
    expect(logger.error).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain("Test Guild");
    expect(send.mock.calls[0][0]).toContain(permissionsUrl("g1"));
  });

  it("stays silent for the same guild, channel and module inside the cooldown", async () => {
    const { ctx, logger, send } = makeCtx();
    await reportAccessError(accessError(50001), ctx, 0);
    expect(await reportAccessError(accessError(50001), ctx, ACCESS_NOTICE_COOLDOWN_MS - 1)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reports again once the cooldown has passed", async () => {
    const { ctx, logger, send } = makeCtx();
    await reportAccessError(accessError(50001), ctx, 0);
    await reportAccessError(accessError(50001), ctx, ACCESS_NOTICE_COOLDOWN_MS);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("warns for a second channel but DMs the owner only once per guild", async () => {
    const first = makeCtx({ channelId: "c1" });
    await reportAccessError(accessError(50001), first.ctx, 0);
    const second = { ...first.ctx, channelId: "c2", module: "welcome" };
    await reportAccessError(accessError(50013), second, 1000);
    expect(first.logger.warn).toHaveBeenCalledTimes(2);
    expect(first.send).toHaveBeenCalledTimes(1);
  });

  it("still handles the error when the owner cannot be DMed", async () => {
    const { ctx, logger } = makeCtx({ dmFails: true });
    expect(await reportAccessError(accessError(50001), ctx, 0)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("retries the DM after a failed delivery instead of waiting a day", async () => {
    const { ctx, guild, send } = makeCtx({ dmFails: true });
    await reportAccessError(accessError(50001), ctx, 0);
    send.mockResolvedValue({});
    await reportAccessError(accessError(50001), { ...ctx, channelId: "c2" }, 1000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(guild.fetchOwner).toHaveBeenCalledTimes(2);
  });
});

describe("dmGuildOwner", () => {
  it("returns false when the DM is refused", async () => {
    const { guild } = makeCtx({ dmFails: true });
    expect(await dmGuildOwner(guild, "hi")).toBe(false);
  });

  it("returns true when delivered", async () => {
    const { guild, send } = makeCtx();
    expect(await dmGuildOwner(guild, "hi")).toBe(true);
    expect(send).toHaveBeenCalledWith("hi");
  });
});
