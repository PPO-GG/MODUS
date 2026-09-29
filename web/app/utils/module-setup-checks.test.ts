import { describe, expect, it } from "vitest";
import { setupIssues } from "./module-setup-checks";

const run = (configs: Record<string, Record<string, any>>, enabled: string[] = Object.keys(configs)) =>
  setupIssues({
    guildId: "g1",
    moduleNames: Object.keys(configs),
    isEnabled: (n) => enabled.includes(n),
    getConfig: (n) => configs[n] ?? {},
  });

describe("setupIssues", () => {
  it("returns nothing for fully configured modules", () => {
    expect(run({
      welcome: { channelId: "c" },
      logging: { auditChannelId: "c" },
      tickets: { panelChannelId: "c", defaultParentChannelId: "p", types: [] },
      verification: { verificationChannelId: "c", buttons: [{ roleId: "r" }] },
      moderation: { modLogChannelId: "c", botCanViewAuditLog: true },
      alerts: { alerts: [{ id: "a" }] },
    })).toEqual([]);
  });

  it("flags each missing required setting with a fix link", () => {
    const issues = run({
      welcome: {},
      logging: { auditChannelId: "" },
      tickets: { types: [{ id: "t", parentChannelId: undefined }] },
      verification: { buttons: [] },
      moderation: { botCanViewAuditLog: false },
      alerts: { alerts: [] },
    });
    const byModule = (m: string) => issues.filter((i) => i.module === m).map((i) => i.message);
    expect(byModule("welcome")).toEqual(["Welcome is on but has no channel selected"]);
    expect(byModule("logging")).toEqual(["Audit Logging is on but has no log channel"]);
    expect(byModule("tickets")).toEqual([
      "Tickets has no panel channel",
      "Tickets has no channel to create ticket threads in",
    ]);
    expect(byModule("verification")).toEqual([
      "Verification has no verification channel",
      "Verification has no verification buttons",
    ]);
    expect(byModule("moderation")).toEqual([
      "Moderation has no mod-log channel",
      "Can't record Discord bans and kicks — the bot needs the View Audit Log permission",
    ]);
    expect(byModule("alerts")).toEqual(["Social Alerts is on but has no alerts set up"]);
    expect(issues[0]?.fixTo).toBe("/dashboard/server/g1/modules/welcome");
  });

  it("treats a type-level thread parent as sufficient and ignores disabled or absent modules", () => {
    expect(run({ tickets: { panelChannelId: "c", types: [{ id: "t", parentChannelId: "p" }] } })).toEqual([]);
    expect(run({ welcome: {} }, [])).toEqual([]);
    expect(run({ moderation: { modLogChannelId: "c" } })).toEqual([]); // flag unknown ≠ false
  });
});
