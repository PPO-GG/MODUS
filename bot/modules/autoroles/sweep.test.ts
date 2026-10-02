import { describe, expect, it, vi } from "vitest";
import type { AutoRole } from "../../lib/schemas";
import { DAY_MS } from "./requirements";
import type { GrantMember, GrantOutcome } from "./grant";
import {
  GRANT_DELAY_MS,
  MAX_CONSECUTIVE_ERRORS,
  MAX_GRANTS_PER_GUILD_PER_SWEEP,
  sweepGuild,
  type SweepDeps,
} from "./sweep";

const NOW = Date.parse("2026-10-01T00:00:00Z");

const rawRule = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  name: "Rule",
  enabled: true,
  roleId: "role-1",
  requirements: [{ type: "level", level: 3 }],
  ...over,
});

const member = (id: string, over: Partial<GrantMember> = {}): GrantMember =>
  ({
    id,
    joinedTimestamp: NOW - 30 * DAY_MS,
    pending: false,
    user: { bot: false, createdTimestamp: NOW - 200 * DAY_MS },
    roles: { cache: { has: () => false }, add: async () => undefined },
    guild: {} as GrantMember["guild"],
    ...over,
  }) as GrantMember;

function makeDeps(opts: {
  settings: unknown;
  levels?: Array<{ userId: string; level: number }>;
  members?: GrantMember[];
  granted?: Record<string, string[]>;
  outcome?: GrantOutcome;
  /** Per-call outcomes, consumed in order; falls back to `outcome` then "granted". */
  outcomes?: GrantOutcome[];
}) {
  const members = opts.members ?? [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const queue = [...(opts.outcomes ?? [])];
  const tryGrant = vi.fn(async (_m: GrantMember, _r: AutoRole) => queue.shift() ?? opts.outcome ?? "granted");
  const deps: SweepDeps = {
    loadSettings: async () => opts.settings,
    listGranted: async (ruleId) => new Set(opts.granted?.[ruleId] ?? []),
    reconcile: vi.fn(async () => 0),
    listLevels: vi.fn(async (min: number) => (opts.levels ?? []).filter((l) => l.level >= min)),
    fetchMembers: vi.fn(async () => members),
    getMember: vi.fn(async (id: string) => byId.get(id) ?? null),
    tryGrant: tryGrant as SweepDeps["tryGrant"],
    nowMs: () => NOW,
    sleep: vi.fn(async () => undefined),
  };
  return { deps, tryGrant };
}

describe("sweepGuild — reconcile safety", () => {
  it("does NOT reconcile when settings have no rules array (DB error / absent config)", async () => {
    const { deps } = makeDeps({ settings: {} });
    await sweepGuild(deps);
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("reconciles with every stored rule id, including invalid and disabled rules", async () => {
    const { deps } = makeDeps({
      settings: { rules: [rawRule(), rawRule({ id: "bad", requirements: [] }), rawRule({ id: "off", enabled: false })] },
    });
    await sweepGuild(deps);
    expect(deps.reconcile).toHaveBeenCalledWith(["r1", "bad", "off"]);
  });

  it("reconciles with an empty list when the admin saved zero rules", async () => {
    const { deps } = makeDeps({ settings: { rules: [] } });
    await sweepGuild(deps);
    expect(deps.reconcile).toHaveBeenCalledWith([]);
  });
});

describe("sweepGuild — level-only rules", () => {
  it("grants opted-in members at/above the level, skips already-granted, never fetches the member list", async () => {
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: [{ userId: "a", level: 5 }, { userId: "b", level: 3 }, { userId: "c", level: 9 }],
      members: [member("a"), member("b"), member("c")],
      granted: { r1: ["c"] },
    });
    const result = await sweepGuild(deps);
    expect(tryGrant.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
    expect(result.granted).toBe(2);
    expect(deps.fetchMembers).not.toHaveBeenCalled();
    expect(deps.listLevels).toHaveBeenCalledWith(3);
  });

  it("skips users who left the guild and bots", async () => {
    const bot = member("bot", { user: { bot: true, createdTimestamp: 0 } });
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: [{ userId: "gone", level: 5 }, { userId: "bot", level: 5 }],
      members: [bot],
    });
    await sweepGuild(deps);
    expect(tryGrant).not.toHaveBeenCalled();
  });
});

describe("sweepGuild — time-based rules", () => {
  it("fetches the member list once, even with several time-based rules", async () => {
    const { deps } = makeDeps({
      settings: {
        rules: [
          rawRule({ id: "t1", requirements: [{ type: "tenure_days", days: 7 }] }),
          rawRule({ id: "t2", requirements: [{ type: "account_age_days", days: 7 }] }),
        ],
      },
      members: [member("a")],
    });
    await sweepGuild(deps);
    expect(deps.fetchMembers).toHaveBeenCalledTimes(1);
  });

  it("grants members who meet tenure and skips those who do not", async () => {
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule({ requirements: [{ type: "tenure_days", days: 7 }] })] },
      members: [member("old"), member("new", { joinedTimestamp: NOW - 2 * DAY_MS })],
    });
    await sweepGuild(deps);
    expect(tryGrant.mock.calls.map((c) => c[0].id)).toEqual(["old"]);
  });

  it("mixed level + tenure rules use the XP level map", async () => {
    const { deps, tryGrant } = makeDeps({
      settings: {
        rules: [rawRule({ requirements: [{ type: "level", level: 3 }, { type: "tenure_days", days: 7 }] })],
      },
      levels: [{ userId: "hi", level: 4 }],
      members: [member("hi"), member("nolevel")],
    });
    await sweepGuild(deps);
    expect(tryGrant.mock.calls.map((c) => c[0].id)).toEqual(["hi"]);
  });
});

describe("sweepGuild — rule selection", () => {
  it("ignores disabled rules and on_join rules", async () => {
    const { deps, tryGrant } = makeDeps({
      settings: {
        rules: [
          rawRule({ id: "off", enabled: false }),
          rawRule({ id: "join", requirements: [{ type: "on_join" }] }),
        ],
      },
      levels: [{ userId: "a", level: 9 }],
      members: [member("a")],
    });
    await sweepGuild(deps);
    expect(tryGrant).not.toHaveBeenCalled();
  });
});

describe("sweepGuild — throttling", () => {
  it("stops at the per-sweep cap and reports capped, sleeping between role adds", async () => {
    const many = Array.from({ length: MAX_GRANTS_PER_GUILD_PER_SWEEP + 10 }, (_, i) => `u${i}`);
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: many.map((userId) => ({ userId, level: 5 })),
      members: many.map((id) => member(id)),
    });
    const result = await sweepGuild(deps);
    expect(tryGrant).toHaveBeenCalledTimes(MAX_GRANTS_PER_GUILD_PER_SWEEP);
    expect(result).toEqual({
      granted: MAX_GRANTS_PER_GUILD_PER_SWEEP,
      recorded: 0,
      capped: true,
      errors: 0,
      aborted: false,
    });
    expect(deps.sleep).toHaveBeenCalledTimes(MAX_GRANTS_PER_GUILD_PER_SWEEP);
  });

  it("'recorded' outcomes (no API call) do not count toward the cap or sleep", async () => {
    const many = Array.from({ length: MAX_GRANTS_PER_GUILD_PER_SWEEP + 5 }, (_, i) => `u${i}`);
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: many.map((userId) => ({ userId, level: 5 })),
      members: many.map((id) => member(id)),
      outcome: "recorded",
    });
    const result = await sweepGuild(deps);
    expect(tryGrant).toHaveBeenCalledTimes(many.length);
    expect(result.capped).toBe(false);
    expect(deps.sleep).not.toHaveBeenCalled();
  });
});

describe("sweepGuild — role-add error circuit breaker", () => {
  const manyLevels = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

  it("aborts the tick after MAX_CONSECUTIVE_ERRORS consecutive errors, pausing after each", async () => {
    const ids = manyLevels(10);
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: ids.map((userId) => ({ userId, level: 5 })),
      members: ids.map((id) => member(id)),
      outcome: "error",
    });
    const result = await sweepGuild(deps);
    expect(MAX_CONSECUTIVE_ERRORS).toBe(3);
    expect(tryGrant).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ granted: 0, recorded: 0, capped: false, errors: 3, aborted: true });
    expect(deps.sleep).toHaveBeenCalledTimes(3);
    expect(deps.sleep).toHaveBeenCalledWith(GRANT_DELAY_MS);
  });

  it("an error followed by a success resets the consecutive counter", async () => {
    const ids = manyLevels(6);
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: ids.map((userId) => ({ userId, level: 5 })),
      members: ids.map((id) => member(id)),
      outcomes: ["error", "error", "granted", "error", "error", "recorded"],
    });
    const result = await sweepGuild(deps);
    expect(tryGrant).toHaveBeenCalledTimes(6);
    expect(result).toEqual({ granted: 1, recorded: 1, capped: false, errors: 4, aborted: false });
  });

  it("'failed' pre-check outcomes are not errors and never abort", async () => {
    const ids = manyLevels(8);
    const { deps, tryGrant } = makeDeps({
      settings: { rules: [rawRule()] },
      levels: ids.map((userId) => ({ userId, level: 5 })),
      members: ids.map((id) => member(id)),
      outcome: "failed",
    });
    const result = await sweepGuild(deps);
    expect(tryGrant).toHaveBeenCalledTimes(8);
    expect(result).toEqual({ granted: 0, recorded: 0, capped: false, errors: 0, aborted: false });
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("the abort also stops later rules in the same tick", async () => {
    const ids = manyLevels(3);
    const { deps, tryGrant } = makeDeps({
      settings: {
        rules: [rawRule({ id: "a" }), rawRule({ id: "b", roleId: "role-2" })],
      },
      levels: ids.map((userId) => ({ userId, level: 5 })),
      members: ids.map((id) => member(id)),
      outcome: "error",
    });
    const result = await sweepGuild(deps);
    expect(tryGrant).toHaveBeenCalledTimes(3);
    expect(result.aborted).toBe(true);
  });
});
