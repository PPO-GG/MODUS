import { describe, expect, it } from "vitest";
import { parseReviewBody } from "./suggestions";

describe("parseReviewBody", () => {
  it("accepts a valid body and trims the reason", () => {
    expect(parseReviewBody({ guild_id: "g1", id: "s1", status: "approved", reason: "  nice  " })).toEqual({
      ok: true,
      value: { guildId: "g1", id: "s1", status: "approved", reason: "nice" },
    });
  });

  it("treats a missing or blank reason as null", () => {
    const missing = parseReviewBody({ guild_id: "g1", id: "s1", status: "denied" });
    const blank = parseReviewBody({ guild_id: "g1", id: "s1", status: "denied", reason: "   " });
    expect(missing.ok && missing.value.reason).toBeNull();
    expect(blank.ok && blank.value.reason).toBeNull();
  });

  it("requires guild_id, id and status", () => {
    for (const body of [{}, { guild_id: "g" }, { guild_id: "g", id: "s" }, null, "x"]) {
      const parsed = parseReviewBody(body);
      expect(parsed.ok).toBe(false);
    }
  });

  it("refuses statuses staff cannot set, including withdrawn", () => {
    for (const status of ["withdrawn", "bogus", ""]) {
      const parsed = parseReviewBody({ guild_id: "g", id: "s", status });
      expect(parsed.ok).toBe(false);
    }
  });

  it("refuses a reason over 500 characters", () => {
    expect(parseReviewBody({ guild_id: "g", id: "s", status: "approved", reason: "r".repeat(501) }).ok).toBe(false);
    expect(parseReviewBody({ guild_id: "g", id: "s", status: "approved", reason: "r".repeat(500) }).ok).toBe(true);
  });
});
