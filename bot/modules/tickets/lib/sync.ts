import type { Guild } from "discord.js";
import type { ModuleManager } from "../../../ModuleManager";
import type { TicketUpsertInput } from "@modus/db";
import { parseSettings } from "../../../lib/validateSettings";
import { TicketsSettingsSchema } from "../../../lib/schemas";
import type { TicketMeta } from "./types";
import { getThreadMeta } from "./utils";

export function ticketUpsertFromMeta(
  guildId: string,
  threadId: string,
  meta: TicketMeta,
  tags: { ownerTag?: string | null; claimedByTag?: string | null } = {},
): TicketUpsertInput {
  return {
    guildId,
    threadId,
    ticketNumber: meta.ticketId,
    ownerId: meta.ownerId,
    ownerTag: tags.ownerTag ?? null,
    typeId: meta.typeId,
    priority: meta.priority,
    status: meta.status === "claimed" ? "claimed" : meta.status === "closed" ? "closed" : "open",
    claimedBy: meta.claimedById,
    claimedByTag: tags.claimedByTag ?? null,
    openedAt: new Date(meta.openedAt),
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mirror one guild's active ticket threads into the DB and close stale rows. */
async function scanGuild(moduleManager: ModuleManager, guild: Guild): Promise<void> {
  const db = moduleManager.databaseService;
  if (!(await db.isModuleEnabled(guild.id, "tickets"))) return;
  const settings = parseSettings(TicketsSettingsSchema, await db.getModuleSettings(guild.id, "tickets"), "tickets", guild.id);
  if (!settings) return;
  const parents = new Set(
    [settings.defaultParentChannelId, ...settings.types.map((t) => t.parentChannelId)].filter(
      (id): id is string => !!id,
    ),
  );
  if (parents.size === 0) return;

  const scanStartedAt = new Date();
  const { threads } = await guild.channels.fetchActiveThreads();
  const active: string[] = [];
  for (const thread of threads.values()) {
    if (!thread.parentId || !parents.has(thread.parentId)) continue;
    const result = await getThreadMeta(thread);
    if (!result) continue;
    active.push(thread.id);
    const owner = guild.members.cache.get(result.meta.ownerId);
    const claimer = result.meta.claimedById ? guild.members.cache.get(result.meta.claimedById) : undefined;
    await db.upsertTicket(
      ticketUpsertFromMeta(guild.id, thread.id, result.meta, {
        ownerTag: owner?.user.tag ?? null,
        claimedByTag: claimer?.user.tag ?? null,
      }),
    );
    await delay(250); // stay well clear of rate limits on large servers
  }
  await db.closeMissingTickets(guild.id, active, scanStartedAt);
}

/** Once per boot, per shard: backfill open tickets for this shard's guilds. */
export async function scanOpenTickets(moduleManager: ModuleManager): Promise<void> {
  for (const guild of moduleManager.client.guilds.cache.values()) {
    try {
      await scanGuild(moduleManager, guild);
    } catch (err) {
      moduleManager.logger.warn(`Ticket startup scan failed: ${err}`, guild.id, "tickets");
    }
  }
}
