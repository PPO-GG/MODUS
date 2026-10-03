import { createHash } from 'node:crypto'
import {
  PERMISSION_BITS,
  computeBasePermissions,
  computeChannelPermissions,
  missingPermissions,
  parseBits,
  permissionLabel,
  permissionNames,
  type ChannelLike,
  type OverwriteLike,
} from '../../../shared/discord-permissions'
import { getModuleNeeds } from '../../../shared/module-requirements'
import type { FixChange, FixPlan, OverwriteState } from '../../../shared/permission-audit-types'
import { runPermissionAudit } from './index'
import type { AuditInput } from './types'

const ZERO = BigInt(0)
const MANAGE_BITS =
  PERMISSION_BITS.ManageChannels | PERMISSION_BITS.ManageRoles | PERMISSION_BITS.ManageWebhooks

type RawOverwrite = { id: string; type: number; allow: string | bigint; deny: string | bigint }

function labelFor(input: AuditInput, ow: RawOverwrite): string {
  if (ow.type === 1) return ow.id === input.bot.userId ? 'the bot' : `member ${ow.id}`
  if (ow.id === input.guildId) return '@everyone'
  return input.roles.find((r) => r.id === ow.id)?.name ?? `role ${ow.id}`
}

function state(input: AuditInput, ow: RawOverwrite): OverwriteState {
  const allow = parseBits(ow.allow)
  const deny = parseBits(ow.deny)
  return {
    id: ow.id,
    type: ow.type === 1 ? 1 : 0,
    label: labelFor(input, ow),
    allow: allow.toString(),
    deny: deny.toString(),
    allowNames: permissionNames(allow).map(permissionLabel),
    denyNames: permissionNames(deny).map(permissionLabel),
  }
}

const byIdType = (a: OverwriteState, b: OverwriteState) =>
  a.type - b.type || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const statesOf = (input: AuditInput, channel: ChannelLike): OverwriteState[] =>
  (channel.permission_overwrites ?? []).map((o) => state(input, o)).sort(byIdType)

/** Hash of the raw data only (never labels or names), so a role rename does not invalidate a preview. */
function hashPlan(findingId: string, changes: FixChange[]): string {
  const raw = (o: OverwriteState) => [o.id, o.type, o.allow, o.deny]
  const canonical = {
    f: findingId,
    c: changes.map((c) => ({
      ch: c.channelId,
      op: c.op,
      t: c.targetId ?? null,
      tt: c.targetType ?? null,
      b: c.before.map(raw),
      a: c.after.map(raw),
    })),
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function clearEveryoneBits(input: AuditInput, channel: ChannelLike, bitsToClear: bigint): FixChange | null {
  const ow = (channel.permission_overwrites ?? []).find((o) => o.type === 0 && o.id === input.guildId)
  if (!ow) return null
  const allow = parseBits(ow.allow)
  const deny = parseBits(ow.deny)
  const newAllow = allow & ~bitsToClear
  if (newAllow === allow) return null
  const empty = newAllow === ZERO && deny === ZERO
  return {
    channelId: channel.id,
    channelName: channel.name,
    op: empty ? 'delete-overwrite' : 'set-overwrite',
    targetId: ow.id,
    targetType: 0,
    before: [state(input, ow)],
    after: empty ? [] : [state(input, { id: ow.id, type: 0, allow: newAllow, deny })],
  }
}

function syncWithCategory(input: AuditInput, channel: ChannelLike): FixChange | null {
  const parent = channel.parent_id ? input.channels.find((c) => c.id === channel.parent_id) : undefined
  if (!parent || parent.type !== 4) return null
  const before = statesOf(input, channel)
  const after = statesOf(input, parent)
  if (JSON.stringify(before.map((o) => [o.id, o.type, o.allow, o.deny])) === JSON.stringify(after.map((o) => [o.id, o.type, o.allow, o.deny]))) {
    return null
  }
  return {
    channelId: channel.id,
    channelName: channel.name,
    op: 'replace-overwrites',
    before,
    after,
  }
}

function grantBot(input: AuditInput, channel: ChannelLike, moduleName: string): FixChange | null {
  const mod = input.modules.find((m) => m.name === moduleName && m.enabled)
  const ref = mod ? getModuleNeeds(mod.name, mod.settings)?.channels.find((c) => c.id === channel.id) : undefined
  if (!ref) return null

  const botBase = computeBasePermissions(input.guildId, input.roles, input.bot.roleIds)
  const effective = computeChannelPermissions(botBase, channel, input.guildId, input.bot.userId, input.bot.roleIds)
  const missing = missingPermissions(effective, ref.perms)
  if (missing.length === 0) return null

  const missingBits = missing.reduce((acc, name) => acc | PERMISSION_BITS[name], ZERO)
  const existing = (channel.permission_overwrites ?? []).find((o) => o.type === 1 && o.id === input.bot.userId)
  const allow = parseBits(existing?.allow) | missingBits
  const deny = parseBits(existing?.deny) & ~missingBits
  return {
    channelId: channel.id,
    channelName: channel.name,
    op: 'set-overwrite',
    targetId: input.bot.userId,
    targetType: 1,
    before: existing ? [state(input, existing)] : [],
    after: [state(input, { id: input.bot.userId, type: 1, allow, deny })],
  }
}

/**
 * The fix for one finding, derived from the current audit input, or null when
 * the finding does not exist, is not fixable, or has nothing left to change.
 * Pure: the same input always yields the same plan and hash.
 */
export function planFix(input: AuditInput, findingId: string): FixPlan | null {
  const finding = runPermissionAudit(input).findings.find((f) => f.id === findingId)
  if (!finding || !finding.fixable) return null
  // Every fixable rule's subject is the channel it concerns.
  const channel = input.channels.find((c) => c.id === finding.subject.id)
  if (!channel) return null

  const [rule, moduleName] = findingId.split(':')
  let change: FixChange | null = null
  let summary = ''
  switch (rule) {
    case 'everyone-channel-manage':
      change = clearEveryoneBits(input, channel, MANAGE_BITS)
      summary = `Remove management permissions from @everyone in #${channel.name}`
      break
    case 'everyone-channel-mention':
      change = clearEveryoneBits(input, channel, PERMISSION_BITS.MentionEveryone)
      summary = `Remove Mention Everyone from @everyone in #${channel.name}`
      break
    case 'child-exposed':
      change = syncWithCategory(input, channel)
      summary = `Sync #${channel.name} with its category's permissions`
      break
    case 'channel-perms':
      change = grantBot(input, channel, moduleName ?? '')
      summary = `Allow the bot the permissions ${moduleName ?? 'a module'} needs in #${channel.name}`
      break
    default:
      return null
  }
  if (!change) return null

  const changes = [change]
  return { findingId, summary, changes, hash: hashPlan(findingId, changes) }
}

/**
 * A copy of the audit input with the plan's changes applied to the channels'
 * overwrites, using the raw `after` data (never labels). Lets callers ask
 * "what would the audit say after this fix?" without touching Discord.
 */
export function simulatePlan(input: AuditInput, plan: FixPlan): AuditInput {
  const raw = (o: OverwriteState): OverwriteLike => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny })
  const channels = input.channels.map((channel) => {
    const mine = plan.changes.filter((c) => c.channelId === channel.id)
    if (mine.length === 0) return channel
    let overwrites: OverwriteLike[] = (channel.permission_overwrites ?? []).map((o) => ({ ...o }))
    for (const change of mine) {
      if (change.op === 'replace-overwrites') {
        overwrites = change.after.map(raw)
      } else if (change.op === 'delete-overwrite') {
        overwrites = overwrites.filter((o) => !(o.id === change.targetId && o.type === change.targetType))
      } else {
        const next = raw(change.after[0]!)
        const index = overwrites.findIndex((o) => o.id === next.id && o.type === next.type)
        if (index >= 0) overwrites[index] = next
        else overwrites.push(next)
      }
    }
    return { ...channel, permission_overwrites: overwrites }
  })
  return { ...input, channels }
}
