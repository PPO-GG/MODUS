/**
 * Post or update the suggestions panel (the "New suggestion" message) from the
 * dashboard. Mirrors the bot's /suggestion panel: edit the stored message in
 * place when it is in the same channel, replace it when it was deleted, post a
 * new one otherwise. The Discord calls go straight to the REST API with the bot
 * token (same approach as ./review.post.ts). The route does NOT write settings;
 * the page saves the returned ids with the rest of the settings.
 *
 * Body: { guild_id, channel_id, title?, blurb?, button_label? }
 */
import { getRepos } from "../../utils/db";
import { requireModuleAccess } from "../../utils/session";
import {
  isPostablePanelChannel,
  parsePanelBody,
  resolveDeployMode,
} from "../../utils/suggestions";
import { buildPanelMessage } from "./_panel";

const DISCORD_API = "https://discord.com/api/v10";

const isMissingMessage = (error: any) => {
  const code = error?.data?.code ?? error?.response?._data?.code;
  return code === 10008 || error?.status === 404 || error?.statusCode === 404;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const parsed = parsePanelBody(await readBody(event));
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: parsed.message });
  }
  const { guildId, channelId, title, blurb, buttonLabel } = parsed.value;

  await requireModuleAccess(event, guildId, "suggestions");

  const repos = getRepos();
  if (!repos) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database unavailable (NUXT_DATABASE_URL not set).",
    });
  }
  const botToken = config.discordBotToken as string;
  if (!botToken) {
    throw createError({ statusCode: 500, statusMessage: "Bot token not configured on server." });
  }
  const headers = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };

  // The channel id is client-supplied: it must exist, belong to THIS guild and be postable.
  let channel: unknown;
  try {
    channel = await $fetch(`${DISCORD_API}/channels/${channelId}`, { headers });
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "I can't see that channel. Check that it exists and the bot can view it.",
    });
  }
  if (!isPostablePanelChannel(channel, guildId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a text or announcement channel in this server.",
    });
  }

  // The stored location comes from the DB, never from the client.
  const stored = await repos.guildConfigs.getModuleSettings(guildId, "suggestions");
  const payload = buildPanelMessage({
    panelTitle: title,
    panelBlurb: blurb,
    panelButtonLabel: buttonLabel,
  });
  const mode = resolveDeployMode(stored, channelId);

  let action: "posted" | "updated" | "reposted" = "posted";
  let messageId: string | null = null;

  if (mode.mode === "edit") {
    try {
      // PATCH carries embeds + components only (no `content`).
      await $fetch(`${DISCORD_API}/channels/${channelId}/messages/${mode.messageId}`, {
        method: "PATCH",
        headers,
        body: payload,
      });
      action = "updated";
      messageId = mode.messageId;
    } catch (error: any) {
      if (!isMissingMessage(error)) {
        console.error(
          "[Suggestions Panel API] Discord rejected the edit:",
          JSON.stringify(error?.data || error?.response?._data, null, 2),
        );
        throw createError({
          statusCode: 502,
          statusMessage: "Discord rejected the panel update. Check the bot's access to the channel.",
        });
      }
      action = "reposted";
    }
  }

  if (messageId === null) {
    try {
      const sent = await $fetch<{ id: string }>(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers,
        body: { ...payload, allowed_mentions: { parse: [] } },
      });
      messageId = sent.id;
    } catch (error: any) {
      console.error(
        "[Suggestions Panel API] Discord rejected the post:",
        JSON.stringify(error?.data || error?.response?._data, null, 2),
      );
      throw createError({
        statusCode: 502,
        statusMessage:
          "Discord rejected the panel post. Check that the bot can view, send messages and embed links in that channel.",
      });
    }
  }

  return { ok: true, action, panelChannelId: channelId, panelMessageId: messageId };
});
