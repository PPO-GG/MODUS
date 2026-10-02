import { describe, expect, it } from "vitest";
import {
  describeRequirement,
  newRequirement,
  reissueIdIfRoleChanged,
  roleProblem,
  toSavedRule,
  validateRule,
  type AutoRoleRule,
} from "./autoroles";

const rule = (over: Partial<AutoRoleRule> = {}): AutoRoleRule => ({
  id: "r1",
  name: "Regulars",
  enabled: true,
  roleId: "100",
  requirements: [{ type: "level", level: 5 }],
  ...over,
});

describe("describeRequirement", () => {
  it("renders each type", () => {
    expect(describeRequirement({ type: "level", level: 5 })).toBe("Level 5+");
    expect(describeRequirement({ type: "tenure_days", days: 7 })).toBe("7+ days in server");
    expect(describeRequirement({ type: "account_age_days", days: 30 })).toBe("Account 30+ days old");
    expect(describeRequirement({ type: "on_join" })).toBe("On join");
  });
});

describe("newRequirement", () => {
  it("gives sensible defaults", () => {
    expect(newRequirement("level")).toEqual({ type: "level", level: 5 });
    expect(newRequirement("tenure_days")).toEqual({ type: "tenure_days", days: 7 });
    expect(newRequirement("account_age_days")).toEqual({ type: "account_age_days", days: 30 });
    expect(newRequirement("on_join")).toEqual({ type: "on_join" });
  });
});

describe("validateRule", () => {
  it("accepts a valid rule", () => {
    expect(validateRule(rule())).toBeNull();
  });

  it("requires a name, a role and at least one requirement", () => {
    expect(validateRule(rule({ name: "  " }))).toMatch(/name/i);
    expect(validateRule(rule({ roleId: "" }))).toMatch(/role/i);
    expect(validateRule(rule({ requirements: [] }))).toMatch(/requirement/i);
  });

  it("rejects out-of-range numbers", () => {
    expect(validateRule(rule({ requirements: [{ type: "level", level: 0 }] }))).toMatch(/level/i);
    expect(validateRule(rule({ requirements: [{ type: "tenure_days", days: 1.5 }] }))).toMatch(/days/i);
    expect(validateRule(rule({ requirements: [{ type: "account_age_days", days: 0 }] }))).toMatch(/days/i);
  });

  it("rejects more than 5 requirements", () => {
    const many = Array.from({ length: 6 }, () => newRequirement("level"));
    expect(validateRule(rule({ requirements: many }))).toMatch(/5/);
  });

  it("allows on_join only with account age", () => {
    expect(validateRule(rule({ requirements: [{ type: "on_join" }, { type: "account_age_days", days: 7 }] }))).toBeNull();
    expect(validateRule(rule({ requirements: [{ type: "on_join" }, { type: "level", level: 2 }] }))).toMatch(/on join/i);
    expect(validateRule(rule({ requirements: [{ type: "on_join" }, { type: "tenure_days", days: 2 }] }))).toMatch(/on join/i);
  });
});

describe("toSavedRule", () => {
  it("keeps only the fields relevant to each requirement type", () => {
    const saved = toSavedRule(
      rule({
        name: " Regulars ",
        requirements: [
          { type: "level", level: 5, days: 99 },
          { type: "on_join", level: 3 },
          { type: "tenure_days", days: 7, level: 1 },
        ],
      }),
    );
    expect(saved).toEqual({
      id: "r1",
      name: "Regulars",
      enabled: true,
      roleId: "100",
      requirements: [{ type: "level", level: 5 }, { type: "on_join" }, { type: "tenure_days", days: 7 }],
    });
  });
});

describe("reissueIdIfRoleChanged", () => {
  it("keeps the id when the role is unchanged", () => {
    const original = rule({ roleId: "100" });
    const edited = rule({ roleId: "100", name: "Renamed" });
    expect(reissueIdIfRoleChanged(original, edited, "new-id")).toEqual(edited);
    expect(reissueIdIfRoleChanged(original, edited, "new-id").id).toBe("r1");
  });

  it("assigns the new id when the role changed, preserving every other field", () => {
    const original = rule({ roleId: "100" });
    const edited = rule({
      roleId: "200",
      name: "Renamed",
      enabled: false,
      requirements: [{ type: "tenure_days", days: 7 }],
    });
    expect(reissueIdIfRoleChanged(original, edited, "new-id")).toEqual({
      id: "new-id",
      name: "Renamed",
      enabled: false,
      roleId: "200",
      requirements: [{ type: "tenure_days", days: 7 }],
    });
  });
});

describe("roleProblem", () => {
  const ctx = { guildId: "guild", botTopPosition: 10 as number | null };
  const role = (over: Partial<{ id: string; managed: boolean; position: number; permissions: string }> = {}) => ({
    id: "100",
    managed: false,
    position: 5,
    permissions: "0",
    ...over,
  });

  it("is null for a grantable role", () => {
    expect(roleProblem(role(), ctx)).toBeNull();
  });

  it("reports a missing role", () => {
    expect(roleProblem(undefined, ctx)).toBe("This role no longer exists, so nothing will be granted.");
  });

  it("reports managed roles and @everyone", () => {
    expect(roleProblem(role({ managed: true }), ctx)).toBe("This role can't be granted by the bot.");
    expect(roleProblem(role({ id: "guild" }), ctx)).toBe("This role can't be granted by the bot.");
  });

  it("reports the Administrator permission, even among other bits", () => {
    const msg = "This role has the Administrator permission, so Auto Roles will never grant it.";
    expect(roleProblem(role({ permissions: "8" }), ctx)).toBe(msg);
    expect(roleProblem(role({ permissions: String(8n | (1n << 40n)) }), ctx)).toBe(msg);
    expect(roleProblem(role({ permissions: String(1n << 40n) }), ctx)).toBeNull();
  });

  it("treats an unparseable permissions string as not administrator", () => {
    expect(roleProblem(role({ permissions: "not-a-number" }), ctx)).toBeNull();
  });

  it("warns for roles at or above the bot's top role, including equality", () => {
    const msg =
      "This role is at or above the bot's highest role, so the bot can't grant it. Move the bot's role higher in Server Settings \u2192 Roles.";
    expect(roleProblem(role({ position: 11 }), ctx)).toBe(msg);
    expect(roleProblem(role({ position: 10 }), ctx)).toBe(msg);
    expect(roleProblem(role({ position: 9 }), ctx)).toBeNull();
  });

  it("shows no hierarchy warning when the bot's top position is unknown", () => {
    expect(roleProblem(role({ position: 999 }), { guildId: "guild", botTopPosition: null })).toBeNull();
  });

  it("applies problems in priority order", () => {
    // missing > managed/@everyone > administrator > hierarchy
    expect(roleProblem(role({ managed: true, permissions: "8", position: 50 }), ctx)).toBe(
      "This role can't be granted by the bot.",
    );
    expect(roleProblem(role({ permissions: "8", position: 50 }), ctx)).toMatch(/Administrator/);
  });
});
