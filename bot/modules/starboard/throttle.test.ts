import { describe, expect, it } from "vitest";
import { LogThrottle } from "./throttle";

describe("LogThrottle", () => {
  it("allows the first log per key and blocks repeats within the ttl", () => {
    let t = 0;
    const throttle = new LogThrottle(1000, () => t);
    expect(throttle.shouldLog("a")).toBe(true);
    expect(throttle.shouldLog("a")).toBe(false);
    expect(throttle.shouldLog("b")).toBe(true);
    t = 999;
    expect(throttle.shouldLog("a")).toBe(false);
    t = 1000;
    expect(throttle.shouldLog("a")).toBe(true);
  });
});
