import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PresetPreview } from '#shared/permission-audit-types'
import { groupChannels, usePermissionPresets, type ChannelOption } from './usePermissionPresets'

afterEach(() => vi.unstubAllGlobals())

const ch = (id: string, name: string, type: number, position: number, parentId: string | null = null): ChannelOption => ({
  id, name, type, position, parentId,
})

describe('groupChannels', () => {
  it('puts uncategorized channels first, then each category (itself first, then its children) in position order', () => {
    const groups = groupChannels([
      ch('t2', 'rules', 0, 1, 'cat2'),
      ch('cat2', 'Info', 4, 5),
      ch('t1', 'general', 0, 0),
      ch('cat1', 'Staff', 4, 2),
      ch('v1', 'Lounge', 2, 3, 'cat1'),
      ch('t3', 'mods', 0, 4, 'cat1'),
    ])
    expect(groups.map((g) => g.category?.id ?? null)).toEqual([null, 'cat1', 'cat2'])
    expect(groups[0]!.channels.map((c) => c.id)).toEqual(['t1'])
    expect(groups[1]!.channels.map((c) => c.id)).toEqual(['v1', 't3'])
    expect(groups[2]!.channels.map((c) => c.id)).toEqual(['t2'])
  })

  it('treats a channel whose category is missing as uncategorized, and returns [] for no channels', () => {
    expect(groupChannels([ch('t1', 'a', 0, 0, 'ghost')])[0]!.channels.map((c) => c.id)).toEqual(['t1'])
    expect(groupChannels([])).toEqual([])
  })
})

const roles = { roles: [{ id: '601', name: 'Staff', color: 0, position: 3, managed: false, permissions: '0' }], botTopPosition: 5 }
const channels = {
  channels: [
    { id: 'c1', name: 'general', type: 0, position: 0, parentId: null },
    { id: 'v1', name: 'Lounge', type: 2, position: 1, parentId: null },
    { id: 'cat', name: 'Info', type: 4, position: 2, parentId: null },
  ],
  categories: [],
}
const preview = (over: Partial<PresetPreview> = {}): PresetPreview => ({
  plan: { findingId: 'preset:read-only', summary: 'Apply', changes: [], hash: 'h'.repeat(64) },
  canApply: true,
  blockers: [],
  stats: { channels: 1, changed: 1, unchanged: 0, changes: 2 },
  ...over,
})

describe('usePermissionPresets options and selection', () => {
  it('loads roles and channels and exposes the bot top position', async () => {
    const fetchMock = vi.fn(async (url: string) => (url.startsWith('/api/discord/roles') ? roles : channels))
    vi.stubGlobal('$fetch', fetchMock)
    const p = usePermissionPresets('12345')
    await p.loadOptions()
    expect(fetchMock).toHaveBeenCalledWith('/api/discord/roles?guild_id=12345')
    expect(fetchMock).toHaveBeenCalledWith('/api/discord/channels?guild_id=12345&types=text,voice,category')
    expect(p.roles.value).toEqual([{ id: '601', name: 'Staff', managed: false, position: 3 }])
    expect(p.botTopPosition.value).toBe(5)
    expect(p.channels.value.map((c) => c.id)).toEqual(['c1', 'v1', 'cat'])
    expect(p.optionsLoading.value).toBe(false)
    expect(p.optionsError.value).toBeNull()
  })

  it('surfaces a load error', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw { data: { statusMessage: 'Bot is not in this server' } } }))
    const p = usePermissionPresets('12345')
    await p.loadOptions()
    expect(p.optionsError.value).toBe('Bot is not in this server')
    expect(p.optionsLoading.value).toBe(false)
  })

  it('filters eligible channels by preset, and switching preset clears slots and drops ineligible channels', async () => {
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => (url.startsWith('/api/discord/roles') ? roles : channels)))
    const p = usePermissionPresets('12345')
    await p.loadOptions()
    p.setPreset('private-to-roles')
    p.setSlot('allowed', ['601'])
    p.toggleChannel('v1', true)
    p.toggleChannel('c1', true)
    expect(p.eligibleChannels.value.map((c) => c.id)).toEqual(['c1', 'v1', 'cat'])
    p.setPreset('read-only')
    expect(p.slots.value).toEqual({})
    expect(p.eligibleChannels.value.map((c) => c.id)).toEqual(['c1', 'cat'])
    expect(p.channelIds.value).toEqual(['c1'])
  })

  it('re-selecting the already-selected preset keeps the chosen roles; switching to another clears them', () => {
    const p = usePermissionPresets('12345')
    p.setPreset('read-only')
    p.setSlot('posters', ['601'])
    p.setPreset('read-only')
    expect(p.slots.value).toEqual({ posters: ['601'] })
    p.setPreset('private-to-roles')
    expect(p.slots.value).toEqual({})
  })

  it('toggleChannel adds and removes, ignores "indeterminate", and never exceeds the cap', () => {
    const p = usePermissionPresets('12345')
    p.toggleChannel('1', true)
    p.toggleChannel('1', true)
    expect(p.channelIds.value).toEqual(['1'])
    p.toggleChannel('1', false)
    expect(p.channelIds.value).toEqual([])
    p.toggleChannel('2', 'indeterminate')
    expect(p.channelIds.value).toEqual([])
    for (let i = 0; i < 30; i++) p.toggleChannel(String(100 + i), true)
    expect(p.channelIds.value).toHaveLength(25)
  })

  it('validation follows the shared request rules', () => {
    const p = usePermissionPresets('12345')
    expect(p.validation.value).toEqual({ ok: false, error: 'Choose at least one channel.' })
    p.toggleChannel('111', true)
    expect(p.validation.value.ok).toBe(true)
    p.setPreset('private-to-roles')
    expect(p.validation.value).toEqual({ ok: false, error: 'Choose at least 1 role for "Roles with access".' })
    p.setSlot('allowed', ['601'])
    expect(p.validation.value.ok).toBe(true)
  })
})

describe('usePermissionPresets preview and apply', () => {
  const ready = () => {
    const p = usePermissionPresets('12345')
    p.setSlot('posters', ['601'])
    p.toggleChannel('111', true)
    return p
  }

  it('openPreview posts the selection and stores the preview', async () => {
    const fetchMock = vi.fn(async () => preview())
    vi.stubGlobal('$fetch', fetchMock)
    const p = ready()
    await p.openPreview()
    expect(fetchMock).toHaveBeenCalledWith('/api/permissions/preset-preview', {
      method: 'POST',
      body: { guild_id: '12345', preset_id: 'read-only', slots: { posters: ['601'] }, channel_ids: ['111'] },
    })
    expect(p.preview.value).toMatchObject({ open: true, loading: false, error: null })
    expect(p.preview.value.preview!.canApply).toBe(true)
  })

  it('openPreview does nothing when the selection is invalid', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const p = usePermissionPresets('12345')
    await p.openPreview()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(p.preview.value.open).toBe(false)
  })

  it('openPreview shows a preview error and keeps the modal open', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw { data: { statusMessage: 'You need Manage Server' } } }))
    const p = ready()
    await p.openPreview()
    expect(p.preview.value).toMatchObject({ open: true, loading: false, error: 'You need Manage Server', preview: null })
  })

  it('a late preview response cannot touch a modal that was closed or reopened', async () => {
    let rejectFirst!: (e: unknown) => void
    let resolveSecond!: (v: unknown) => void
    let call = 0
    vi.stubGlobal('$fetch', vi.fn(() => {
      call += 1
      return new Promise((resolve, reject) => {
        if (call === 1) rejectFirst = reject
        else resolveSecond = resolve
      })
    }))
    const p = ready()
    const first = p.openPreview()
    const second = p.openPreview()
    rejectFirst({ data: { statusMessage: 'stale failure' } })
    await first
    expect(p.preview.value).toMatchObject({ open: true, loading: true, error: null })
    resolveSecond(preview())
    await second
    expect(p.preview.value).toMatchObject({ loading: false, error: null })
    expect(p.preview.value.preview!.plan!.hash).toBe('h'.repeat(64))

    let rejectLate!: (e: unknown) => void
    vi.stubGlobal('$fetch', vi.fn(() => new Promise((_, reject) => { rejectLate = reject })))
    const q = ready()
    const pending = q.openPreview()
    q.closePreview()
    rejectLate({ data: { statusMessage: 'late' } })
    await pending
    expect(q.preview.value).toMatchObject({ open: false, error: null, loading: false, preview: null })
  })

  it('confirmApply posts the previewed hash, records the result, clears the channel selection and closes', async () => {
    const calls: unknown[][] = []
    vi.stubGlobal('$fetch', vi.fn(async (...args: unknown[]) => {
      calls.push(args)
      return String(args[0]) === '/api/permissions/preset-apply' ? { applied: true, logged: false } : preview()
    }))
    const p = ready()
    await p.openPreview()
    await expect(p.confirmApply()).resolves.toBe(true)
    const post = calls.find((c) => c[0] === '/api/permissions/preset-apply')!
    expect(post[1]).toEqual({
      method: 'POST',
      body: { guild_id: '12345', preset_id: 'read-only', slots: { posters: ['601'] }, channel_ids: ['111'], plan_hash: 'h'.repeat(64) },
    })
    expect(p.lastApply.value).toEqual({ logged: false })
    expect(p.channelIds.value).toEqual([])
    expect(p.preview.value).toMatchObject({ open: false, preview: null, applying: false })
  })

  it('confirmApply refuses when the preview cannot be applied, and a failed apply keeps the modal with the reason', async () => {
    const blocked = vi.fn(async () => preview({ canApply: false, blockers: ['The bot needs Manage Roles to apply this.'] }))
    vi.stubGlobal('$fetch', blocked)
    const p = ready()
    await p.openPreview()
    blocked.mockClear()
    await expect(p.confirmApply()).resolves.toBe(false)
    expect(blocked).not.toHaveBeenCalled()

    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url === '/api/permissions/preset-preview') return preview()
      throw { data: { statusMessage: '1 of 2 changes were applied before it stopped: Discord refused the change' } }
    }))
    const q = ready()
    await q.openPreview()
    await expect(q.confirmApply()).resolves.toBe(false)
    expect(q.preview.value).toMatchObject({ open: true, applying: false })
    expect(q.preview.value.error).toContain('1 of 2 changes were applied')
    expect(q.lastApply.value).toBeNull()
  })
})
