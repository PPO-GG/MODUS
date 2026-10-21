import {
  Client,
  Guild,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Logger } from "../Logger";

const PUBLIC_URL = (
  process.env.PUBLIC_WEB_URL ||
  process.env.DASHBOARD_URL ||
  "https://modusbot.io"
).replace(/\/$/, "");

const TOPGG_URL =
  process.env.TOPGG_URL || "https://top.gg/bot/1305967842901889085";

/**
 * Sends a welcome/onboarding message to a newly joined guild with links to the
 * web dashboard, project website, and Top.gg page.
 */
export async function sendGuildOnboarding(
  guild: Guild,
  client: Client,
  logger: Logger,
): Promise<void> {
  try {
    const me =
      guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!me) return;

    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];

    // 1. Try systemChannel first
    let targetChannel: any = null;
    if (
      guild.systemChannel &&
      guild.systemChannel.isTextBased() &&
      me.permissionsIn(guild.systemChannel).has(requiredPermissions)
    ) {
      targetChannel = guild.systemChannel;
    }

    // 2. Fallback to first writable text channel
    if (!targetChannel) {
      const channels = await guild.channels.fetch().catch(() => null);
      if (channels) {
        const preferredNames = [
          "general",
          "chat",
          "main",
          "welcome",
          "bot-commands",
        ];
        for (const name of preferredNames) {
          const match = channels.find(
            (c) =>
              c &&
              c.type === ChannelType.GuildText &&
              c.name.toLowerCase().includes(name) &&
              me.permissionsIn(c).has(requiredPermissions),
          );
          if (match) {
            targetChannel = match;
            break;
          }
        }

        if (!targetChannel) {
          targetChannel = channels.find(
            (c) =>
              c &&
              c.type === ChannelType.GuildText &&
              me.permissionsIn(c).has(requiredPermissions),
          );
        }
      }
    }

    if (!targetChannel) {
      logger.info(
        `Onboarding message skipped for ${guild.name} (${guild.id}): no writable text channel found.`,
      );
      return;
    }

    const dashboardUrl = `${PUBLIC_URL}/dashboard/server/${guild.id}/overview`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("👋 Thanks for adding MODUS!")
      .setDescription(
        `Thanks for adding MODUS! Check out the [/dashboard](${dashboardUrl}) to configure modules and manage your server, or use the \`/help\` command for more information on commands.`,
      )
      .setFooter({ text: "MODUS • Modular Discord Utility System" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Web Dashboard")
        .setStyle(ButtonStyle.Link)
        .setURL(dashboardUrl),
      new ButtonBuilder()
        .setLabel("modusbot.io")
        .setStyle(ButtonStyle.Link)
        .setURL(PUBLIC_URL),
      new ButtonBuilder()
        .setLabel("Top.gg")
        .setStyle(ButtonStyle.Link)
        .setURL(TOPGG_URL),
    );

    await targetChannel.send({
      embeds: [embed],
      components: [row],
    });

    logger.info(
      `Sent onboarding message for ${guild.name} (${guild.id}) in #${targetChannel.name}`,
    );
  } catch (err) {
    logger.warn(
      `Failed to send onboarding message to ${guild.name} (${guild.id}): ${(err as Error).message}`,
    );
  }
}
