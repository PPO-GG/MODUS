/**
 * Preview and apply for permission plans (audit fixes and presets). Re-derives
 * the plan from fresh Discord data on every call, checks the caller's live
 * Discord authority and the bot's capability, performs the writes through an
 * injected client, and logs the previous overwrites. No Nitro globals, so it is
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
  PresetStats,
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
import type { AuditInput, PlanSource } from './permission-audit/types'

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
    /** How many changes had already been written when this error happened. */
    public applied = 0,
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

export interface PlanContext {
  guildId: string
  userId: string
}

export interface FixContext extends PlanContext {
  findingId: string
}

/** Wording that differs between audit fixes and presets. */
export interface PlanOptions {
  /** 404/409 message when the source derived no plan and gave no problems. */
  noPlanError: string
  /** 409 message when the plan's hash differs from the previewed one. */
  mismatchError: string
  /** Start of the guild-log line, e.g. "Permission audit fix". */
  logTitle: string
}

const authHeaders = (deps: FixDeps) => ({ Authorization: `Bot ${deps.botToken}` })

/** The caller must currently own the guild or hold Administrator / Manage Server in it. */
async function hasGuildAuthority(deps: FixDeps, ctx: PlanContext, input: AuditInput): Promise<boolean> {
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
 * rules: the bot needs the Discord permissions the write requires (guild-wide
 * and in the channel itself), it cannot grant bits its roles lack, and the
 * change must not take away channel access a configured module relies on.
 */
function blockersFor(plan: FixPlan, input: AuditInput): string[] {
  const base = computeBasePermissions(input.guildId, input.roles, input.bot.roleIds)
  if (hasPermission(base, 'Administrator')) return []

  const blockers: string[] = []
  const add = (message: string) => {
    if (!blockers.includes(message)) blockers.push(message)
  }
  // Audit fixes keep their original wording; presets say "preset".
  const what = plan.findingId.startsWith('preset:') ? 'this preset' : 'this fix'

  // Guild-wide capability.
  const needed: PermissionName[] = ['ManageRoles']
  if (plan.changes.some((c) => c.op === 'replace-overwrites')) needed.push('ManageChannels')
  const missingGuild = missingPermissions(base, needed)
  if (missingGuild.length > 0) add(`The bot needs ${missingGuild.map(permissionLabel).join(' and ')} to apply ${what}.`)

  // Each change is judged against the state the earlier ones leave behind: an
  // early write (e.g. denying @everyone View) can take away the bot's own
  // access to the channel before the writes that follow it.
  let current = input
  for (const change of plan.changes) {
    const before = current
    current = simulatePlan(current, { ...plan, changes: [change] })
    const channel = before.channels.find((c) => c.id === change.channelId)
    if (!channel) continue
    const effective = computeChannelPermissions(base, channel, before.guildId, before.bot.userId, before.bot.roleIds)
    // Discord answers Missing Access when editing a channel the bot cannot view.
    if (!hasPermission(effective, 'ViewChannel')) {
      add(`The bot can't see #${change.channelName}, so Discord won't let it change that channel's permissions. Allow it to view the channel first.`)
      continue
    }
    // Held guild-wide but denied here by an overwrite.
    const deniedHere = missingPermissions(effective, needed).filter((name) => !missingGuild.includes(name))
    if (deniedHere.length > 0) {
      add(`The bot's ${deniedHere.map(permissionLabel).join(' and ')} is denied in #${change.channelName} by a channel or category overwrite, so Discord won't let it apply ${what}.`)
    }
    // The bot cannot grant bits its roles do not hold (to itself or to anyone else).
    if (change.op === 'set-overwrite') {
      const after = change.after[0]
      const newlyAllowed = parseBits(after?.allow) & ~parseBits(change.before[0]?.allow)
      const lacking = permissionNames(newlyAllowed & ~base)
      if (lacking.length > 0) {
        const names = lacking.map(permissionLabel).join(', ')
        const toBot = change.targetType === 1 && change.targetId === input.bot.userId
        add(`The bot can't grant ${toBot ? 'itself ' : ''}${names} because its role doesn't have them. Enable them on the bot's role first.`)
      }
      // Discord also refuses to deny a bit the bot does not hold.
      const newlyDenied = parseBits(after?.deny) & ~parseBits(change.before[0]?.deny)
      const lackingDeny = permissionNames(newlyDenied & ~base)
      if (lackingDeny.length > 0) {
        add(`The bot can't deny ${lackingDeny.map(permissionLabel).join(', ')} because its role doesn't have them. Enable them on the bot's role first.`)
      }
    }
  }

  // The change must not make a configured module lose access it has today.
  const before = new Set(checkReadiness(input).map((f) => f.id))
  for (const finding of checkReadiness(simulatePlan(input, plan))) {
    if (!finding.id.startsWith('channel-perms:') || before.has(finding.id)) continue
    add(`Applying this would remove the bot's access in #${finding.subject.name} ${describeRegression(finding)}. Fix the bot's access first or change this manually in Discord.`)
  }
  return blockers
}

async function loadAndAuthorize(deps: FixDeps, ctx: PlanContext): Promise<AuditInput> {
  const input = await loadAuditInput(ctx.guildId, deps.botToken, deps.get, deps.configs)
  if (!(await hasGuildAuthority(deps, ctx, input))) {
    throw new FixError(
      403,
      'You need Manage Server (or to own the server) in Discord to apply permission changes.',
    )
  }
  return input
}

export async function previewPlan(
  deps: FixDeps,
  ctx: PlanContext,
  source: PlanSource,
  noPlanBlocker: string,
): Promise<FixPreview & { stats?: PresetStats }> {
  const input = await loadAndAuthorize(deps, ctx)
  const { plan, problems, stats } = source(input)
  const blockers = plan === null ? (problems.length > 0 ? problems : [noPlanBlocker]) : blockersFor(plan, input)
  return {
    plan,
    canApply: plan !== null && blockers.length === 0,
    blockers,
    ...(stats ? { stats } : {}),
  }
}

function mapWriteError(err: any): FixError {
  const status = err?.status ?? err?.statusCode
  const reason = typeof err?.data?.message === 'string' ? err.data.message : ''
  if (status === 403) {
    return new FixError(
      403,
      `Discord refused the change${reason ? `: ${reason}` : ''}. The bot may be missing a permission this change sets; change it manually in Discord.`,
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

/** Writes the guild-log entry holding the previous overwrites. Returns false when the insert failed. */
async function writeLog(
  deps: FixDeps,
  ctx: PlanContext,
  plan: FixPlan,
  options: PlanOptions,
  applied: number,
): Promise<boolean> {
  const total = plan.changes.length
  const state = applied === total ? 'applied' : `PARTIALLY applied (${applied} of ${total})`
  try {
    const previous = plan.changes.slice(0, applied).map((c) => ({
      channel: c.channelId,
      before: c.before.map((o) => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny })),
    }))
    await deps.logs.log({
      guildId: ctx.guildId,
      level: 'info',
      source: 'permission-audit',
      message: `${options.logTitle} ${state} by ${ctx.userId}: ${plan.summary}. Previous overwrites: ${JSON.stringify(previous)}`,
    })
    return true
  } catch {
    return false
  }
}

export async function applyPlan(
  deps: FixDeps,
  ctx: PlanContext,
  source: PlanSource,
  planHash: string,
  options: PlanOptions,
): Promise<FixResult> {
  const input = await loadAndAuthorize(deps, ctx)
  const { plan, problems } = source(input)
  if (!plan) {
    throw problems.length > 0 ? new FixError(409, problems.join(' ')) : new FixError(404, options.noPlanError)
  }
  if (plan.hash !== planHash) throw new FixError(409, options.mismatchError)
  const blockers = blockersFor(plan, input)
  if (blockers.length > 0) throw new FixError(409, blockers.join(' '))

  // The hash check is not atomic with the writes (Discord has no conditional writes).
  let applied = 0
  try {
    for (const change of plan.changes) {
      await writeChange(deps, change)
      applied += 1
    }
  } catch (err) {
    const failure = err as FixError
    if (applied === 0) throw failure
    await writeLog(deps, ctx, plan, options, applied)
    throw new FixError(
      failure.status,
      `${applied} of ${plan.changes.length} changes were applied before it stopped: ${failure.message}`,
      applied,
    )
  }

  const logged = await writeLog(deps, ctx, plan, options, applied)
  return { applied: true, plan, logged }
}

const FIX_NO_PLAN = 'This finding no longer applies or cannot be fixed automatically.'
const FIX_OPTIONS: PlanOptions = {
  noPlanError: 'This finding no longer applies.',
  mismatchError: 'The channel changed since the preview. Re-run the audit and try again.',
  logTitle: 'Permission audit fix',
}

const fixSource =
  (findingId: string): PlanSource =>
  (input) => ({ plan: planFix(input, findingId), problems: [] })

export async function previewFix(deps: FixDeps, ctx: FixContext): Promise<FixPreview> {
  return previewPlan(deps, ctx, fixSource(ctx.findingId), FIX_NO_PLAN)
}

export async function applyFix(deps: FixDeps, ctx: FixContext, planHash: string): Promise<FixResult> {
  return applyPlan(deps, ctx, fixSource(ctx.findingId), planHash, FIX_OPTIONS)
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
