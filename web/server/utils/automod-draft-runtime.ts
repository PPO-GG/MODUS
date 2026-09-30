/**
 * Real dependencies for the automod draft routes. Kept separate from
 * automod-draft.ts so the handler logic stays free of Nitro globals.
 */
import type { H3Event } from "h3";
import { getRepos } from "./db";
import { requireModuleAccess } from "./session";
import { completeGuildText, resolveGuildAi } from "./guild-ai";
import { fetchGuildContext } from "./discord-guild-context";
import type { DraftDeps } from "./automod-draft";

export const automodDraftDeps: DraftDeps<H3Event> = {
  readBody: (event) => readBody(event),
  getQuery: (event) => getQuery(event),
  requireModuleAccess: (event, guildId) =>
    requireModuleAccess(event, guildId, "automod"),
  getRepos,
  resolveGuildAi,
  completeText: completeGuildText,
  fetchGuildContext: (guildId) => {
    const botToken = useRuntimeConfig().discordBotToken as string;
    if (!botToken) throw new Error("Bot token not configured on server.");
    return fetchGuildContext(guildId, botToken, (url, headers) =>
      $fetch(url, { headers }),
    );
  },
  now: () => Date.now(),
  createHttpError: (statusCode, statusMessage, data) =>
    createError({ statusCode, statusMessage, data }),
  logError: (message, error) => {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`[Automod Draft] ${message} (${name}).`);
  },
};
