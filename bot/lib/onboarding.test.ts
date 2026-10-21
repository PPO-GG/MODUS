import { describe, it, expect, vi } from "vitest";
import { sendGuildOnboarding } from "./onboarding";
import { ChannelType, ButtonStyle, PermissionFlagsBits } from "discord.js";

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
          permissions: { has: () => true },
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
          permissions: { has: () => true },
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
          permissions: { has: () => true },
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

  describe("setup readiness", () => {
    const logger = () => ({ info: vi.fn(), warn: vi.fn() }) as any;
    const guildWith = (hasFlag: (flag: bigint) => boolean, send = vi.fn().mockResolvedValue({})) =>
      ({
        id: "guild-abc",
        name: "Test Guild",
        systemChannel: { isTextBased: () => true, name: "sys", send },
        members: {
          me: {
            permissionsIn: () => ({ has: () => true }),
            permissions: { has: hasFlag },
          },
        },
      }) as any;

    it("adds a setup field naming the missing permissions and linking the fix", async () => {
      const send = vi.fn().mockResolvedValue({});
      const guild = guildWith((flag) => flag !== PermissionFlagsBits.EmbedLinks, send);
      await sendGuildOnboarding(guild, {} as any, logger());
      const fields = send.mock.calls[0][0].embeds[0].data.fields ?? [];
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toContain("Setup needed");
      expect(fields[0].value).toContain("Embed Links");
      expect(fields[0].value).toContain("/dashboard/server/guild-abc/permissions");
    });

    it("adds no setup field when the bot has everything", async () => {
      const send = vi.fn().mockResolvedValue({});
      await sendGuildOnboarding(guildWith(() => true, send), {} as any, logger());
      expect(send.mock.calls[0][0].embeds[0].data.fields ?? []).toHaveLength(0);
    });

    it("DMs the owner when there is no channel to post in", async () => {
      const dm = vi.fn().mockResolvedValue({});
      const guild: any = {
        id: "guild-locked",
        name: "Locked Guild",
        systemChannel: null,
        channels: { fetch: vi.fn().mockResolvedValue([]) },
        fetchOwner: vi.fn().mockResolvedValue({ send: dm }),
        members: {
          me: { permissionsIn: () => ({ has: () => false }), permissions: { has: () => true } },
        },
      };
      await sendGuildOnboarding(guild, {} as any, logger());
      expect(dm).toHaveBeenCalledTimes(1);
      expect(dm.mock.calls[0][0]).toContain("Locked Guild");
      expect(dm.mock.calls[0][0]).toContain("/dashboard/server/guild-locked/permissions");
    });
  });
});
