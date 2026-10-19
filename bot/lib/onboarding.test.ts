import { describe, it, expect, vi } from "vitest";
import { sendGuildOnboarding } from "./onboarding";
import { ChannelType, ButtonStyle } from "discord.js";

describe("sendGuildOnboarding", () => {
  it("sends to systemChannel when accessible", async () => {
    const sendMock = vi.fn().mockResolvedValue({});
    const systemChannel: any = {
      isTextBased: () => true,
      name: "system-messages",
      send: sendMock,
    };

    const permissionsInMock = vi.fn().mockReturnValue({
      has: () => true,
    });

    const guild: any = {
      id: "guild-abc",
      name: "Test Guild",
      systemChannel,
      members: {
        me: {
          permissionsIn: permissionsInMock,
        },
      },
    };

    const client: any = {};
    const logger: any = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await sendGuildOnboarding(guild, client, logger);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.embeds).toBeDefined();
    expect(payload.embeds[0].data.title).toContain("Thanks for adding MODUS!");
    expect(payload.components).toBeDefined();

    const buttons = payload.components[0].components;
    expect(buttons.length).toBe(3);
    expect(buttons[0].data.label).toBe("Web Dashboard");
    expect(buttons[0].data.style).toBe(ButtonStyle.Link);
    expect(buttons[0].data.url).toContain("/dashboard/guild-abc");
    expect(buttons[1].data.label).toBe("modusbot.io");
    expect(buttons[2].data.label).toBe("Top.gg");
    expect(buttons[2].data.url).toContain("top.gg");
  });

  it("falls back to first writable text channel when systemChannel is missing", async () => {
    const generalSendMock = vi.fn().mockResolvedValue({});
    const generalChannel: any = {
      type: ChannelType.GuildText,
      name: "general",
      send: generalSendMock,
    };

    const permissionsInMock = vi.fn().mockReturnValue({
      has: () => true,
    });

    const channelsCollection = [generalChannel];

    const guild: any = {
      id: "guild-xyz",
      name: "No System Channel Guild",
      systemChannel: null,
      channels: {
        fetch: vi.fn().mockResolvedValue(channelsCollection),
      },
      members: {
        me: {
          permissionsIn: permissionsInMock,
        },
      },
    };

    const client: any = {};
    const logger: any = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await sendGuildOnboarding(guild, client, logger);

    expect(generalSendMock).toHaveBeenCalledTimes(1);
  });

  it("skips gracefully when no channels are writable", async () => {
    const permissionsInMock = vi.fn().mockReturnValue({
      has: () => false,
    });

    const lockedChannel: any = {
      type: ChannelType.GuildText,
      name: "locked",
      send: vi.fn(),
    };

    const guild: any = {
      id: "guild-locked",
      name: "Locked Guild",
      systemChannel: null,
      channels: {
        fetch: vi.fn().mockResolvedValue([lockedChannel]),
      },
      members: {
        me: {
          permissionsIn: permissionsInMock,
        },
      },
    };

    const client: any = {};
    const logger: any = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await sendGuildOnboarding(guild, client, logger);

    expect(lockedChannel.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("no writable text channel found"),
    );
  });
});
