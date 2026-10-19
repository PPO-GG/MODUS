import { describe, it, expect, vi } from "vitest";
import helpModule, { getDashboardUrl, buildInteractiveRows } from "./help";
import { MessageFlags, ButtonStyle } from "discord.js";

describe("help module", () => {
  it("registers both /help and /dashboard commands", () => {
    expect(helpModule.commands).toBeDefined();
    expect(helpModule.commands?.length).toBe(2);
    const names = helpModule.commands?.map((c: any) => c.name);
    expect(names).toContain("help");
    expect(names).toContain("dashboard");
  });

  it("resolves dashboard URLs correctly", () => {
    expect(getDashboardUrl("12345")).toMatch(/\/dashboard\/12345$/);
    expect(getDashboardUrl(null)).toMatch(/\/dashboard$/);
    expect(getDashboardUrl(undefined)).toMatch(/\/dashboard$/);
  });

  it("includes a Web Dashboard link button in the interactive rows", () => {
    const pages = [
      {
        name: "ping",
        description: "Ping command",
        commands: [{ name: "ping", description: "Replies with pong", options: [] }],
      },
    ];

    const rows = buildInteractiveRows(pages, 0, false, "guild-999");
    expect(rows.length).toBe(2);

    const buttonRow = rows[1];
    // Row 2 should have 4 buttons: Prev, Indicator, Next, Dashboard Link
    expect(buttonRow.components.length).toBe(4);

    const dashboardBtn: any = buttonRow.components[3];
    expect(dashboardBtn.data.label).toBe("Web Dashboard");
    expect(dashboardBtn.data.style).toBe(ButtonStyle.Link);
    expect(dashboardBtn.data.url).toContain("/dashboard/guild-999");
  });

  it("handles the /dashboard command execution", async () => {
    const editReplyMock = vi.fn().mockResolvedValue({});
    const interaction: any = {
      commandName: "dashboard",
      guildId: "guild-123",
      editReply: editReplyMock,
    };
    const moduleManager: any = {};

    await helpModule.execute(interaction, moduleManager);

    expect(editReplyMock).toHaveBeenCalledTimes(1);
    const callArgs = editReplyMock.mock.calls[0][0];
    expect(callArgs.flags).toBe(MessageFlags.IsComponentsV2);
    expect(callArgs.components).toBeDefined();
    expect(callArgs.components.length).toBeGreaterThan(0);
  });
});
