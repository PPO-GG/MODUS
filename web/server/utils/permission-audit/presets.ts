import { PERMISSION_BITS, parseBits, type PermissionName } from '../../../shared/discord-permissions'
import type { FixChange } from '../../../shared/permission-audit-types'
import {
  MAX_PRESET_CHANGES,
  channelKind,
  getPreset,
  type PresetRequest,
} from '../../../shared/permission-presets'
import { hashPlan, overwriteState } from './fixes'
import type { AuditInput, PlanDerivation, PlanSource } from './types'

const ZERO = BigInt(0)

const bitsOf = (names: readonly PermissionName[]): bigint =>
  names.reduce((acc, name) => acc | PERMISSION_BITS[name], ZERO)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The plan for applying a preset to the selected channels, merged into each
 * channel's existing overwrites bit by bit: only the bits the preset names, on
 * @everyone and the slot roles, change. Pure; the request is assumed to have
 * passed validatePresetRequest, while everything that depends on Discord's
 * current state (roles and channels still exist, channel types fit) is
 * checked here and reported as `problems` with a null plan.
 */
export function planPreset(input: AuditInput, req: PresetRequest): PlanDerivation {
  const preset = getPreset(req.presetId)
  if (!preset) return { plan: null, problems: ['Unknown preset.'] }

  const problems: string[] = []

  const roleIds = new Set(input.roles.map((r) => r.id))
  const slotRoles: Record<string, string[]> = {}
  const claimedBy = new Map<string, string>()
  for (const slot of preset.slots) {
    const ids = [...new Set(req.slots[slot.key] ?? [])].sort()
    for (const id of ids) {
      if (id === input.guildId) problems.push(`@everyone can't be chosen for "${slot.label}".`)
      else if (!roleIds.has(id)) problems.push(`A role chosen for "${slot.label}" no longer exists.`)
      else if (claimedBy.has(id)) {
        problems.push(`The same role can't be used for both "${claimedBy.get(id)}" and "${slot.label}".`)
      } else claimedBy.set(id, slot.label)
    }
    slotRoles[slot.key] = ids
  }

  const selected = [...new Set(req.channelIds)]
  const known = new Set(input.channels.map((c) => c.id))
  const missing = selected.filter((id) => !known.has(id)).length
  if (missing > 0) problems.push(`${plural(missing, 'selected channel')} no longer exist${missing === 1 ? 's' : ''}.`)

  // Guild order, so the plan does not depend on the order the request listed them in.
  const channels = input.channels.filter((c) => selected.includes(c.id))
  for (const channel of channels) {
    const kind = channelKind(channel.type)
    if (!kind || !preset.kinds.includes(kind)) {
      problems.push(`#${channel.name} is not a channel type the "${preset.label}" preset supports.`)
    }
  }
  if (problems.length > 0) return { plan: null, problems }

  const changes: FixChange[] = []
  const changedChannels = new Set<string>()
  for (const channel of channels) {
    const kind = channelKind(channel.type)!
    // Slot-role grants land before the @everyone change: denying @everyone View
    // first would hide the channel from the bot and Discord would refuse the
    // writes that follow it.
    const specs = preset.specs(kind)
    const ordered = [...specs.filter((spec) => spec.slotKey !== null), ...specs.filter((spec) => spec.slotKey === null)]
    for (const spec of ordered) {
      const targets = spec.slotKey === null ? [input.guildId] : (slotRoles[spec.slotKey] ?? [])
      const specAllow = bitsOf(spec.allow)
      const specDeny = bitsOf(spec.deny)
      for (const targetId of targets) {
        const existing = (channel.permission_overwrites ?? []).find((o) => o.type === 0 && o.id === targetId)
        const allow = parseBits(existing?.allow)
        const deny = parseBits(existing?.deny)
        const newAllow = (allow | specAllow) & ~specDeny
        const newDeny = (deny | specDeny) & ~specAllow
        if (newAllow === allow && newDeny === deny) continue
        changes.push({
          channelId: channel.id,
          channelName: channel.name,
          op: 'set-overwrite',
          targetId,
          targetType: 0,
          before: existing ? [overwriteState(input, existing)] : [],
          after: [overwriteState(input, { id: targetId, type: 0, allow: newAllow, deny: newDeny })],
        })
        changedChannels.add(channel.id)
      }
    }
  }

  const stats = {
    channels: channels.length,
    changed: changedChannels.size,
    unchanged: channels.length - changedChannels.size,
    changes: changes.length,
  }
  if (changes.length === 0) {
    return { plan: null, problems: ['Every selected channel already matches this preset.'], stats }
  }
  if (changes.length > MAX_PRESET_CHANGES) {
    return {
      plan: null,
      problems: [
        `This would make ${changes.length} changes, and the limit is ${MAX_PRESET_CHANGES}. Choose fewer channels or roles.`,
      ],
      stats,
    }
  }

  const findingId = `preset:${preset.id}`
  return {
    plan: {
      findingId,
      summary: `Apply "${preset.label}" to ${plural(stats.changed, 'channel')}`,
      changes,
      hash: hashPlan(findingId, changes, {
        s: preset.slots.map((slot) => [slot.key, slotRoles[slot.key]]),
        c: [...selected].sort(),
      }),
    },
    problems: [],
    stats,
  }
}

export const presetPlanSource =
  (req: PresetRequest): PlanSource =>
  (input) =>
    planPreset(input, req)
