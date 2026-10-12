import { computed, ref } from 'vue'
import type { AccessPreview, FixResult } from '#shared/permission-audit-types'
import type {
  AccessRoleOption,
  AccessRule,
  AccessStateResponse,
  ChannelAccessState,
} from '#shared/channel-access'

export const OPEN_RULE: AccessRule = { see: { kind: 'everyone' }, post: { kind: 'everyone' } }

export interface ChannelGroup<T> {
  category: T | null
  channels: T[]
}

/**
 * Uncategorized channels first, then each category in position order with the
 * category itself in `category` and its children in `channels`.
 */
export function groupChannels<T extends { id: string; type: number; parentId: string | null; position: number }>(
  channels: T[],
): ChannelGroup<T>[] {
  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position)
  const categoryIds = new Set(categories.map((c) => c.id))
  const children = channels.filter((c) => c.type !== 4).sort((a, b) => a.position - b.position)

  const groups: ChannelGroup<T>[] = []
  const loose = children.filter((c) => !c.parentId || !categoryIds.has(c.parentId))
  if (loose.length > 0) groups.push({ category: null, channels: loose })
  for (const category of categories) {
    groups.push({ category, channels: children.filter((c) => c.parentId === category.id) })
  }
  return groups
}

/** Posters must be able to see: drop the rest. An empty list is a half-finished edit the page refuses to submit. */
export function normalizeRule(rule: AccessRule): AccessRule {
  if (rule.see.kind !== 'roles' || rule.post.kind !== 'roles') return rule
  const seers = rule.see.roleIds
  const posters = rule.post.roleIds.filter((id) => seers.includes(id))
  return { see: rule.see, post: { kind: 'roles', roleIds: posters } }
}

export interface AccessRow {
  channel: ChannelAccessState
  /** The rule this channel will have after the pending edits, or null when nothing changes it. */
  pending: AccessRule | null
  pendingSource: 'own' | 'category' | null
  /** For an edited category: synced children that will follow it. */
  cascadeCount: number
}

export interface PlanModalState {
  open: boolean
  loading: boolean
  applying: boolean
  preview: AccessPreview | null
  error: string | null
}

const initialModal = (): PlanModalState => ({ open: false, loading: false, applying: false, preview: null, error: null })

const messageOf = (err: any, fallback: string): string =>
  err?.data?.statusMessage || err?.statusMessage || fallback

const ruleRoleIds = (rule: AccessRule | null): string[] => [
  ...(rule?.see.kind === 'roles' ? rule.see.roleIds : []),
  ...(rule?.post.kind === 'roles' ? rule.post.roleIds : []),
]

export function useChannelAccess(guildId: string) {
  const state = ref<AccessStateResponse | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const search = ref('')
  /** Channel whose inline editor is open. */
  const expanded = ref<string | null>(null)
  const edits = ref<Record<string, AccessRule>>({})
  const selected = ref<string[]>([])

  const channels = computed(() => state.value?.channels ?? [])
  const byId = computed(() => new Map(channels.value.map((c) => [c.id, c])))
  const roleById = computed<Record<string, AccessRoleOption>>(() =>
    Object.fromEntries((state.value?.roles ?? []).map((r) => [r.id, r])),
  )

  async function load() {
    loading.value = state.value === null
    error.value = null
    try {
      state.value = await $fetch<AccessStateResponse>(`/api/permissions/access-state?guild_id=${encodeURIComponent(guildId)}`)
      pruneStale()
    } catch (err: any) {
      error.value = messageOf(err, 'Failed to load channel permissions.')
    } finally {
      loading.value = false
    }
  }

  /** Drop edits, selection and the open editor for channels the snapshot no longer has. */
  function pruneStale() {
    const present = byId.value
    if (Object.keys(edits.value).some((id) => !present.has(id))) {
      edits.value = Object.fromEntries(Object.entries(edits.value).filter(([id]) => present.has(id)))
    }
    if (selected.value.some((id) => !present.has(id))) selected.value = selected.value.filter((id) => present.has(id))
    if (expanded.value !== null && !present.has(expanded.value)) expanded.value = null
  }

  const isEditable = (id: string) => (byId.value.get(id)?.kind ?? null) !== null

  /** The rule the channel has now. A Custom field starts from open; a field that is known keeps its value. */
  function currentRule(id: string): AccessRule {
    const c = byId.value.get(id)
    if (!c) return OPEN_RULE
    return c.rule ?? { see: c.see ?? OPEN_RULE.see, post: c.post ?? OPEN_RULE.post }
  }
  /** The rule the editor should show: the pending edit, else the current rule. */
  function ruleFor(id: string): AccessRule {
    return edits.value[id] ?? currentRule(id)
  }

  function pendingFor(c: ChannelAccessState): Pick<AccessRow, 'pending' | 'pendingSource'> {
    const own = edits.value[c.id]
    if (own) return { pending: own, pendingSource: 'own' }
    if (c.parentId && c.syncedWithParent) {
      const parent = edits.value[c.parentId]
      if (parent) return { pending: parent, pendingSource: 'category' }
    }
    return { pending: null, pendingSource: null }
  }

  const syncedChildCount = (categoryId: string) =>
    channels.value.filter((c) => c.parentId === categoryId && c.syncedWithParent && !edits.value[c.id]).length

  const rows = computed<AccessRow[]>(() =>
    channels.value.map((c) => ({
      channel: c,
      ...pendingFor(c),
      cascadeCount: c.kind === 'category' && edits.value[c.id] ? syncedChildCount(c.id) : 0,
    })),
  )
  const rowById = computed(() => new Map(rows.value.map((r) => [r.channel.id, r])))

  const matches = (row: AccessRow, q: string): boolean => {
    if (row.channel.name.toLowerCase().includes(q)) return true
    const ids = [...ruleRoleIds(row.channel.rule), ...ruleRoleIds(row.pending)]
    return ids.some((id) => roleById.value[id]?.name.toLowerCase().includes(q))
  }

  const groups = computed<ChannelGroup<AccessRow>[]>(() => {
    const q = search.value.trim().toLowerCase()
    const all = groupChannels(channels.value).map((g) => ({
      category: g.category ? rowById.value.get(g.category.id)! : null,
      channels: g.channels.map((c) => rowById.value.get(c.id)!),
    }))
    if (!q) return all
    return all.flatMap((g) => {
      if (g.category && matches(g.category, q)) return [g]
      const kept = g.channels.filter((r) => matches(r, q))
      return kept.length > 0 ? [{ category: g.category, channels: kept }] : []
    })
  })

  const editCount = computed(() => Object.keys(edits.value).length)
  const cascadeCount = computed(() => rows.value.filter((r) => r.pendingSource === 'category').length)
  const canReview = computed(() => editCount.value > 0)

  function setRule(id: string, rule: AccessRule) {
    if (!isEditable(id)) return
    edits.value = { ...edits.value, [id]: normalizeRule(rule) }
  }
  function clearEdit(id: string) {
    const { [id]: _dropped, ...rest } = edits.value
    edits.value = rest
  }
  function clearEdits() {
    edits.value = {}
  }

  function toggleSelect(id: string) {
    selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
  }
  function setSelection(ids: string[]) {
    selected.value = [...new Set(ids)]
  }
  function clearSelection() {
    selected.value = []
  }

  /** Quick-fills over the selection. Each builds on the row's current (or pending) rule. */
  function bulk(action: 'read-only' | 'open' | 'private', roleIds: string[] = []) {
    for (const id of selected.value) {
      if (!isEditable(id)) continue
      const base = ruleFor(id)
      if (action === 'read-only') {
        // Unknown visibility would fall back to "everyone" and could expose a private channel.
        if (byId.value.get(id)?.see === null) continue
        setRule(id, { see: base.see, post: { kind: 'nobody' } })
      }
      else if (action === 'open') setRule(id, OPEN_RULE)
      else if (roleIds.length > 0) setRule(id, { see: { kind: 'roles', roleIds }, post: { kind: 'everyone' } })
    }
  }

  function botWontSee(rule: AccessRule): boolean {
    if (rule.see.kind !== 'roles' || state.value?.botAdmin) return false
    const botRoles = state.value?.botRoleIds ?? []
    return !rule.see.roleIds.some((id) => botRoles.includes(id))
  }

  const modal = ref<PlanModalState>(initialModal())
  /** Outcome of the last apply, so the page can say whether the revert record was saved. */
  const lastApply = ref<{ logged: boolean } | null>(null)

  const body = () => ({
    guild_id: guildId,
    edits: Object.entries(edits.value).map(([channel_id, rule]) => ({ channel_id, rule })),
  })

  async function openPreview() {
    if (!canReview.value) return
    lastApply.value = null
    modal.value = { ...initialModal(), open: true, loading: true }
    const current = modal.value
    // A late response must not touch state that was closed or replaced by another openPreview.
    const isCurrent = () => modal.value === current
    try {
      const result = await $fetch<AccessPreview>('/api/permissions/access-preview', { method: 'POST', body: body() })
      if (isCurrent()) current.preview = result
    } catch (err: any) {
      if (isCurrent()) current.error = messageOf(err, 'Failed to load the preview.')
    } finally {
      if (isCurrent()) current.loading = false
    }
  }

  /** Applies the previewed plan. Returns true when it was applied. */
  async function confirmApply(): Promise<boolean> {
    const current = modal.value
    const plan = current.preview?.plan
    if (!plan || !current.preview?.canApply || current.applying) return false
    current.applying = true
    current.error = null
    try {
      const result = await $fetch<FixResult>('/api/permissions/access-apply', {
        method: 'POST',
        body: { ...body(), plan_hash: plan.hash },
      })
      lastApply.value = { logged: result?.logged === true }
    } catch (err: any) {
      current.error = messageOf(err, 'Failed to apply the changes.')
      current.applying = false
      // Some writes may have landed, or the channels drifted: require a fresh review, show
      // today's badges again, and keep what the user typed for channels that still exist.
      current.preview = null
      await load()
      return false
    }
    modal.value = initialModal()
    edits.value = {}
    selected.value = []
    expanded.value = null
    await load()
    return true
  }

  function closePreview() {
    modal.value = initialModal()
  }

  return {
    state, loading, error, search, expanded, edits, selected,
    roleById, rows, groups, editCount, cascadeCount, canReview,
    load, currentRule, ruleFor, setRule, clearEdit, clearEdits,
    toggleSelect, setSelection, clearSelection, bulk, botWontSee,
    modal, lastApply, openPreview, confirmApply, closePreview,
  }
}
