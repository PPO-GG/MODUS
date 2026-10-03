import { describe, expect, it } from "vitest";
import { isStaffStatus, isVotingLocked, STAFF_STATUSES, STATUS_META } from "./status";

describe("status rules", () => {
  it("staff may set every status except withdrawn", () => {
    expect([...STAFF_STATUSES]).toEqual(["pending", "considering", "approved", "denied", "implemented"]);
    expect(isStaffStatus("approved")).toBe(true);
    expect(isStaffStatus("withdrawn")).toBe(false);
    expect(isStaffStatus("bogus")).toBe(false);
  });

  it("locks voting on denied and implemented only when closeVotingOnDecision is on", () => {
    expect(isVotingLocked("denied", true)).toBe(true);
    expect(isVotingLocked("implemented", true)).toBe(true);
    expect(isVotingLocked("denied", false)).toBe(false);
    expect(isVotingLocked("implemented", false)).toBe(false);
  });

  it("keeps voting open for pending, considering and approved", () => {
    for (const status of ["pending", "considering", "approved"] as const) {
      expect(isVotingLocked(status, true)).toBe(false);
    }
  });

  it("always locks voting on withdrawn", () => {
    expect(isVotingLocked("withdrawn", false)).toBe(true);
    expect(isVotingLocked("withdrawn", true)).toBe(true);
  });

  it("has display metadata for every status", () => {
    for (const status of [...STAFF_STATUSES, "withdrawn"] as const) {
      expect(STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(STATUS_META[status].emoji.length).toBeGreaterThan(0);
      expect(typeof STATUS_META[status].color).toBe("number");
    }
  });
});
