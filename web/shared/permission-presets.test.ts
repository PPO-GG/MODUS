import { describe, expect, it } from 'vitest'
import {
  MAX_PRESET_CHANNELS,
  MAX_ROLES_PER_SLOT,
  PRESETS,
  channelKind,
  getPreset,
  kindAllowed,
  validatePresetRequest,
} from './permission-presets'

describe('presets', () => {
  it('ships exactly the two v1 presets', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['read-only', 'private-to-roles'])
  })

  it('getPreset finds known ids and returns null for anything else', () => {
    expect(getPreset('read-only')!.label).toBe('Read-only')
    expect(getPreset('private-to-roles')!.slots.map((s) => s.key)).toEqual(['allowed'])
    expect(getPreset('constructor')).toBeNull()
    expect(getPreset(undefined)).toBeNull()
  })

  it('channelKind maps Discord channel types and rejects the rest', () => {
    expect(channelKind(0)).toBe('text')
    expect(channelKind(5)).toBe('text')
    expect(channelKind(2)).toBe('voice')
    expect(channelKind(4)).toBe('category')
    expect(channelKind(13)).toBeNull()
    expect(channelKind(15)).toBeNull()
  })

  it('kindAllowed follows each preset', () => {
    const readOnly = getPreset('read-only')!
    const priv = getPreset('private-to-roles')!
    expect(kindAllowed(readOnly, 0)).toBe(true)
    expect(kindAllowed(readOnly, 4)).toBe(true)
    expect(kindAllowed(readOnly, 2)).toBe(false)
    expect(kindAllowed(priv, 2)).toBe(true)
    expect(kindAllowed(priv, 15)).toBe(false)
  })

  it('Read-only: @everyone is denied posting and never granted View Channel; the posters slot may be empty', () => {
    const preset = getPreset('read-only')!
    expect(preset.slots).toEqual([{ key: 'posters', label: 'Roles that can post', min: 0, max: MAX_ROLES_PER_SLOT }])
    const [everyone, posters] = preset.specs('text')
    expect(everyone).toEqual({
      slotKey: null,
      allow: [],
      deny: ['SendMessages', 'AddReactions', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'],
    })
    expect(posters).toEqual({
      slotKey: 'posters',
      allow: ['SendMessages', 'AddReactions', 'SendMessagesInThreads', 'CreatePublicThreads'],
      deny: [],
    })
    expect(preset.specs('category')).toEqual(preset.specs('text'))
    for (const spec of preset.specs('text')) expect(spec.allow).not.toContain('ViewChannel')
  })

  it('Private to roles: @everyone loses View Channel; allowed roles get kind-specific permissions', () => {
    const preset = getPreset('private-to-roles')!
    expect(preset.slots).toEqual([{ key: 'allowed', label: 'Roles with access', min: 1, max: MAX_ROLES_PER_SLOT }])
    const allowFor = (kind: 'text' | 'voice' | 'category') =>
      preset.specs(kind).find((s) => s.slotKey === 'allowed')!.allow
    expect(preset.specs('text')[0]).toEqual({ slotKey: null, allow: [], deny: ['ViewChannel'] })
    expect(allowFor('text')).toEqual(['ViewChannel', 'SendMessages', 'ReadMessageHistory'])
    expect(allowFor('voice')).toEqual(['ViewChannel', 'Connect', 'Speak'])
    expect(allowFor('category')).toEqual(['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'Connect', 'Speak'])
  })
})

describe('validatePresetRequest', () => {
  const ok = (over: Record<string, unknown> = {}) => ({
    preset_id: 'read-only',
    slots: { posters: ['601'] },
    channel_ids: ['111', '222'],
    ...over,
  })

  it('accepts a valid request and normalizes it (deduped, camelCase)', () => {
    const result = validatePresetRequest(ok({ slots: { posters: ['601', '601', '602'] }, channel_ids: ['111', '111', '222'] }))
    expect(result).toEqual({
      ok: true,
      req: { presetId: 'read-only', slots: { posters: ['601', '602'] }, channelIds: ['111', '222'] },
    })
  })

  it('treats a missing optional slot as empty when its minimum is 0, and rejects it when the minimum is 1', () => {
    expect(validatePresetRequest(ok({ slots: undefined }))).toMatchObject({ ok: true, req: { slots: { posters: [] } } })
    const result = validatePresetRequest(ok({ preset_id: 'private-to-roles', slots: {} }))
    expect(result).toEqual({ ok: false, error: 'Choose at least 1 role for "Roles with access".' })
  })

  it('rejects bad shapes with a message', () => {
    for (const body of [null, undefined, 'x', [], 5]) {
      expect(validatePresetRequest(body)).toEqual({ ok: false, error: 'Invalid request.' })
    }
    expect(validatePresetRequest(ok({ preset_id: 'nope' }))).toEqual({ ok: false, error: 'Choose a preset.' })
    expect(validatePresetRequest(ok({ preset_id: undefined }))).toEqual({ ok: false, error: 'Choose a preset.' })
    expect(validatePresetRequest(ok({ slots: 'x' }))).toEqual({ ok: false, error: 'Invalid role selection.' })
    expect(validatePresetRequest(ok({ slots: { bogus: ['1'] } }))).toEqual({ ok: false, error: 'Unknown role slot "bogus".' })
    expect(validatePresetRequest(ok({ slots: { posters: ['abc'] } }))).toEqual({ ok: false, error: 'Invalid roles for "Roles that can post".' })
    expect(validatePresetRequest(ok({ slots: { posters: 'x' } }))).toEqual({ ok: false, error: 'Invalid roles for "Roles that can post".' })
    expect(validatePresetRequest(ok({ channel_ids: 'x' }))).toEqual({ ok: false, error: 'Invalid channel selection.' })
    expect(validatePresetRequest(ok({ channel_ids: ['../1'] }))).toEqual({ ok: false, error: 'Invalid channel selection.' })
    expect(validatePresetRequest(ok({ channel_ids: [] }))).toEqual({ ok: false, error: 'Choose at least one channel.' })
  })

  it('enforces the per-slot role cap and the channel cap', () => {
    const roles = Array.from({ length: MAX_ROLES_PER_SLOT + 1 }, (_, i) => String(100 + i))
    expect(validatePresetRequest(ok({ slots: { posters: roles } }))).toEqual({
      ok: false,
      error: `Choose at most ${MAX_ROLES_PER_SLOT} roles for "Roles that can post".`,
    })
    const channels = Array.from({ length: MAX_PRESET_CHANNELS + 1 }, (_, i) => String(1000 + i))
    expect(validatePresetRequest(ok({ channel_ids: channels }))).toEqual({
      ok: false,
      error: `Choose at most ${MAX_PRESET_CHANNELS} channels at a time.`,
    })
    expect(validatePresetRequest(ok({ channel_ids: channels.slice(0, MAX_PRESET_CHANNELS) })).ok).toBe(true)
  })
})
