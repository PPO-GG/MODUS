import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import type { AutoRole } from "../../lib/schemas";
import { DAY_MS } from "./requirements";
import {
  grantQualifyingRoles,
  memberFacts,
  resetLogThrottle,
  tryGrant,
  type GrantDeps,
  type GrantMember,
} from "./grant";

const NOW = Date.parse("2026-10-01T00:00:00Z");

const rule = (over: Partial<AutoRole> = {}): AutoRole => ({
  id: "r1",
  name: "Regulars",
  enabled: true,
  roleId: "role-1",
  requirements: [{ type: "level", level: 1 }],
  ...over,
});

function makeMember(opts: {
  hasRole?: boolean;
  role?: { id: string; managed: boolean; position: number } | null;
  admin?: boolean;
  pending?: boolean | null;
  botPosition?: number;
  canManage?: boolean;
  noMe?: boolean;
  addImpl?: () => Promise<unknown>;
} = {}) {
  const add = vi.fn(opts.addImpl ?? (async () => undefined));
  const baseRole = opts.role === null ? undefined : (opts.role ?? { id: "role-1", managed: false, position: 1 });
  const role = baseRole && {
    ...baseRole,
    permissions: { has: (p: bigint) => (opts.admin ?? false) && p === PermissionFlagsBits.Administrator },
  };
  const member: GrantMember = {
    id: "user-1",
    joinedTimestamp: NOW - 10 * DAY_MS,
    pending: opts.pending ?? false,
    user: { bot: false, createdTimestamp: NOW - 100 * DAY_MS },
    roles: { cache: { has: () => opts.hasRole ?? false }, add },
    guild: {
      id: "guild-1",
      roles: { cache: { get: () => role } },
      members: {
        me: opts.noMe
          ? null
          : {
              permissions: { has: (p: bigint) => (opts.canManage ?? true) && p === PermissionFlagsBits.ManageRoles },
              roles: { highest: { position: opts.botPosition ?? 10 } },
            },
      },
    },
  };
  return { member, add };
}

function makeDeps(insertResult = true) {
  const grants = {
    insertIfAbsent: vi.fn(async () => insertResult),
    delete: vi.fn(async () => undefined),
  };
  const logger = { warn: vi.fn() };
  const deps: GrantDeps = { grants, logger, nowMs: () => NOW };
  return { deps, grants, logger };
}

beforeEach(() => resetLogThrottle());

describe("tryGrant", () => {
  it("adds the role and records the grant", async () => {
    const { member, add } = makeMember();
    const { deps, grants } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("granted");
    expect(grants.insertIfAbsent).toHaveBeenCalledWith("guild-1", "user-1", "r1");
    expect(add).toHaveBeenCalledWith("role-1", expect.stringContaining("Regulars"));
  });

  it("skips when a grant already exists (manual removal sticks)", async () => {
    const { member, add } = makeMember();
    const { deps } = makeDeps(false);
    expect(await tryGrant(deps, member, rule())).toBe("skipped");
    expect(add).not.toHaveBeenCalled();
  });

  it("records without an API call when the member already has the role", async () => {
    const { member, add } = makeMember({ hasRole: true });
    const { deps, grants } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("recorded");
    expect(grants.insertIfAbsent).toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("never grants to bots", async () => {
    const { member, add } = makeMember();
    member.user.bot = true;
    const { deps, grants } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("skipped");
    expect(grants.insertIfAbsent).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("never grants to a member still in Membership Screening", async () => {
    const { member, add } = makeMember({ pending: true });
    const { deps, grants } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("skipped");
    expect(grants.insertIfAbsent).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("treats a null pending flag as not pending", async () => {
    const { member } = makeMember({ pending: null });
    const { deps } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("granted");
  });

  it.each([
    ["role is missing", { role: null }],
    ["role is managed", { role: { id: "role-1", managed: true, position: 1 } }],
    ["role is @everyone", { role: { id: "guild-1", managed: false, position: 0 } }],
    ["role is at the bot's top role", { role: { id: "role-1", managed: false, position: 10 } }],
    ["role is above the bot's top role", { role: { id: "role-1", managed: false, position: 11 } }],
    ["bot lacks ManageRoles", { canManage: false }],
    ["bot member is unavailable", { noMe: true }],
    ["role has the Administrator permission", { admin: true }],
  ])("fails without touching grants when %s", async (_label, opts) => {
    const { member, add } = makeMember(opts as Parameters<typeof makeMember>[0]);
    const { deps, grants, logger } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("failed");
    expect(grants.insertIfAbsent).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("rolls the grant back when the role add throws, logs, and reports an error", async () => {
    const { member } = makeMember({ addImpl: async () => { throw new Error("Missing Permissions"); } });
    const { deps, grants, logger } = makeDeps();
    expect(await tryGrant(deps, member, rule())).toBe("error");
    expect(grants.delete).toHaveBeenCalledWith("guild-1", "user-1", "r1");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("logs an unthrottled warning naming the rule when the rollback itself fails, still reports an error", async () => {
    const { member } = makeMember({ addImpl: async () => { throw new Error("Missing Permissions"); } });
    const { deps, grants, logger } = makeDeps();
    grants.delete.mockRejectedValueOnce(new Error("db down"));
    expect(await tryGrant(deps, member, rule())).toBe("error");
    expect(logger.warn).toHaveBeenCalledTimes(2);
    const messages = logger.warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("r1") && m.includes("guild-1") && m.includes("user-1") && /stale grant row/i.test(m))).toBe(true);
    expect(messages.some((m) => m.includes("Missing Permissions"))).toBe(true);

    // Not throttled: a second rollback failure within the hour warns again.
    grants.delete.mockRejectedValueOnce(new Error("db down"));
    await tryGrant(deps, member, rule());
    const rollbackWarnings = logger.warn.mock.calls.filter((c) => /stale grant row/i.test(String(c[0])));
    expect(rollbackWarnings).toHaveLength(2);
  });

  it("throttles repeated failure logs to once per hour per rule and reason", async () => {
    const { member } = makeMember({ canManage: false });
    const { deps, logger } = makeDeps();
    await tryGrant(deps, member, rule());
    await tryGrant(deps, member, rule());
    expect(logger.warn).toHaveBeenCalledTimes(1);

    const later: GrantDeps = { ...deps, nowMs: () => NOW + 61 * 60_000 };
    await tryGrant(later, member, rule());
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});

describe("memberFacts", () => {
  it("maps a member to facts", () => {
    const { member } = makeMember();
    expect(memberFacts(member, 4, true)).toEqual({
      joinedAtMs: NOW - 10 * DAY_MS,
      accountCreatedAtMs: NOW - 100 * DAY_MS,
      level: 4,
      isJoinEvent: true,
    });
  });
});

describe("grantQualifyingRoles", () => {
  it("grants only the rules whose requirements all pass, skips disabled rules", async () => {
    const { member, add } = makeMember();
    const { deps } = makeDeps();
    const rules = [
      rule({ id: "pass", requirements: [{ type: "level", level: 3 }] }),
      rule({ id: "fail", requirements: [{ type: "level", level: 9 }] }),
      rule({ id: "off", enabled: false, requirements: [{ type: "level", level: 1 }] }),
    ];
    const outcomes = await grantQualifyingRoles(deps, member, rules, { level: 3, isJoinEvent: false });
    expect(outcomes).toEqual(["granted"]);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("evaluates on_join rules only on the join path", async () => {
    const { member } = makeMember();
    const { deps } = makeDeps();
    const rules = [rule({ requirements: [{ type: "on_join" }] })];
    expect(await grantQualifyingRoles(deps, member, rules, { level: null, isJoinEvent: false })).toEqual([]);
    expect(await grantQualifyingRoles(deps, member, rules, { level: null, isJoinEvent: true })).toEqual(["granted"]);
  });
});
