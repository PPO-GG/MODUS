import { describe, expect, it } from "vitest";
import { formatMinutes, timeAgo } from "./time-ago";

const now = Date.parse("2026-09-28T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("timeAgo", () => {
  it("formats seconds, minutes, hours and days compactly", () => {
    expect(timeAgo(ago(20_000), now)).toBe("just now");
    expect(timeAgo(ago(40 * 60_000), now)).toBe("40m");
    expect(timeAgo(ago(9 * 3_600_000), now)).toBe("9h");
    expect(timeAgo(ago(2 * 86_400_000), now)).toBe("2d");
  });
});

describe("formatMinutes", () => {
  it("formats minutes, hours and days", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(10080)).toBe("7d");
  });
});
