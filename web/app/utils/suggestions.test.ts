import { describe, expect, it } from "vitest";
import {
  createRequestGate,
  messageLink,
  relativeAge,
  statusBadgeColor,
  statusLabel,
  STATUS_TABS,
  STAFF_STATUS_OPTIONS,
  validateReview,
} from "./suggestions";

describe("status helpers", () => {
  it("lists a tab per status with Pending first, and staff options without Withdrawn", () => {
    expect(STATUS_TABS.map((t) => t.value)).toEqual([
      "pending",
      "considering",
      "approved",
      "denied",
      "implemented",
      "withdrawn",
    ]);
    expect(STAFF_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "pending",
      "considering",
      "approved",
      "denied",
      "implemented",
    ]);
  });

  it("labels known statuses and falls back to the raw value", () => {
    expect(statusLabel("approved")).toBe("Approved");
    expect(statusLabel("weird")).toBe("weird");
  });

  it("maps statuses to badge colors, defaulting to neutral", () => {
    expect(statusBadgeColor("approved")).toBe("success");
    expect(statusBadgeColor("denied")).toBe("error");
    expect(statusBadgeColor("considering")).toBe("warning");
    expect(statusBadgeColor("implemented")).toBe("info");
    expect(statusBadgeColor("pending")).toBe("neutral");
    expect(statusBadgeColor("withdrawn")).toBe("neutral");
    expect(statusBadgeColor("weird")).toBe("neutral");
  });
});

describe("validateReview", () => {
  it("accepts a staff status with a reason of up to 500 characters or none", () => {
    expect(validateReview("approved", "")).toBeNull();
    expect(validateReview("denied", "r".repeat(500))).toBeNull();
  });

  it("rejects statuses staff cannot set", () => {
    expect(validateReview("withdrawn", "")).toMatch(/status/i);
    expect(validateReview("", "")).toMatch(/status/i);
  });

  it("rejects an over-long reason", () => {
    expect(validateReview("approved", "r".repeat(501))).toMatch(/500/);
  });
});

describe("relativeAge", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  it("formats minutes, hours, days and falls back to a date after 30 days", () => {
    expect(relativeAge("2026-10-02T11:59:40Z", now)).toBe("just now");
    expect(relativeAge("2026-10-02T11:15:00Z", now)).toBe("45m");
    expect(relativeAge("2026-10-02T07:00:00Z", now)).toBe("5h");
    expect(relativeAge("2026-09-29T12:00:00Z", now)).toBe("3d");
    expect(relativeAge("2026-08-01T12:00:00Z", now)).toBe("2026-08-01");
  });
});

describe("messageLink", () => {
  it("builds a discord.com link, or null when the message was never posted", () => {
    expect(messageLink("g", "c", "m")).toBe("https://discord.com/channels/g/c/m");
    expect(messageLink("g", null, "m")).toBeNull();
    expect(messageLink("g", "c", null)).toBeNull();
  });
});

describe("createRequestGate", () => {
  it("creates a fresh gate", () => {
    const gate = createRequestGate();
    expect(gate).toBeDefined();
    expect(typeof gate.next).toBe("function");
    expect(typeof gate.isCurrent).toBe("function");
  });

  it("token from next() is current", () => {
    const gate = createRequestGate();
    const token = gate.next();
    expect(gate.isCurrent(token)).toBe(true);
  });

  it("after a second next() the first token is stale and the second is current", () => {
    const gate = createRequestGate();
    const token1 = gate.next();
    const token2 = gate.next();
    expect(gate.isCurrent(token1)).toBe(false);
    expect(gate.isCurrent(token2)).toBe(true);
  });

  it("independent gates do not interfere", () => {
    const gate1 = createRequestGate();
    const gate2 = createRequestGate();
    const token1 = gate1.next();
    const token2 = gate2.next();
    expect(gate1.isCurrent(token1)).toBe(true);
    expect(gate2.isCurrent(token2)).toBe(true);
    const token1b = gate1.next();
    expect(gate1.isCurrent(token1)).toBe(false);
    expect(gate1.isCurrent(token1b)).toBe(true);
    expect(gate2.isCurrent(token2)).toBe(true);
  });
});
