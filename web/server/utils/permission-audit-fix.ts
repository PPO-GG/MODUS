/**
 * Preview and apply for permission audit fixes. Re-derives the plan from
 * fresh Discord data on every call, checks the caller's live Discord
 * authority and the bot's capability, performs the writes through an injected
 * client, and logs the previous overwrites. No Nitro globals, so it is
 * testable (the routes in api/permissions/ wire the real clients).
 */
import {
  computeBasePermissions,
  computeChannelPermissions,
  hasPermission,
  missingPermissions,
  parseBits,
  permissionLabel,
  permissionNames,
  type PermissionName,
} from '../../shared/discord-permissions'
import type {
  Finding,
  FixChange,
  FixPlan,
  FixPreview,
  FixResult,
} from '../../shared/permission-audit-types'
import type { DiscordGet } from './discord-guild-context'
import { describeUpstreamFailure } from './discord-upstream-error'
import {
  BotNotInGuildError,
  loadAuditInput,
  type ConfigRepo,
} from './permission-audit-data'
import { planFix, simulatePlan } from './permission-audit/fixes'
import { checkReadiness } from './permission-audit/readiness'
import type { AuditInput } from './permission-audit/types'

const API = 'https://discord.com/api/v10'

export type DiscordRequest = (
  method: 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  headers: Record<string, string>,
  body?: unknown,
) => Promise<unknown>

/** Structural subset of LogRepository. */
export interface LogRepo {
  log(entry: {
    guildId: string
    message: string
    level: 'info' | 'warn' | 'error'
    source?: string
  }): Promise<void>
}

export class FixError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'FixError'
  }
}

export interface FixDeps {
  botToken: string
  get: DiscordGet
  request: DiscordRequest
  configs: ConfigRepo
  logs: LogRepo
}

export interface FixContext {
  guildId: string
  userId: string
  findingId: string
}

const authHeaders = (deps: FixDeps) => ({ Authorization: `Bot ${deps.botToken}` })

/** The caller must currently own the guild or hold Administrator / Manage Server in it. */
async function hasGuildAuthority(deps: FixDeps, ctx: FixContext, input: AuditInput): Promise<boolean> {
  const headers = authHeaders(deps)
  let guild: unknown
  let member: unknown
  try {
    ;[guild, member] = await Promise.all([
      deps.get(`${API}/guilds/${ctx.guildId}`, headers),
      deps.get(`${API}/guilds/${ctx.guildId}/members/${ctx.userId}`, headers),
    ])
  } catch (err: any) {
    // Not a member of the guild (or Discord denies the lookup): no authority.
    if ((err?.status ?? err?.statusCode) === 404) return false
    throw err
  }
  if (String((guild as { owner_id?: unknown } | null)?.owner_id ?? '') === ctx.userId) return true
  const memberRoles = (member as { roles?: unknown } | null)?.roles
  const roleIds = Array.isArray(memberRoles) ? memberRoles.map(String) : []
  const base = computeBasePermissions(ctx.guildId, input.roles, roleIds)
  return hasPermission(base, 'Administrator') || hasPermission(base, 'ManageGuild')
}

/** Module + missing permissions behind a `channel-perms:<module>:<channel>` finding, for the regression blocker. */
function describeRegression(finding: Finding): string {
  const moduleName = finding.id.split(':')[1] ?? 'a module'
  const missing = /^The bot is missing (.+) in #/.exec(finding.title)?.[1]
  return `that ${moduleName} needs${missing ? ` (${missing})` : ''}`
}

/**
 * Why this plan cannot (or should not) be applied by the bot. Only real
 * rules: the plan must exist, the bot needs the Discord permissions the write
 * requires (guild-wide and in the channel itself), it cannot grant itself
 * bits it lacks, and the change must not take away channel access a
 * configured module relies on.
 */
function blockersFor(plan: FixPlan | null, input: AuditInput): string[] {
  if (!plan) return ['This finding no longer applies or cannot be fixed automatically.']
  const base = computeBasePermissions(input.guildId, input.roles, input.bot.roleIds)
  if (hasPermission(base, 'Administrator')) return []

  const blockers: string[] = []
  const add = (message: string) => {
    if (!blockers.includes(message)) blockers.push(message)
  }

  // Guild-wide capability.
  const needed: PermissionName[] = ['ManageRoles']
  if (plan.changes.some((c) => c.op === 'replace-overwrites')) needed.push('ManageChannels')
  const missingGuild = missingPermissions(base, needed)
  if (missingGuild.length > 0) add(`The bot needs ${missingGuild.map(permissionLabel).join(' and ')} to apply this fix.`)

  for (const change of plan.changes) {
    const channel = input.channels.find((c) => c.id === change.channelId)
    if (!channel) continue
    const effective = computeChannelPermissions(base, channel, input.guildId, input.bot.userId, input.bot.roleIds)
    // Discord answers Missing Access when editing a channel the bot cannot view.
    if (!hasPermission(effective, 'ViewChannel')) {
      add(`The bot can't see #${change.channelName}, so Discord won't let it change that channel's permissions. Allow it to view the channel first.`)
      continue
    }
    // Held guild-wide but denied here by an overwrite.
    const deniedHere = missingPermissions(effective, needed).filter((name) => !missingGuild.includes(name))
    if (deniedHere.length > 0) {
      add(`The bot's ${deniedHere.map(permissionLabel).join(' and ')} is denied in #${change.channelName} by a channel or category overwrite, so Discord won't let it apply this fix.`)
    }
    // The bot cannot grant itself bits its roles do not hold.
    if (change.op === 'set-overwrite' && change.targetType === 1 && change.targetId === input.bot.userId) {
      const after = change.after[0]
      const newlyAllowed = parseBits(after?.allow) & ~parseBits(change.before[0]?.allow)
      const lacking = permissionNames(newlyAllowed & ~base)
      if (lacking.length > 0) {
        add(`The bot can't grant itself ${lacking.map(permissionLabel).join(', ')} because its role doesn't have them. Enable them on the bot's role first.`)
      }
    }
  }

  // The fix must not make a configured module lose access it has today.
  const before = new Set(checkReadiness(input).map((f) => f.id))
  for (const finding of checkReadiness(simulatePlan(input, plan))) {
    if (!finding.id.startsWith('channel-perms:') || before.has(finding.id)) continue
    add(`Applying this would remove the bot's access in #${finding.subject.name} ${describeRegression(finding)}. Fix the bot's access first or change this manually in Discord.`)
  }
  return blockers
}

async function loadAndAuthorize(deps: FixDeps, ctx: FixContext): Promise<AuditInput> {
  const input = await loadAuditInput(ctx.guildId, deps.botToken, deps.get, deps.configs)
  if (!(await hasGuildAuthority(deps, ctx, input))) {
    throw new FixError(
      403,
      'You need Manage Server (or to own the server) in Discord to apply permission fixes.',
    )
  }
  return input
}

export async function previewFix(deps: FixDeps, ctx: FixContext): Promise<FixPreview> {
  const input = await loadAndAuthorize(deps, ctx)
  const plan = planFix(input, ctx.findingId)
  const blockers = blockersFor(plan, input)
  return { plan, canApply: plan !== null && blockers.length === 0, blockers }
}

function mapWriteError(err: any): FixError {
  const status = err?.status ?? err?.statusCode
  const reason = typeof err?.data?.message === 'string' ? err.data.message : ''
  if (status === 403) {
    return new FixError(
      403,
      `Discord refused the change${reason ? `: ${reason}` : ''}. The bot may not be allowed to grant itself these permissions; change them manually in Discord.`,
    )
  }
  if (status === 404) return new FixError(404, 'The channel no longer exists.')
  if (status === 429) return new FixError(429, 'Discord is rate limiting requests. Try again shortly.')
  return new FixError(502, 'Discord rejected the change.')
}

async function writeChange(deps: FixDeps, change: FixChange): Promise<void> {
  const headers = authHeaders(deps)
  const channelUrl = `${API}/channels/${change.channelId}`
  try {
    if (change.op === 'set-overwrite') {
      const after = change.after[0]!
      await deps.request('PUT', `${channelUrl}/permissions/${change.targetId}`, headers, {
        type: change.targetType,
        allow: after.allow,
        deny: after.deny,
      })
    } else if (change.op === 'delete-overwrite') {
      await deps.request('DELETE', `${channelUrl}/permissions/${change.targetId}`, headers)
    } else {
      await deps.request('PATCH', channelUrl, headers, {
        permission_overwrites: change.after.map((o) => ({
          id: o.id,
          type: o.type,
          allow: o.allow,
          deny: o.deny,
        })),
      })
    }
  } catch (err) {
    throw mapWriteError(err)
  }
}

export async function applyFix(deps: FixDeps, ctx: FixContext, planHash: string): Promise<FixResult> {
  const input = await loadAndAuthorize(deps, ctx)
  const plan = planFix(input, ctx.findingId)
  if (!plan) throw new FixError(404, 'This finding no longer applies.')
  if (plan.hash !== planHash) {
    throw new FixError(409, 'The channel changed since the preview. Re-run the audit and try again.')
  }
  const blockers = blockersFor(plan, input)
  if (blockers.length > 0) throw new FixError(409, blockers.join(' '))

  for (const change of plan.changes) await writeChange(deps, change)

  let logged = true
  try {
    const previous = plan.changes.map((c) => ({
      channel: c.channelId,
      before: c.before.map((o) => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny })),
    }))
    await deps.logs.log({
      guildId: ctx.guildId,
      level: 'info',
      source: 'permission-audit',
      message: `Permission audit fix applied by ${ctx.userId}: ${plan.summary}. Previous overwrites: ${JSON.stringify(previous)}`,
    })
  } catch {
    logged = false
  }
  return { applied: true, plan, logged }
}

/** Map any error from preview/apply to an HTTP status and a client-safe message. */
export function fixErrorToHttp(error: unknown): { statusCode: number; message: string } {
  if (error instanceof FixError) return { statusCode: error.status, message: error.message }
  if (error instanceof BotNotInGuildError) {
    return {
      statusCode: 404,
      message: "MODUS can't access this server. Make sure the bot is in the server.",
    }
  }
  const failure = describeUpstreamFailure(error)
  if (failure.status === 429) {
    return { statusCode: 429, message: 'Discord is rate limiting requests. Try again shortly.' }
  }
  return { statusCode: 502, message: 'Failed to read permissions from Discord.' }
}
