/**
 * Channel access rules: the two-field model (who can see, who can post) the
 * Channel Access editor uses, the permission bits behind each field per
 * channel kind, the classifier that reads a rule back out of a channel's
 * overwrites, and the request validation shared by the routes and the page.
 * Isomorphic — no side effects, relative imports only.
 */
import {
  PERMISSION_BITS,
  hasPermission,
  parseBits,
  type OverwriteLike,
  type PermissionName,
  type RoleLike,
} from './discord-permissions'

export type ChannelKind = 'text' | 'voice' | 'category'
export type Visibility = { kind: 'everyone' } | { kind: 'roles'; roleIds: string[] }
export type Posting = { kind: 'everyone' } | { kind: 'roles'; roleIds: string[] } | { kind: 'nobody' }
export interface AccessRule {
  see: Visibility
  post: Posting
}
export interface AccessEdit {
  channelId: string
  rule: AccessRule
}

/** Directly edited channels per apply (400 above). */
export const MAX_ACCESS_EDITS = 60
/** Writes in one plan (a preview blocker above). */
export const MAX_ACCESS_CHANGES = 250
export const MAX_ROLES_PER_RULE = 25

const ZERO = BigInt(0)

export function channelKind(type: number): ChannelKind | null {
  if (type === 0 || type === 5) return 'text'
  if (type === 2) return 'voice'
  if (type === 4) return 'category'
  return null
}

const TEXT_POST: PermissionName[] = [
  'SendMessages',
  'SendMessagesInThreads',
  'CreatePublicThreads',
  'CreatePrivateThreads',
  'AddReactions',
]
const VOICE_POST: PermissionName[] = ['Connect', 'Speak']
const bitsOf = (names: readonly PermissionName[]): bigint =>
  names.reduce((acc, name) => acc | PERMISSION_BITS[name], ZERO)

export const SEE_BITS: bigint = PERMISSION_BITS.ViewChannel

/** The "who can post / speak" bits for a channel kind; a category manages both sets. */
export function postBits(kind: ChannelKind): bigint {
  if (kind === 'text') return bitsOf(TEXT_POST)
  if (kind === 'voice') return bitsOf(VOICE_POST)
  return bitsOf(TEXT_POST) | bitsOf(VOICE_POST)
}

/** Every bit the editor reads or writes for this kind. All other bits are preserved. */
export function managedBits(kind: ChannelKind): bigint {
  return SEE_BITS | postBits(kind)
}

export const isAdminRole = (role: RoleLike): boolean =>
  hasPermission(parseBits(role.permissions), 'Administrator')

const names = (ids: readonly string[], roles: readonly RoleLike[]): string[] =>
  ids.map((id) => roles.find((r) => r.id === id)?.name ?? `role ${id}`)
const list = (xs: readonly string[]) => xs.join(', ')

export function describeSee(see: Visibility, roles: readonly RoleLike[]): string {
  if (see.kind === 'everyone') return 'Everyone'
  if (see.roleIds.length === 0) return 'Nobody'
  return `Only ${list(names(see.roleIds, roles))}`
}

export function describePost(post: Posting, roles: readonly RoleLike[]): string {
  if (post.kind === 'everyone') return 'Everyone who can see'
  if (post.kind === 'nobody') return 'Read-only'
  return `Only ${list(names(post.roleIds, roles))}`
}

export interface ClassifiedAccess {
  /** null = Custom: the overwrites do not fit the two-field model. */
  rule: AccessRule | null
  /** Each field on its own; null only when that field cannot be expressed. */
  see: Visibility | null
  post: Posting | null
  /** Badge text. Derived from the rule, or best effort for Custom. */
  seeSummary: string
  postSummary: string
  memberOverrides: number
}

/**
 * Read a rule back out of a channel's role overwrites. "At least the kind's
 * bits": a text child synced to a category carries the category's union of
 * text and voice bits and must still read as the same rule. Member overwrites
 * are counted, never interpreted.
 */
export function classifyChannel(
  overwrites: readonly OverwriteLike[],
  kind: ChannelKind,
  guildId: string,
  roles: readonly RoleLike[],
): ClassifiedAccess {
  const roleOws = overwrites.filter((o) => o.type === 0 && o.id !== guildId)
  const everyone = overwrites.find((o) => o.type === 0 && o.id === guildId)
  const everyoneDeny = parseBits(everyone?.deny)
  const memberOverrides = overwrites.filter((o) => o.type === 1).length
  const pb = postBits(kind)

  let see: Visibility | null
  let seeSummary: string
  if ((everyoneDeny & SEE_BITS) === SEE_BITS) {
    see = { kind: 'roles', roleIds: roleOws.filter((o) => (parseBits(o.allow) & SEE_BITS) === SEE_BITS).map((o) => o.id) }
    seeSummary = describeSee(see, roles)
  } else {
    const hidden = roleOws.filter((o) => (parseBits(o.deny) & SEE_BITS) === SEE_BITS).map((o) => o.id)
    if (hidden.length === 0) {
      see = { kind: 'everyone' }
      seeSummary = 'Everyone'
    } else {
      see = null
      seeSummary = `Everyone except ${list(names(hidden, roles))}`
    }
  }

  let post: Posting | null
  let postSummary: string
  const everyoneDenied = everyoneDeny & pb
  if (everyoneDenied === pb) {
    const partial = roleOws.some((o) => {
      const allowed = parseBits(o.allow) & pb
      return allowed !== ZERO && allowed !== pb
    })
    const full = roleOws.filter((o) => (parseBits(o.allow) & pb) === pb).map((o) => o.id)
    if (partial) {
      post = null
      postSummary = 'Partly restricted'
    } else if (full.length === 0) {
      post = { kind: 'nobody' }
      postSummary = 'Read-only'
    } else {
      post = { kind: 'roles', roleIds: full }
      postSummary = describePost(post, roles)
    }
  } else if (everyoneDenied === ZERO) {
    const muted = roleOws.filter((o) => (parseBits(o.deny) & pb) !== ZERO).map((o) => o.id)
    if (muted.length === 0) {
      post = { kind: 'everyone' }
      postSummary = 'Everyone who can see'
    } else {
      post = null
      postSummary = `Everyone except ${list(names(muted, roles))}`
    }
  } else {
    post = null
    postSummary = 'Partly restricted'
  }

  if (see?.kind === 'roles' && post?.kind === 'roles') {
    const seers = see.roleIds
    if (post.roleIds.some((id) => !seers.includes(id))) {
      // Posters that cannot see the channel: not something the editor can say.
      return { rule: null, see, post: null, seeSummary, postSummary: `${postSummary} (some can't see it)`, memberOverrides }
    }
  }
  return { rule: see && post ? { see, post } : null, see, post, seeSummary, postSummary, memberOverrides }
}

// ── Request validation ──────────────────────────────────────────────────

const SNOWFLAKE = /^\d{1,25}$/
const fail = (error: string) => ({ ok: false as const, error })
const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string' && SNOWFLAKE.test(id))
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseRoleList(
  raw: unknown,
  field: string,
  guildId: string,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!isIdList(raw)) return fail(`Invalid roles for "${field}".`)
  const ids = [...new Set(raw)].sort()
  if (ids.length === 0) return fail(`Choose at least one role for "${field}".`)
  if (ids.length > MAX_ROLES_PER_RULE) return fail(`Choose at most ${MAX_ROLES_PER_RULE} roles for "${field}".`)
  if (ids.includes(guildId)) return fail(`@everyone can't be chosen for "${field}".`)
  return { ok: true, ids }
}

/** Shape, id format and count checks for one rule. Whether the roles exist is decided against fresh Discord data. */
export function validateAccessRule(
  raw: unknown,
  guildId: string,
): { ok: true; rule: AccessRule } | { ok: false; error: string } {
  if (!isObject(raw) || !isObject(raw.see) || !isObject(raw.post)) return fail('Invalid rule.')

  let see: Visibility
  if (raw.see.kind === 'everyone') see = { kind: 'everyone' }
  else if (raw.see.kind === 'roles') {
    const parsed = parseRoleList(raw.see.roleIds, 'Who can see', guildId)
    if (!parsed.ok) return parsed
    see = { kind: 'roles', roleIds: parsed.ids }
  } else return fail('Invalid "Who can see" choice.')

  let post: Posting
  if (raw.post.kind === 'everyone') post = { kind: 'everyone' }
  else if (raw.post.kind === 'nobody') post = { kind: 'nobody' }
  else if (raw.post.kind === 'roles') {
    const parsed = parseRoleList(raw.post.roleIds, 'Who can post', guildId)
    if (!parsed.ok) return parsed
    post = { kind: 'roles', roleIds: parsed.ids }
  } else return fail('Invalid "Who can post" choice.')

  if (see.kind === 'roles' && post.kind === 'roles') {
    const seers = see.roleIds
    if (post.roleIds.some((id) => !seers.includes(id))) {
      return fail('Roles that can post must also be able to see the channel.')
    }
  }
  return { ok: true, rule: { see, post } }
}

/**
 * Validate the body the access routes use: `{ guild_id, edits: [{ channel_id, rule }] }`.
 * Request-only checks; existence of channels and roles is the planner's job.
 */
export function validateAccessRequest(
  body: unknown,
): { ok: true; guildId: string; edits: AccessEdit[] } | { ok: false; error: string } {
  if (!isObject(body)) return fail('Invalid request.')
  const guildId = typeof body.guild_id === 'string' ? body.guild_id : ''
  if (!SNOWFLAKE.test(guildId)) return fail('Missing or invalid guild_id.')
  if (!Array.isArray(body.edits) || body.edits.length === 0) return fail('Edit at least one channel.')
  if (body.edits.length > MAX_ACCESS_EDITS) return fail(`Edit at most ${MAX_ACCESS_EDITS} channels at a time.`)

  const edits: AccessEdit[] = []
  const seen = new Set<string>()
  for (const raw of body.edits) {
    if (!isObject(raw) || typeof raw.channel_id !== 'string' || !SNOWFLAKE.test(raw.channel_id)) {
      return fail('Invalid channel id.')
    }
    if (seen.has(raw.channel_id)) return fail('A channel appears more than once.')
    seen.add(raw.channel_id)
    const rule = validateAccessRule(raw.rule, guildId)
    if (!rule.ok) return rule
    edits.push({ channelId: raw.channel_id, rule: rule.rule })
  }
  return { ok: true, guildId, edits }
}

// ── Response shapes (types only) ────────────────────────────────────────

export interface AccessRoleOption {
  id: string
  name: string
  managed: boolean
  position: number
  admin: boolean
}

export interface ChannelAccessState {
  id: string
  name: string
  /** Discord channel type. */
  type: number
  parentId: string | null
  position: number
  /** null = a type the editor cannot edit (forum, stage, …); shown greyed out. */
  kind: ChannelKind | null
  /** null = Custom. */
  rule: AccessRule | null
  /** Per field; null only when that field is Custom. */
  see: Visibility | null
  post: Posting | null
  seeSummary: string
  postSummary: string
  memberOverrides: number
  /** null when the channel has no parent category. */
  syncedWithParent: boolean | null
}

export interface AccessStateResponse {
  roles: AccessRoleOption[]
  botTopPosition: number | null
  botRoleIds: string[]
  botAdmin: boolean
  channels: ChannelAccessState[]
}
