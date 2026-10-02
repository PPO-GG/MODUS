import { describe, expect, it, vi } from "vitest";
import { emitLevelUp, onLevelUp } from "./levelEvents";

describe("levelEvents", () => {
  it("delivers level-up events to subscribers", () => {
    const handler = vi.fn();
    const off = onLevelUp(handler);
    emitLevelUp({ guildId: "g", userId: "u", level: 3 });
    expect(handler).toHaveBeenCalledWith({ guildId: "g", userId: "u", level: 3 });
    off();
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const off = onLevelUp(handler);
    off();
    emitLevelUp({ guildId: "g", userId: "u", level: 4 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("emitting with no subscribers does not throw", () => {
    expect(() => emitLevelUp({ guildId: "g", userId: "u", level: 1 })).not.toThrow();
  });
});
