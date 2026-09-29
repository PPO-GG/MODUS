import { describe, expect, it } from "vitest";
import { overviewSections } from "./overview-sections";

const allOn = () => true;

describe("overviewSections", () => {
  it("gives managers every section, in layout order", () => {
    expect(overviewSections({ accessibleModules: null, isEnabled: allOn })).toEqual([
      "attention", "tickets", "moderation", "community", "botFlags",
    ]);
  });

  it("hides module sections when the module is disabled", () => {
    const off = (n: string) => n !== "tickets";
    expect(overviewSections({ accessibleModules: null, isEnabled: off })).not.toContain("tickets");
  });

  it("trims module-scoped users to their modules plus community", () => {
    expect(overviewSections({ accessibleModules: ["moderation"], isEnabled: allOn })).toEqual(["moderation", "community"]);
    expect(overviewSections({ accessibleModules: ["tickets", "music"], isEnabled: allOn })).toEqual(["tickets", "community"]);
  });

  it("returns nothing for users whose modules have no overview section", () => {
    expect(overviewSections({ accessibleModules: ["music"], isEnabled: allOn })).toEqual([]);
  });
});
