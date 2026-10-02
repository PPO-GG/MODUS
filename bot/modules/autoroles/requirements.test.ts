import { describe, expect, it } from "vitest";
import type { AutoRole } from "../../lib/schemas";
import {
  DAY_MS,
  hasRequirement,
  isLevelOnly,
  maxLevelRequirement,
  meetsAll,
  meetsRequirement,
  needsMemberList,
  type MemberFacts,
} from "./requirements";

const NOW = Date.parse("2026-10-01T00:00:00Z");
const facts = (over: Partial<MemberFacts> = {}): MemberFacts => ({
  joinedAtMs: NOW - 10 * DAY_MS,
  accountCreatedAtMs: NOW - 100 * DAY_MS,
  level: 5,
  isJoinEvent: false,
  ...over,
});
const rule = (requirements: AutoRole["requirements"]): AutoRole => ({
  id: "r",
  name: "n",
  enabled: true,
  roleId: "1",
  requirements,
});

describe("meetsRequirement", () => {
  it("level: passes at and above the threshold, fails below", () => {
    expect(meetsRequirement({ type: "level", level: 5 }, facts({ level: 5 }), NOW)).toBe(true);
    expect(meetsRequirement({ type: "level", level: 5 }, facts({ level: 4 }), NOW)).toBe(false);
  });

  it("level: null (not opted in) never qualifies", () => {
    expect(meetsRequirement({ type: "level", level: 1 }, facts({ level: null }), NOW)).toBe(false);
  });

  it("tenure_days: boundary is inclusive", () => {
    const req = { type: "tenure_days", days: 10 } as const;
    expect(meetsRequirement(req, facts({ joinedAtMs: NOW - 10 * DAY_MS }), NOW)).toBe(true);
    expect(meetsRequirement(req, facts({ joinedAtMs: NOW - 10 * DAY_MS + 1 }), NOW)).toBe(false);
  });

  it("tenure_days: unknown joinedAt never qualifies", () => {
    expect(meetsRequirement({ type: "tenure_days", days: 1 }, facts({ joinedAtMs: null }), NOW)).toBe(false);
  });

  it("account_age_days: boundary is inclusive", () => {
    const req = { type: "account_age_days", days: 100 } as const;
    expect(meetsRequirement(req, facts({ accountCreatedAtMs: NOW - 100 * DAY_MS }), NOW)).toBe(true);
    expect(meetsRequirement(req, facts({ accountCreatedAtMs: NOW - 100 * DAY_MS + 1 }), NOW)).toBe(false);
  });

  it("on_join is true only on the join path", () => {
    expect(meetsRequirement({ type: "on_join" }, facts({ isJoinEvent: true }), NOW)).toBe(true);
    expect(meetsRequirement({ type: "on_join" }, facts({ isJoinEvent: false }), NOW)).toBe(false);
  });
});

describe("meetsAll", () => {
  it("requires every requirement (AND)", () => {
    const reqs = [
      { type: "level", level: 3 },
      { type: "tenure_days", days: 7 },
    ] as AutoRole["requirements"];
    expect(meetsAll(reqs, facts({ level: 3 }), NOW)).toBe(true);
    expect(meetsAll(reqs, facts({ level: 2 }), NOW)).toBe(false);
    expect(meetsAll(reqs, facts({ joinedAtMs: NOW - 2 * DAY_MS }), NOW)).toBe(false);
  });

  it("an empty requirement list never qualifies", () => {
    expect(meetsAll([], facts(), NOW)).toBe(false);
  });
});

describe("rule helpers", () => {
  it("classifies rules", () => {
    const levelOnly = rule([{ type: "level", level: 2 }, { type: "level", level: 6 }]);
    const mixed = rule([{ type: "level", level: 2 }, { type: "tenure_days", days: 3 }]);
    const age = rule([{ type: "account_age_days", days: 3 }]);
    const join = rule([{ type: "on_join" }]);

    expect(isLevelOnly(levelOnly)).toBe(true);
    expect(isLevelOnly(mixed)).toBe(false);
    expect(needsMemberList(mixed)).toBe(true);
    expect(needsMemberList(age)).toBe(true);
    expect(needsMemberList(levelOnly)).toBe(false);
    expect(needsMemberList(join)).toBe(false);
    expect(hasRequirement(join, "on_join")).toBe(true);
    expect(hasRequirement(levelOnly, "on_join")).toBe(false);
    expect(maxLevelRequirement(levelOnly)).toBe(6);
    expect(maxLevelRequirement(age)).toBe(0);
  });
});
