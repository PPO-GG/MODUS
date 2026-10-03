import { describe, expect, it, vi } from "vitest";
import { resolveGuildSettings } from "./gate";

const deps = (enabled: boolean, settings: unknown) => ({
  isEnabled: vi.fn(async () => enabled),
  loadSettings: vi.fn(async () => settings),
});

describe("resolveGuildSettings", () => {
  it("refuses a guild that has the module disabled, without loading settings", async () => {
    const d = deps(false, { channelId: "c1" });
    const result = await resolveGuildSettings(d, { requireChannel: false });
    expect(result).toEqual({ ok: false, message: "Suggestions are disabled for this server." });
    expect(d.loadSettings).not.toHaveBeenCalled();
  });

  it("refuses when a channel is required but not configured", async () => {
    const result = await resolveGuildSettings(deps(true, {}), { requireChannel: true });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/not set up/i);
  });

  it("refuses when settings are invalid and a channel is required", async () => {
    const result = await resolveGuildSettings(deps(true, { channelId: 5 }), { requireChannel: true });
    expect(result.ok).toBe(false);
  });

  it("passes the parsed settings when configured", async () => {
    const result = await resolveGuildSettings(deps(true, { channelId: "c1" }), { requireChannel: true });
    expect(result.ok && result.settings.channelId).toBe("c1");
  });

  it("allows an unconfigured guild when no channel is required (voting/review of existing posts)", async () => {
    const result = await resolveGuildSettings(deps(true, {}), { requireChannel: false });
    expect(result.ok).toBe(true);
  });
});
