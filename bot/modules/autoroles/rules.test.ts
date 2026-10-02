import { describe, expect, it } from "vitest";
import { parseAutoRoles } from "./rules";

const rule = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  name: "Regulars",
  enabled: true,
  roleId: "100",
  requirements: [{ type: "level", level: 5 }],
  ...over,
});

describe("parseAutoRoles", () => {
  it("parses valid rules and reports every stored id", () => {
    const out = parseAutoRoles({ rules: [rule(), rule({ id: "r2" })] });
    expect(out.rules.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(out.allRuleIds).toEqual(["r1", "r2"]);
    expect(out.invalidCount).toBe(0);
  });

  it("skips an invalid rule but keeps the others and keeps its id for reconcile", () => {
    const out = parseAutoRoles({
      rules: [rule(), rule({ id: "bad", requirements: [] }), rule({ id: "r3" })],
    });
    expect(out.rules.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(out.allRuleIds).toEqual(["r1", "bad", "r3"]);
    expect(out.invalidCount).toBe(1);
  });

  it("returns allRuleIds=null when settings have no rules array (absent config or DB error)", () => {
    expect(parseAutoRoles({}).allRuleIds).toBeNull();
    expect(parseAutoRoles(undefined).allRuleIds).toBeNull();
    expect(parseAutoRoles({ rules: "nope" }).allRuleIds).toBeNull();
  });

  it("returns an empty (not null) id list when the admin saved zero rules", () => {
    const out = parseAutoRoles({ rules: [] });
    expect(out.rules).toEqual([]);
    expect(out.allRuleIds).toEqual([]);
  });

  it("defaults enabled to true", () => {
    const { enabled: _enabled, ...noEnabled } = rule();
    expect(parseAutoRoles({ rules: [noEnabled] }).rules[0]?.enabled).toBe(true);
  });

  it("rejects out-of-range and malformed requirements", () => {
    const bad = [
      { type: "level", level: 0 },
      { type: "tenure_days", days: -1 },
      { type: "account_age_days", days: 1.5 },
      { type: "mystery" },
    ];
    for (const req of bad) {
      expect(parseAutoRoles({ rules: [rule({ requirements: [req] })] }).rules).toHaveLength(0);
    }
  });

  it("allows on_join alone or with account_age_days, but not with level or tenure", () => {
    const ok1 = rule({ requirements: [{ type: "on_join" }] });
    const ok2 = rule({ requirements: [{ type: "on_join" }, { type: "account_age_days", days: 30 }] });
    const bad1 = rule({ requirements: [{ type: "on_join" }, { type: "level", level: 2 }] });
    const bad2 = rule({ requirements: [{ type: "on_join" }, { type: "tenure_days", days: 2 }] });
    expect(parseAutoRoles({ rules: [ok1, ok2] }).rules).toHaveLength(2);
    expect(parseAutoRoles({ rules: [bad1, bad2] }).rules).toHaveLength(0);
  });

  it("caps requirements per rule at 5 and rules per guild at 25", () => {
    const many = Array.from({ length: 6 }, () => ({ type: "level", level: 1 }));
    expect(parseAutoRoles({ rules: [rule({ requirements: many })] }).rules).toHaveLength(0);
    const tooMany = Array.from({ length: 26 }, (_, i) => rule({ id: `r${i}` }));
    expect(parseAutoRoles({ rules: tooMany }).rules).toHaveLength(25);
  });
});
