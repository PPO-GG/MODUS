import { describe, expect, it } from "vitest";
import { checkRegexSafety, normalizeRegex } from "./regex-safety";

describe("checkRegexSafety", () => {
  it.each([
    String.raw`discord\.gg/\w+`,
    String.raw`\bfree\s+nitro\b`,
    "(?:foo|bar)?baz",
    "^[a-z]{3,10}$",
    String.raw`(https?://)?[^\s]+\.ru\b`,
  ])("accepts %s", (pattern) => {
    expect(checkRegexSafety(pattern)).toBeNull();
  });

  it.each([
    ["(a+)+$", /backtrack/],
    ["(a|aa)+", /backtrack/],
    ["(x+x+)+y", /backtrack/],
    ["(.*a){10,}", /backtrack/],
    [".*.*.*.*", /unbounded repeats/],
    ["(", /compile/],
    [String.raw`(a)\1`, /backreference/],
    ["a".repeat(201), /longer/],
    ["", /empty/],
  ])("rejects %s", (pattern, message) => {
    expect(checkRegexSafety(pattern)).toMatch(message);
  });

  it("ignores quantifier characters inside classes and escapes", () => {
    expect(checkRegexSafety(String.raw`[+*]\+\*a`)).toBeNull();
  });

  it.each([
    ".*.*.*x",
    String.raw`.*\s.*\s.*x`,
    ".*a.*a.*b",
  ])("rejects overlapping wildcard repeats that are cubic on long messages: %s", (pattern) => {
    const started = Date.now();
    expect(checkRegexSafety(pattern)).toMatch(/too slow/);
    // The probe is time-boxed, so rejecting must itself be quick.
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it.each([
    String.raw`\w+@\w+\.\w+`,
    String.raw`[a-z]+\.[a-z]+\.[a-z]+`,
    "free.*nitro",
    String.raw`(?:https?://)?discord\.gg/\w+`,
  ])("still accepts realistic patterns: %s", (pattern) => {
    expect(checkRegexSafety(pattern)).toBeNull();
  });
});

describe("normalizeRegex", () => {
  it.each([
    [".*free.*nitro.*", "free.*nitro"],
    [".*free", "free"],
    ["free.*", "free"],
    [".*?free.*?", "free"],
    ["^.*free", "^.*free"],
    [String.raw`free\.*`, String.raw`free\.*`],
    [".*", ".*"],
    ["discord\\.gg/\\w+", "discord\\.gg/\\w+"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeRegex(input)).toBe(expected);
  });
});
