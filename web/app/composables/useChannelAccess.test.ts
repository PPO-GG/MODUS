import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AccessPreview } from '#shared/permission-audit-types'
import type { AccessRule, AccessStateResponse, ChannelAccessState } from '#shared/channel-access'
import { OPEN_RULE, groupChannels, normalizeRule, useChannelAccess } from './useChannelAccess'

afterEach(() => vi.unstubAllGlobals())

const OPEN: AccessRule = { see: { kind: 'everyone' }, post: { kind: 'everyone' } }
const ch = (
  id: string, name: string, type: number, position: number, parentId: string | null = null,
  over: Partial<ChannelAccessState> = {},
): ChannelAccessState => ({
  id, name, type, position, parentId,
  kind: type === 4 ? 'category' : type === 2 ? 'voice' : type === 0 ? 'text' : null,
  rule: OPEN, see: OPEN.see, post: OPEN.post, seeSummary: 'Everyone', postSummary: 'Everyone who can see', memberOverrides: 0,
  syncedWithParent: parentId ? true : null,
  ...over,
})

const snapshot = (): AccessStateResponse => ({
  roles: [
    { id: '801', name: 'Admins', managed: false, position: 4, admin: true },
    { id: '601', name: 'Staff', managed: false, position: 3, admin: false },
    { id: '602', name: 'Members', managed: false, position: 2, admin: false },
  ],
  botTopPosition: 5,
  botRoleIds: ['901'],
  botAdmin: false,
  channels: [
    ch('loose', 'general', 0, 0),
    ch('cat', 'Team', 4, 1),
    ch('t1', 'chat', 0, 2, 'cat'),
    ch('t2', 'own', 0, 3, 'cat', { syncedWithParent: false, rule: null, see: null, post: null, seeSummary: 'Everyone except Muted' }),
    ch('f1', 'forum', 15, 4, 'cat'),
    ch('priv', 'staff-only', 0, 5, null, { rule: null, see: { kind: 'roles', roleIds: ['601'] }, post: null, seeSummary: 'Only Staff', postSummary: 'Partly restricted' }),
  ],
})

const preview = (over: Partial<AccessPreview> = {}): AccessPreview => ({
  plan: { findingId: 'access:1', summary: 'Change', changes: [], hash: 'h'.repeat(64) },
  canApply: true,
  blockers: [],
  stats: { channels: 1, cascaded: 1, changed: 2, unchanged: 0, changes: 3 },
  ...over,
})

async function ready(fetchImpl?: (url: string, opts?: any) => Promise<unknown>) {
  const fetchMock = vi.fn(fetchImpl ?? (async () => snapshot()))
  vi.stubGlobal('$fetch', fetchMock)
  const a = useChannelAccess('12345')
  await a.load()
  return { a, fetchMock }
}

describe('groupChannels', () => {
  it('uncategorized first, then each category with its children in position order', () => {
    const groups = groupChannels([
      { id: 't2', type: 0, parentId: 'cat2', position: 1 },
      { id: 'cat2', type: 4, parentId: null, position: 5 },
      { id: 't1', type: 0, parentId: null, position: 0 },
      { id: 'cat1', type: 4, parentId: null, position: 2 },
      { id: 'v1', type: 2, parentId: 'cat1', position: 3 },
      { id: 'ghost', type: 0, parentId: 'missing', position: 9 },
    ])
    expect(groups.map((g) => g.category?.id ?? null)).toEqual([null, 'cat1', 'cat2'])
    expect(groups[0]!.channels.map((c) => c.id)).toEqual(['t1', 'ghost'])
    expect(groups[1]!.channels.map((c) => c.id)).toEqual(['v1'])
    expect(groupChannels([])).toEqual([])
  })
})

describe('normalizeRule', () => {
  it('drops posters outside the see set and keeps an empty poster list editable', () => {
    expect(normalizeRule({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['601', '602'] } }))
      .toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['601'] } })
    expect(normalizeRule({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['602'] } }))
      .toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: [] } })
    expect(normalizeRule({ see: { kind: 'everyone' }, post: { kind: 'roles', roleIds: ['602'] } }))
      .toEqual({ see: { kind: 'everyone' }, post: { kind: 'roles', roleIds: ['602'] } })
  })
})

describe('useChannelAccess: load and rows', () => {
  it('loads the snapshot and groups rows', async () => {
    const { a, fetchMock } = await ready()
    expect(fetchMock).toHaveBeenCalledWith('/api/permissions/access-state?guild_id=12345')
    expect(a.loading.value).toBe(false)
    expect(a.error.value).toBeNull()
    expect(a.groups.value.map((g) => g.category?.channel.id ?? null)).toEqual([null, 'cat'])
    expect(a.groups.value[1]!.channels.map((r) => r.channel.id)).toEqual(['t1', 't2', 'f1'])
    expect(a.roleById.value['601']!.name).toBe('Staff')
  })

  it('surfaces a load error', async () => {
    const { a } = await ready(async () => { throw { data: { statusMessage: 'Bot is not in this server' } } })
    expect(a.error.value).toBe('Bot is not in this server')
    expect(a.loading.value).toBe(false)
  })

  it('search keeps a category when it or a child matches, and matches role names in rules', async () => {
    const { a } = await ready()
    a.search.value = 'chat'
    expect(a.groups.value.map((g) => g.category?.channel.id ?? null)).toEqual(['cat'])
    expect(a.groups.value[0]!.channels.map((r) => r.channel.id)).toEqual(['t1'])
    a.search.value = 'team'
    expect(a.groups.value[0]!.channels.map((r) => r.channel.id)).toEqual(['t1', 't2', 'f1'])
    a.setRule('loose', { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } })
    a.search.value = 'staff'
    expect(a.groups.value.map((g) => g.category?.channel.id ?? null)).toEqual([null])
  })
})

describe('useChannelAccess: edits and cascade', () => {
  it('setRule marks a row pending; an edited category shows cascade to synced children only', async () => {
    const { a } = await ready()
    const staff: AccessRule = { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } }
    a.setRule('cat', staff)
    const by = Object.fromEntries(a.rows.value.map((r) => [r.channel.id, r]))
    expect(by.cat).toMatchObject({ pending: staff, pendingSource: 'own', cascadeCount: 2 })   // t1 and f1 are synced; t2 is not
    expect(by.t1).toMatchObject({ pending: staff, pendingSource: 'category' })
    expect(by.f1).toMatchObject({ pending: staff, pendingSource: 'category' })
    expect(by.t2).toMatchObject({ pending: null, pendingSource: null })
    expect(a.editCount.value).toBe(1)
    expect(a.cascadeCount.value).toBe(2)
    expect(a.canReview.value).toBe(true)
  })

  it('a child with its own edit is not shown as cascaded, and clearEdit restores it', async () => {
    const { a } = await ready()
    a.setRule('cat', { see: { kind: 'everyone' }, post: { kind: 'nobody' } })
    a.setRule('t1', OPEN_RULE)
    expect(a.rows.value.find((r) => r.channel.id === 't1')).toMatchObject({ pendingSource: 'own' })
    expect(a.rows.value.find((r) => r.channel.id === 'cat')!.cascadeCount).toBe(1)
    a.clearEdit('t1')
    expect(a.rows.value.find((r) => r.channel.id === 't1')).toMatchObject({ pendingSource: 'category' })
    a.clearEdits()
    expect(a.editCount.value).toBe(0)
    expect(a.canReview.value).toBe(false)
  })

  it('setRule normalizes posters to the see set and ignores unsupported channels', async () => {
    const { a } = await ready()
    a.setRule('loose', { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['602'] } })
    expect(a.edits.value.loose).toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: [] } })
    a.setRule('f1', OPEN_RULE)
    expect(a.edits.value.f1).toBeUndefined()
  })

  it('setRule keeps an empty poster list (the page blocks Review, not the composable)', async () => {
    const { a } = await ready()
    a.setRule('loose', { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: [] } })
    expect(a.edits.value.loose).toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: [] } })
    expect(a.canReview.value).toBe(true)
  })

  it('ruleFor: pending edit, else classified rule, else OPEN_RULE for Custom', async () => {
    const { a } = await ready()
    expect(a.ruleFor('t2')).toEqual(OPEN_RULE)
    expect(a.ruleFor('loose')).toEqual(OPEN)
    a.setRule('loose', { see: { kind: 'everyone' }, post: { kind: 'nobody' } })
    expect(a.ruleFor('loose').post).toEqual({ kind: 'nobody' })
  })

  it('ruleFor falls back per field: a Custom channel with known visibility keeps it', async () => {
    const { a } = await ready()
    expect(a.ruleFor('priv')).toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } })
  })

  it('bulk read-only keeps a known visibility and skips rows whose visibility is unknown', async () => {
    const { a } = await ready()
    a.setSelection(['priv', 't2'])
    a.bulk('read-only')
    expect(a.edits.value.priv).toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'nobody' } })
    expect(a.edits.value.t2).toBeUndefined()
  })

  it('bulk actions apply to editable selected rows and build on the current rule', async () => {
    const { a } = await ready()
    a.setRule('loose', { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } })
    a.setSelection(['loose', 't1', 'f1'])
    a.bulk('read-only')
    expect(a.edits.value.loose).toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'nobody' } })
    expect(a.edits.value.t1).toEqual({ see: { kind: 'everyone' }, post: { kind: 'nobody' } })
    expect(a.edits.value.f1).toBeUndefined()
    a.bulk('private', ['602'])
    expect(a.edits.value.t1).toEqual({ see: { kind: 'roles', roleIds: ['602'] }, post: { kind: 'everyone' } })
    a.bulk('open')
    expect(a.edits.value.loose).toEqual(OPEN_RULE)
    a.toggleSelect('t1')
    expect(a.selected.value).toEqual(['loose', 'f1'])
    a.clearSelection()
    expect(a.selected.value).toEqual([])
  })

  it('botWontSee', async () => {
    const { a } = await ready()
    expect(a.botWontSee({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } })).toBe(true)
    expect(a.botWontSee({ see: { kind: 'roles', roleIds: ['601', '901'] }, post: { kind: 'everyone' } })).toBe(false)
    expect(a.botWontSee(OPEN_RULE)).toBe(false)
  })
})

describe('useChannelAccess: preview and apply', () => {
  const RO: AccessRule = { see: { kind: 'everyone' }, post: { kind: 'nobody' } }

  it('openPreview posts the edits and fills the modal', async () => {
    const { a, fetchMock } = await ready(async (url: string) => (url.includes('access-preview') ? preview() : snapshot()))
    a.setRule('cat', RO)
    await a.openPreview()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/permissions/access-preview', {
      method: 'POST',
      body: { guild_id: '12345', edits: [{ channel_id: 'cat', rule: RO }] },
    })
    expect(a.modal.value).toMatchObject({ open: true, loading: false, error: null })
    expect(a.modal.value.preview!.canApply).toBe(true)
  })

  it('openPreview does nothing with no edits; a preview error keeps the modal open', async () => {
    const { a, fetchMock } = await ready()
    await a.openPreview()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a.modal.value.open).toBe(false)
    vi.stubGlobal('$fetch', vi.fn(async () => { throw { data: { statusMessage: 'You need Manage Server' } } }))
    a.setRule('cat', RO)
    await a.openPreview()
    expect(a.modal.value).toMatchObject({ open: true, loading: false, error: 'You need Manage Server', preview: null })
  })

  it('a late preview response cannot touch a modal that was closed', async () => {
    let resolveFirst!: (v: unknown) => void
    const { a } = await ready()
    vi.stubGlobal('$fetch', vi.fn(() => new Promise((resolve) => { resolveFirst = resolve })))
    a.setRule('cat', RO)
    const first = a.openPreview()
    a.closePreview()
    resolveFirst(preview())
    await first
    expect(a.modal.value.open).toBe(false)
    expect(a.modal.value.preview).toBeNull()
  })

  it('confirmApply posts the hash, then reloads, clears edits and selection', async () => {
    const calls: string[] = []
    const { a } = await ready(async (url: string) => {
      calls.push(url)
      if (url.includes('access-preview')) return preview()
      if (url.includes('access-apply')) return { applied: true, plan: preview().plan, logged: false }
      return snapshot()
    })
    a.setRule('cat', RO)
    a.setSelection(['cat'])
    await a.openPreview()
    expect(await a.confirmApply()).toBe(true)
    expect(calls.at(-2)).toBe('/api/permissions/access-apply')
    expect(calls.at(-1)).toBe('/api/permissions/access-state?guild_id=12345')
    expect(a.lastApply.value).toEqual({ logged: false })
    expect(a.edits.value).toEqual({})
    expect(a.selected.value).toEqual([])
    expect(a.modal.value.open).toBe(false)
  })

  it('a 409 on apply reloads the snapshot but keeps the edits and shows the error', async () => {
    const calls: string[] = []
    const { a } = await ready(async (url: string) => {
      calls.push(url)
      if (url.includes('access-preview')) return preview()
      if (url.includes('access-apply')) throw { statusCode: 409, data: { statusCode: 409, statusMessage: 'The channels changed since the preview. Review the changes again.' } }
      return snapshot()
    })
    a.setRule('cat', RO)
    await a.openPreview()
    expect(await a.confirmApply()).toBe(false)
    expect(a.modal.value).toMatchObject({ open: true, applying: false, error: 'The channels changed since the preview. Review the changes again.' })
    expect(a.modal.value.preview).toBeNull()
    expect(a.edits.value.cat).toEqual(RO)
    expect(calls.filter((u) => u.includes('access-state'))).toHaveLength(2)
  })

  it('any apply error reloads, clears the preview, and keeps the edits', async () => {
    const calls: string[] = []
    const { a } = await ready(async (url: string) => {
      calls.push(url)
      if (url.includes('access-preview')) return preview()
      if (url.includes('access-apply')) throw { statusCode: 502, data: { statusCode: 502, statusMessage: 'Discord is unavailable' } }
      return snapshot()
    })
    a.setRule('cat', RO)
    await a.openPreview()
    expect(await a.confirmApply()).toBe(false)
    expect(a.modal.value).toMatchObject({ open: true, applying: false, error: 'Discord is unavailable', preview: null })
    expect(a.edits.value.cat).toEqual(RO)
    expect(calls.filter((u) => u.includes('access-state'))).toHaveLength(2)
  })

  it('after an apply error, edits, selection and the open editor for vanished channels are pruned', async () => {
    let gone = false
    const { a } = await ready(async (url: string) => {
      if (url.includes('access-preview')) return preview()
      if (url.includes('access-apply')) { gone = true; throw { statusCode: 409 } }
      const snap = snapshot()
      return gone ? { ...snap, channels: snap.channels.filter((c) => c.id !== 'cat') } : snap
    })
    a.setRule('cat', RO)
    a.setRule('loose', RO)
    a.setSelection(['cat', 'loose'])
    a.expanded.value = 'cat'
    await a.openPreview()
    expect(await a.confirmApply()).toBe(false)
    expect(a.edits.value.cat).toBeUndefined()
    expect(a.edits.value.loose).toEqual(RO)
    expect(a.selected.value).toEqual(['loose'])
    expect(a.expanded.value).toBeNull()
  })

  it('confirmApply is a no-op without an applicable preview', async () => {
    const { a, fetchMock } = await ready(async (url: string) => (url.includes('access-preview') ? preview({ canApply: false, blockers: ['no'] }) : snapshot()))
    a.setRule('cat', RO)
    await a.openPreview()
    expect(await a.confirmApply()).toBe(false)
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('access-apply'))).toBe(false)
  })
})
