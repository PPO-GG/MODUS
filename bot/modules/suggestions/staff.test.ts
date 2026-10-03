import { describe, expect, it } from "vitest";
import { isStaff } from "./staff";

describe("isStaff", () => {
  it("accepts Manage Server regardless of roles", () => {
    expect(isStaff({ manageGuild: true, roleIds: [] }, [])).toBe(true);
  });

  it("accepts any listed staff role", () => {
    expect(isStaff({ manageGuild: false, roleIds: ["x", "mod"] }, ["mod", "admin"])).toBe(true);
  });

  it("refuses a member with neither", () => {
    expect(isStaff({ manageGuild: false, roleIds: ["x"] }, ["mod"])).toBe(false);
  });

  it("refuses everyone without Manage Server when no staff roles are configured", () => {
    expect(isStaff({ manageGuild: false, roleIds: ["x", "mod"] }, [])).toBe(false);
  });
});
