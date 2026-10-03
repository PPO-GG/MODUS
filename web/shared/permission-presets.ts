/**
 * Built-in permission presets: templates of overwrites with role slots. Pure
 * data plus request validation; the merge into a channel's overwrites lives in
 * the server planner (web/server/utils/permission-audit/presets.ts).
 * Isomorphic — no side effects.
 */
import type { PermissionName } from './discord-permissions'

export type PresetId = 'read-only' | 'private-to-roles'
export type ChannelKind = 'text' | 'voice' | 'category'

export const MAX_PRESET_CHANNELS = 25
export const MAX_ROLES_PER_SLOT = 10
/** Upper bound on overwrite writes in one apply (one PUT each). */
export const MAX_PRESET_CHANGES = 100

export interface PresetSlot {
  key: string
  label: string
  min: number
  max: number
}

/** One overwrite a preset sets. `slotKey` null targets @everyone; otherwise every role in that slot. */
export interface OverwriteSpec {
  slotKey: string | null
  allow: PermissionName[]
  deny: PermissionName[]
}

export interface PresetDef {
  id: PresetId
  label: string
  description: string
  slots: PresetSlot[]
  kinds: ChannelKind[]
  specs(kind: ChannelKind): OverwriteSpec[]
}

export interface PresetRequest {
  presetId: PresetId
  /** Slot key → role ids. */
  slots: Record<string, string[]>
  channelIds: string[]
}

export function channelKind(type: number): ChannelKind | null {
  if (type === 0 || type === 5) return 'text'
  if (type === 2) return 'voice'
  if (type === 4) return 'category'
  return null
}

const READ_ONLY: PresetDef = {
  id: 'read-only',
  label: 'Read-only',
  description:
    "Everyone can still see and read, but can't post or react. The roles you pick can post. Never grants View, so it can't expose a channel in a private category.",
  slots: [{ key: 'posters', label: 'Roles that can post', min: 0, max: MAX_ROLES_PER_SLOT }],
  kinds: ['text', 'category'],
  specs: () => [
    {
      slotKey: null,
      allow: [],
      deny: ['SendMessages', 'AddReactions', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'],
    },
    {
      slotKey: 'posters',
      allow: ['SendMessages', 'AddReactions', 'SendMessagesInThreads', 'CreatePublicThreads'],
      deny: [],
    },
  ],
}

const PRIVATE_TO_ROLES: PresetDef = {
  id: 'private-to-roles',
  label: 'Private to roles',
  description:
    'Hidden from everyone. Only the roles you pick can see and use it. Covers staff-only, verified-only and team channels.',
  slots: [{ key: 'allowed', label: 'Roles with access', min: 1, max: MAX_ROLES_PER_SLOT }],
  kinds: ['text', 'voice', 'category'],
  specs: (kind) => [
    { slotKey: null, allow: [], deny: ['ViewChannel'] },
    {
      slotKey: 'allowed',
      allow:
        kind === 'voice'
          ? ['ViewChannel', 'Connect', 'Speak']
          : kind === 'category'
            ? ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'Connect', 'Speak']
            : ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
      deny: [],
    },
  ],
}

/** In display order. */
export const PRESETS: PresetDef[] = [READ_ONLY, PRIVATE_TO_ROLES]

export function getPreset(id: unknown): PresetDef | null {
  return PRESETS.find((p) => p.id === id) ?? null
}

/** True when the preset can be applied to a channel of this Discord channel type. */
export function kindAllowed(preset: PresetDef, channelType: number): boolean {
  const kind = channelKind(channelType)
  return kind !== null && preset.kinds.includes(kind)
}

const SNOWFLAKE = /^\d{1,25}$/
const fail = (error: string) => ({ ok: false as const, error })

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string' && SNOWFLAKE.test(id))

/**
 * Validate the request body the preset routes (and the page) use:
 * `{ preset_id, slots, channel_ids }`. Request-only checks: shapes, id
 * formats, counts. Whether the roles and channels exist is decided later
 * against fresh Discord data.
 */
export function validatePresetRequest(
  body: unknown,
): { ok: true; req: PresetRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('Invalid request.')
  const b = body as Record<string, unknown>

  const preset = getPreset(b.preset_id)
  if (!preset) return fail('Choose a preset.')

  const rawSlots = b.slots === undefined ? {} : b.slots
  if (typeof rawSlots !== 'object' || rawSlots === null || Array.isArray(rawSlots)) {
    return fail('Invalid role selection.')
  }
  for (const key of Object.keys(rawSlots)) {
    if (!preset.slots.some((s) => s.key === key)) return fail(`Unknown role slot "${key}".`)
  }

  const slots: Record<string, string[]> = {}
  for (const slot of preset.slots) {
    const raw = (rawSlots as Record<string, unknown>)[slot.key] ?? []
    if (!isIdList(raw)) return fail(`Invalid roles for "${slot.label}".`)
    const ids = [...new Set(raw)]
    if (ids.length > slot.max) return fail(`Choose at most ${slot.max} roles for "${slot.label}".`)
    if (ids.length < slot.min) {
      return fail(`Choose at least ${slot.min} role${slot.min === 1 ? '' : 's'} for "${slot.label}".`)
    }
    slots[slot.key] = ids
  }

  if (!isIdList(b.channel_ids)) return fail('Invalid channel selection.')
  const channelIds = [...new Set(b.channel_ids)]
  if (channelIds.length === 0) return fail('Choose at least one channel.')
  if (channelIds.length > MAX_PRESET_CHANNELS) {
    return fail(`Choose at most ${MAX_PRESET_CHANNELS} channels at a time.`)
  }

  return { ok: true, req: { presetId: preset.id, slots, channelIds } }
}
