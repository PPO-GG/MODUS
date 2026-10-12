import { parseBits, type ChannelLike, type OverwriteLike } from '../../../shared/discord-permissions'
import {
  MAX_ACCESS_CHANGES,
  SEE_BITS,
  channelKind,
  managedBits,
  postBits,
  type AccessEdit,
  type AccessRule,
  type ChannelKind,
} from '../../../shared/channel-access'
import type { AccessStats, FixChange, OverwriteState } from '../../../shared/permission-audit-types'
import { hashPlan, overwriteState } from './fixes'
import type { AuditInput, PlanDerivation, PlanSource } from './types'

const ZERO = BigInt(0)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const byIdType = (a: { id: string; type: number }, b: { id: string; type: number }) =>
  a.type - b.type || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Raw, order-independent form of an overwrite list (names never enter it). */
const canonical = (ows: readonly OverwriteLike[]): string =>
  JSON.stringify(
    [...ows].sort(byIdType).map((o) => [o.id, o.type, parseBits(o.allow).toString(), parseBits(o.deny).toString()]),
  )

const sortedStates = (input: AuditInput, ows: readonly OverwriteLike[]): OverwriteState[] =>
  [...ows].sort(byIdType).map((o) => overwriteState(input, o))

/** Discord's definition of "synced": the child's overwrite list equals the parent's exactly. */
export function isSyncedWith(child: ChannelLike, parent: ChannelLike): boolean {
  return canonical(child.permission_overwrites ?? []) === canonical(parent.permission_overwrites ?? [])
}

interface Reconciled {
  changes: FixChange[]
  /** The channel's full overwrite list once the changes are applied (members untouched). */
  after: OverwriteLike[]
}

/**
 * The writes that make one channel's role overwrites say exactly what the rule
 * says, on the managed bits only. The bot needs View on the channel for every
 * write, so the order keeps anything that could take its View away last:
 *   1. set on non-bot roles
 *   2. set on bot roles that end up allowing View (the bot keeps View before @everyone is denied)
 *   3. delete on non-bot roles
 *   4. the @everyone change (set or delete), which may deny View
 *   5. set on bot roles that end up without a View allow, then delete on bot roles
 * Nothing before step 4 can reduce the bot's access.
 */
function reconcile(input: AuditInput, channel: ChannelLike, kind: ChannelKind, rule: AccessRule): Reconciled {
  const mb = managedBits(kind)
  const pb = postBits(kind)
  const existing = channel.permission_overwrites ?? []
  const seeRoles = rule.see.kind === 'roles' ? rule.see.roleIds : []
  const postRoles = rule.post.kind === 'roles' ? rule.post.roleIds : []
  const targets = [
    ...new Set([input.guildId, ...seeRoles, ...postRoles, ...existing.filter((o) => o.type === 0).map((o) => o.id)]),
  ].sort()

  const botRoles = input.bot.roleIds
  const roleSets: FixChange[] = []
  const botViewSets: FixChange[] = []
  const roleDeletes: FixChange[] = []
  let everyoneChange: FixChange | null = null
  const botLateSets: FixChange[] = []
  const botDeletes: FixChange[] = []
  const after: OverwriteLike[] = existing.filter((o) => o.type === 1).map((o) => ({ ...o }))

  for (const id of targets) {
    const current = existing.find((o) => o.type === 0 && o.id === id)
    const currentAllow = parseBits(current?.allow)
    const currentDeny = parseBits(current?.deny)
    let allow = currentAllow & ~mb
    let deny = currentDeny & ~mb
    if (id === input.guildId) {
      if (rule.see.kind === 'roles') deny |= SEE_BITS
      if (rule.post.kind !== 'everyone') deny |= pb
    } else {
      if (seeRoles.includes(id)) allow |= SEE_BITS
      if (postRoles.includes(id)) allow |= pb
    }
    // Unchanged: keep it verbatim (even a 0/0 one), so a synced child's copy still equals the category.
    if (allow === currentAllow && deny === currentDeny) {
      if (current) after.push({ ...current })
      continue
    }
    const empty = allow === ZERO && deny === ZERO
    if (!empty) after.push({ id, type: 0, allow: allow.toString(), deny: deny.toString() })
    const isBot = botRoles.includes(id)

    const base = {
      channelId: channel.id,
      channelName: channel.name,
      targetId: id,
      targetType: 0 as const,
      before: current ? [overwriteState(input, current)] : [],
    }
    if (empty) {
      if (!current) continue
      const change: FixChange = { ...base, op: 'delete-overwrite', after: [] }
      if (id === input.guildId) everyoneChange = change
      else if (isBot) botDeletes.push(change)
      else roleDeletes.push(change)
      continue
    }
    const change: FixChange = {
      ...base,
      op: 'set-overwrite',
      after: [overwriteState(input, { id, type: 0, allow, deny })],
    }
    if (id === input.guildId) everyoneChange = change
    else if (!isBot) roleSets.push(change)
    else if ((allow & SEE_BITS) === SEE_BITS) botViewSets.push(change)
    else botLateSets.push(change)
  }
  return {
    changes: [
      ...roleSets,
      ...botViewSets,
      ...roleDeletes,
      ...(everyoneChange ? [everyoneChange] : []),
      ...botLateSets,
      ...botDeletes,
    ],
    after,
  }
}

const ruleKey = (rule: AccessRule) => [
  rule.see.kind,
  rule.see.kind === 'roles' ? [...rule.see.roleIds].sort() : [],
  rule.post.kind,
  rule.post.kind === 'roles' ? [...rule.post.roleIds].sort() : [],
]

/**
 * The plan for a set of channel access edits. Pure. Request shape is assumed
 * valid (validateAccessRequest); everything that depends on Discord's current
 * state is checked here and reported as `problems` with a null plan.
 */
export function planAccess(input: AuditInput, edits: AccessEdit[]): PlanDerivation {
  const problems: string[] = []
  const roleIds = new Set(input.roles.map((r) => r.id))
  const byChannel = new Map(edits.map((e) => [e.channelId, e.rule]))
  const known = new Map(input.channels.map((c) => [c.id, c]))

  const missing = edits.filter((e) => !known.has(e.channelId)).length
  if (missing > 0) problems.push(`${plural(missing, 'edited channel')} no longer exist${missing === 1 ? 's' : ''}.`)
  for (const { channelId, rule } of edits) {
    const channel = known.get(channelId)
    if (!channel) continue
    if (!channelKind(channel.type)) problems.push(`#${channel.name} is not a channel type Channel Access supports.`)
    const seers = rule.see.kind === 'roles' ? rule.see.roleIds : []
    const posters = rule.post.kind === 'roles' ? rule.post.roleIds : []
    const ids = [...seers, ...posters]
    if (ids.includes(input.guildId)) problems.push(`@everyone can't be used as a role in #${channel.name}.`)
    else if (ids.some((id) => !roleIds.has(id))) problems.push(`A role chosen for #${channel.name} no longer exists.`)
    if (rule.see.kind === 'roles' && posters.some((id) => !seers.includes(id))) {
      problems.push(`In #${channel.name}, roles that can post must also be able to see it.`)
    }
  }
  if (problems.length > 0) return { plan: null, problems }

  const changes: FixChange[] = []
  const changed = new Set<string>()
  let cascaded = 0
  // Guild order, so the plan does not depend on the order the request listed edits in.
  for (const channel of input.channels) {
    const rule = byChannel.get(channel.id)
    if (!rule) continue
    const kind = channelKind(channel.type)!
    const result = reconcile(input, channel, kind, rule)
    changes.push(...result.changes)
    if (result.changes.length > 0) changed.add(channel.id)
    if (kind !== 'category') continue

    // Synced children of any type follow the category by a byte-for-byte copy,
    // so Discord keeps showing them as synced. A child with its own edit is skipped.
    for (const child of input.channels) {
      if (child.parent_id !== channel.id || child.type === 4 || byChannel.has(child.id)) continue
      if (!isSyncedWith(child, channel)) continue
      cascaded += 1
      if (result.changes.length === 0) continue
      changes.push({
        channelId: child.id,
        channelName: child.name,
        op: 'replace-overwrites',
        before: sortedStates(input, child.permission_overwrites ?? []),
        after: sortedStates(input, result.after),
      })
      changed.add(child.id)
    }
  }

  const stats: AccessStats = {
    channels: edits.length,
    cascaded,
    changed: changed.size,
    unchanged: edits.length + cascaded - changed.size,
    changes: changes.length,
  }
  if (changes.length === 0) return { plan: null, problems: ['Every edited channel already matches its rule.'], stats }
  if (changes.length > MAX_ACCESS_CHANGES) {
    return {
      plan: null,
      problems: [`This would make ${changes.length} changes, and the limit is ${MAX_ACCESS_CHANGES}. Edit fewer channels at a time.`],
      stats,
    }
  }

  const findingId = `access:${edits.length}`
  const canonicalEdits = [...edits]
    .sort((a, b) => (a.channelId < b.channelId ? -1 : a.channelId > b.channelId ? 1 : 0))
    .map((e) => [e.channelId, ruleKey(e.rule)])
  return {
    plan: {
      findingId,
      summary: `Change who can see and post in ${plural(changed.size, 'channel')}`,
      changes,
      hash: hashPlan(findingId, changes, { e: canonicalEdits }),
    },
    problems: [],
    stats,
  }
}

export const accessPlanSource =
  (edits: AccessEdit[]): PlanSource =>
  (input) =>
    planAccess(input, edits)
