/**
 * Fetches everything the permission audit needs (roles, channels, the bot's
 * own member, module settings) and shapes it into an AuditInput. The HTTP
 * client is injected so this is testable without Nitro, like
 * discord-guild-context.ts.
 */
import type { ChannelLike, OverwriteLike, RoleLike } from '../../shared/discord-permissions'
import type { DiscordGet } from './discord-guild-context'
import type { AuditInput, AuditModule } from './permission-audit/types'

const API = 'https://discord.com/api/v10'

/** The bot is not in the guild, or Discord denied it access. */
export class BotNotInGuildError extends Error {
  constructor() {
    super("MODUS can't access this server.")
    this.name = 'BotNotInGuildError'
  }
}

/** Structural subset of GuildConfigRepository. */
export interface ConfigRepo {
  listByGuild(
    guildId: string,
  ): Promise<Array<{ moduleName: string; enabled: boolean; settings: string }>>
}

const asArray = (value: unknown): Record<string, any>[] =>
  Array.isArray(value) ? (value as Record<string, any>[]) : []

let botUserId: string | null = null

/** Test hook. */
export function resetBotUserIdCache(): void {
  botUserId = null
}

async function getBotUserId(headers: Record<string, string>, get: DiscordGet): Promise<string> {
  if (botUserId) return botUserId
  const me = (await get(`${API}/users/@me`, headers)) as { id?: unknown } | null
  const id = typeof me?.id === 'string' ? me.id : ''
  if (!id) throw new Error('Could not determine the bot user id from Discord.')
  botUserId = id
  return id
}

function parseSettings(raw: string): Record<string, any> {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const toRole = (r: Record<string, any>): RoleLike => ({
  id: String(r.id),
  name: String(r.name ?? ''),
  position: Number(r.position ?? 0),
  permissions: String(r.permissions ?? '0'),
  managed: Boolean(r.managed),
})

const toOverwrite = (o: Record<string, any>): OverwriteLike => ({
  id: String(o.id),
  type: Number(o.type ?? 0),
  allow: String(o.allow ?? '0'),
  deny: String(o.deny ?? '0'),
})

const toChannel = (c: Record<string, any>): ChannelLike => ({
  id: String(c.id),
  name: String(c.name ?? ''),
  type: Number(c.type ?? 0),
  parent_id: c.parent_id == null ? null : String(c.parent_id),
  permission_overwrites: asArray(c.permission_overwrites).map(toOverwrite),
})

export async function loadAuditInput(
  guildId: string,
  botToken: string,
  get: DiscordGet,
  configs: ConfigRepo,
): Promise<AuditInput> {
  if (!/^\d{1,25}$/.test(guildId)) throw new Error('Invalid guild id.')

  const headers = { Authorization: `Bot ${botToken}` }
  const base = `${API}/guilds/${guildId}`
  const userId = await getBotUserId(headers, get)

  let rawRoles: unknown
  let rawChannels: unknown
  let rawMember: unknown
  try {
    ;[rawRoles, rawChannels, rawMember] = await Promise.all([
      get(`${base}/roles`, headers),
      get(`${base}/channels`, headers),
      get(`${base}/members/${userId}`, headers),
    ])
  } catch (err: any) {
    const status = err?.status ?? err?.statusCode
    if (status === 403 || status === 404) throw new BotNotInGuildError()
    throw err
  }

  const rows = await configs.listByGuild(guildId)
  const modules: AuditModule[] = rows.map((row) => ({
    name: row.moduleName,
    enabled: row.enabled,
    settings: parseSettings(row.settings),
  }))

  // A real guild always has @everyone, and the bot member always has a roles
  // array. Anything else means Discord (or a proxy) sent something unusable;
  // an empty report would read as a false all-clear.
  const memberRoles = (rawMember as { roles?: unknown } | null)?.roles
  const hasEveryone = Array.isArray(rawRoles) && rawRoles.some((r) => r?.id === guildId)
  if (!hasEveryone || !Array.isArray(rawChannels) || !Array.isArray(memberRoles)) {
    throw new Error('Unexpected response from Discord while reading the guild.')
  }

  return {
    guildId,
    roles: asArray(rawRoles).map(toRole),
    channels: asArray(rawChannels).map(toChannel),
    bot: { userId, roleIds: memberRoles.map(String) },
    modules,
  }
}

/** Small per-key TTL cache; expired entries are swept on write. */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const store = new Map<string, { value: T; expires: number }>()
  return {
    get(key: string): T | undefined {
      const entry = store.get(key)
      if (!entry) return undefined
      if (entry.expires <= now()) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key: string, value: T): void {
      const current = now()
      for (const [k, entry] of store) {
        if (entry.expires <= current) store.delete(k)
      }
      store.set(key, { value, expires: current + ttlMs })
    },
  }
}
