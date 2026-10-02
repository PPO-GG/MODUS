import { EventEmitter } from "node:events";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { emitLevelUp } from "../../lib/levelEvents";
import type { ModuleManager } from "../../ModuleManager";
import autorolesModule from "./index";

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60_000;

const joinRule = {
  id: "join",
  name: "Join",
  enabled: true,
  roleId: "role-1",
  requirements: [{ type: "on_join" }],
};
const levelRule = {
  id: "lvl",
  name: "Level",
  enabled: true,
  roleId: "role-1",
  requirements: [{ type: "level", level: 3 }],
};

// Per-guild fixtures, keyed by guild id so every test is isolated even though
// the module's listeners are registered once and stay subscribed.
const rulesByGuild = new Map<string, unknown[]>();
const disabledGuilds = new Set<string>();

const client = Object.assign(new EventEmitter(), {
  guilds: { cache: new Map<string, any>() },
});
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const autoroleGrants = {
  insertIfAbsent: vi.fn(async () => true),
  delete: vi.fn(async () => undefined),
  deleteByMember: vi.fn(async () => undefined),
  listGrantedUserIds: vi.fn(async () => new Set<string>()),
  deleteRulesNotIn: vi.fn(async () => 0),
};
const databaseService = {
  isModuleEnabled: vi.fn(async (guildId: string) => !disabledGuilds.has(guildId)),
  getModuleSettings: vi.fn(async (guildId: string) => ({ rules: rulesByGuild.get(guildId) ?? [] })),
  autoroleGrants,
  listOptedInXpLevels: vi.fn(async () => []),
};
const moduleManager = { client, logger, databaseService } as unknown as ModuleManager;

function makeGuild(guildId: string, rules: unknown[]) {
  rulesByGuild.set(guildId, rules);
  const guild = {
    id: guildId,
    roles: {
      cache: {
        get: () => ({ id: "role-1", managed: false, position: 1, permissions: { has: () => false } }),
      },
    },
    members: {
      cache: new Map<string, unknown>(),
      me: {
        permissions: { has: () => true },
        roles: { highest: { position: 10 } },
      },
    },
  };
  client.guilds.cache.set(guildId, guild);
  return guild;
}

function makeMember(
  guild: ReturnType<typeof makeGuild>,
  userId: string,
  bot = false,
  pending = false,
) {
  const add = vi.fn(async () => undefined);
  const member = {
    id: userId,
    guild,
    joinedTimestamp: NOW,
    pending,
    user: { bot, createdTimestamp: NOW - 100 * DAY_MS },
    roles: { cache: { has: () => false }, add },
  };
  return { member, add };
}

/** Handlers are fire-and-forget async; drain the microtask queue. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeAll(() => {
  // The module arms a setTimeout/setInterval sweep timer; keep it from ever firing.
  vi.useFakeTimers();
  autorolesModule.registerEvents!(moduleManager);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.useRealTimers();
});

describe("autoroles module shape", () => {
  it("is a command-less module with dashboard metadata", () => {
    expect(autorolesModule.name).toBe("autoroles");
    expect(autorolesModule.meta).toMatchObject({
      category: "community",
      icon: "i-lucide-user-check",
      color: "teal",
    });
    expect(typeof autorolesModule.execute).toBe("function");
    expect(typeof autorolesModule.registerEvents).toBe("function");
    expect(autorolesModule).not.toHaveProperty("data");
    expect(autorolesModule).not.toHaveProperty("commands");
  });
});

describe("guildMemberAdd", () => {
  it("grants an on_join rule and records the grant", async () => {
    const guild = makeGuild("g-join", [joinRule]);
    const { member, add } = makeMember(guild, "u-join");

    client.emit("guildMemberAdd", member);
    await vi.waitFor(() => expect(add).toHaveBeenCalledWith("role-1", expect.any(String)));

    expect(autoroleGrants.insertIfAbsent).toHaveBeenCalledWith("g-join", "u-join", "join");
  });

  it("never grants to a bot", async () => {
    const guild = makeGuild("g-join-bot", [joinRule]);
    const { member, add } = makeMember(guild, "u-bot", true);

    client.emit("guildMemberAdd", member);
    await settle();

    expect(add).not.toHaveBeenCalled();
    expect(autoroleGrants.insertIfAbsent).not.toHaveBeenCalled();
    expect(autoroleGrants.deleteByMember).not.toHaveBeenCalled();
  });

  it("does nothing when the module is disabled for the guild", async () => {
    const guild = makeGuild("g-join-off", [joinRule]);
    disabledGuilds.add("g-join-off");
    const { member, add } = makeMember(guild, "u-off");

    client.emit("guildMemberAdd", member);
    await settle();

    expect(databaseService.isModuleEnabled).toHaveBeenCalledWith("g-join-off", "autoroles");
    expect(add).not.toHaveBeenCalled();
    expect(autoroleGrants.insertIfAbsent).not.toHaveBeenCalled();
  });

  it("clears stale grant rows before attempting the grant, so a rejoiner is not blocked", async () => {
    const guild = makeGuild("g-rejoin", [joinRule]);
    const { member, add } = makeMember(guild, "u-rejoin");

    client.emit("guildMemberAdd", member);
    await vi.waitFor(() => expect(add).toHaveBeenCalled());

    expect(autoroleGrants.deleteByMember).toHaveBeenCalledWith("g-rejoin", "u-rejoin");
    expect(autoroleGrants.deleteByMember.mock.invocationCallOrder[0]).toBeLessThan(
      autoroleGrants.insertIfAbsent.mock.invocationCallOrder[0],
    );
  });

  it("clears stale grant rows even when the module is disabled or the guild has no rules", async () => {
    const off = makeGuild("g-rejoin-off", [joinRule]);
    disabledGuilds.add("g-rejoin-off");
    const none = makeGuild("g-rejoin-none", []);

    client.emit("guildMemberAdd", makeMember(off, "u-a").member);
    client.emit("guildMemberAdd", makeMember(none, "u-b").member);
    await settle();

    expect(autoroleGrants.deleteByMember).toHaveBeenCalledWith("g-rejoin-off", "u-a");
    expect(autoroleGrants.deleteByMember).toHaveBeenCalledWith("g-rejoin-none", "u-b");
  });

  it("does not grant while the member is still in Membership Screening, but still clears stale rows", async () => {
    const guild = makeGuild("g-join-pending", [joinRule]);
    const { member, add } = makeMember(guild, "u-pend", false, true);

    client.emit("guildMemberAdd", member);
    await settle();

    expect(autoroleGrants.deleteByMember).toHaveBeenCalledWith("g-join-pending", "u-pend");
    expect(add).not.toHaveBeenCalled();
    expect(autoroleGrants.insertIfAbsent).not.toHaveBeenCalled();
  });
});

describe("guildMemberUpdate (Membership Screening)", () => {
  it("grants the on_join rule when the member finishes screening, without clearing grants", async () => {
    const guild = makeGuild("g-screen", [joinRule]);
    const { member, add } = makeMember(guild, "u-screen");

    client.emit("guildMemberUpdate", { pending: true }, member);
    await vi.waitFor(() => expect(add).toHaveBeenCalledWith("role-1", expect.any(String)));

    expect(autoroleGrants.insertIfAbsent).toHaveBeenCalledWith("g-screen", "u-screen", "join");
    expect(autoroleGrants.deleteByMember).not.toHaveBeenCalled();
  });

  it("does nothing when pending did not flip from true to false", async () => {
    const guild = makeGuild("g-screen-none", [joinRule]);
    const { member, add } = makeMember(guild, "u-none");

    client.emit("guildMemberUpdate", { pending: false }, member);
    client.emit("guildMemberUpdate", { pending: null }, member);
    client.emit("guildMemberUpdate", {}, member);
    client.emit("guildMemberUpdate", { pending: true }, { ...member, pending: true });
    await settle();

    expect(add).not.toHaveBeenCalled();
    expect(autoroleGrants.insertIfAbsent).not.toHaveBeenCalled();
  });

  it("never grants to a bot", async () => {
    const guild = makeGuild("g-screen-bot", [joinRule]);
    const { member, add } = makeMember(guild, "u-sbot", true);

    client.emit("guildMemberUpdate", { pending: true }, member);
    await settle();

    expect(add).not.toHaveBeenCalled();
  });
});

describe("guildMemberRemove", () => {
  it("clears the member's grants so they can re-earn roles after rejoining", async () => {
    client.emit("guildMemberRemove", { id: "u-leave", guild: { id: "g-leave" } });
    await vi.waitFor(() =>
      expect(autoroleGrants.deleteByMember).toHaveBeenCalledWith("g-leave", "u-leave"),
    );
  });
});

describe("level-up", () => {
  it("grants a level rule once the member reaches the level", async () => {
    const guild = makeGuild("g-lvl", [levelRule]);
    const { member, add } = makeMember(guild, "u-lvl");
    guild.members.cache.set("u-lvl", member);

    emitLevelUp({ guildId: "g-lvl", userId: "u-lvl", level: 3 });
    await vi.waitFor(() => expect(add).toHaveBeenCalledWith("role-1", expect.any(String)));

    expect(autoroleGrants.insertIfAbsent).toHaveBeenCalledWith("g-lvl", "u-lvl", "lvl");
  });

  it("does not grant below the required level", async () => {
    const guild = makeGuild("g-lvl-low", [levelRule]);
    const { member, add } = makeMember(guild, "u-low");
    guild.members.cache.set("u-low", member);

    emitLevelUp({ guildId: "g-lvl-low", userId: "u-low", level: 2 });
    await settle();

    expect(databaseService.getModuleSettings).toHaveBeenCalledWith("g-lvl-low", "autoroles");
    expect(add).not.toHaveBeenCalled();
    expect(autoroleGrants.insertIfAbsent).not.toHaveBeenCalled();
  });

  it("does nothing when the module is disabled for the guild", async () => {
    const guild = makeGuild("g-lvl-off", [levelRule]);
    disabledGuilds.add("g-lvl-off");
    const { member, add } = makeMember(guild, "u-lvl-off");
    guild.members.cache.set("u-lvl-off", member);

    emitLevelUp({ guildId: "g-lvl-off", userId: "u-lvl-off", level: 5 });
    await settle();

    expect(databaseService.isModuleEnabled).toHaveBeenCalledWith("g-lvl-off", "autoroles");
    expect(add).not.toHaveBeenCalled();
  });
});
