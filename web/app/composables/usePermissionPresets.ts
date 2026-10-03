import { computed, ref } from 'vue'
import type { FixResult, PresetPreview } from '#shared/permission-audit-types'
import {
  MAX_PRESET_CHANNELS,
  PRESETS,
  getPreset,
  kindAllowed,
  validatePresetRequest,
  type PresetId,
} from '../../shared/permission-presets'

export interface RoleOption {
  id: string
  name: string
  managed: boolean
  position: number
}

export interface ChannelOption {
  id: string
  name: string
  /** Discord channel type: 0/5 text, 2 voice, 4 category. */
  type: number
  parentId: string | null
  position: number
}

export interface ChannelGroup {
  category: ChannelOption | null
  channels: ChannelOption[]
}

/**
 * Uncategorized channels first, then each category in position order with the
 * category itself listed in `category` and its children in `channels`.
 */
export function groupChannels(channels: ChannelOption[]): ChannelGroup[] {
  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position)
  const categoryIds = new Set(categories.map((c) => c.id))
  const children = channels.filter((c) => c.type !== 4).sort((a, b) => a.position - b.position)

  const groups: ChannelGroup[] = []
  const loose = children.filter((c) => !c.parentId || !categoryIds.has(c.parentId))
  if (loose.length > 0) groups.push({ category: null, channels: loose })
  for (const category of categories) {
    groups.push({ category, channels: children.filter((c) => c.parentId === category.id) })
  }
  return groups
}

export interface PresetPreviewState {
  open: boolean
  loading: boolean
  applying: boolean
  preview: PresetPreview | null
  error: string | null
}

const initialPreview = (): PresetPreviewState => ({
  open: false,
  loading: false,
  applying: false,
  preview: null,
  error: null,
})

const messageOf = (err: any, fallback: string): string =>
  err?.data?.statusMessage || err?.statusMessage || fallback

export function usePermissionPresets(guildId: string) {
  const presetId = ref<PresetId>(PRESETS[0]!.id)
  const slots = ref<Record<string, string[]>>({})
  const channelIds = ref<string[]>([])

  const roles = ref<RoleOption[]>([])
  const botTopPosition = ref<number | null>(null)
  const channels = ref<ChannelOption[]>([])
  const optionsLoading = ref(true)
  const optionsError = ref<string | null>(null)

  const preset = computed(() => getPreset(presetId.value)!)
  const eligibleChannels = computed(() => channels.value.filter((c) => kindAllowed(preset.value, c.type)))

  const body = () => ({
    preset_id: presetId.value,
    slots: slots.value,
    channel_ids: channelIds.value,
  })
  const validation = computed(() => validatePresetRequest(body()))

  async function loadOptions() {
    optionsLoading.value = true
    optionsError.value = null
    try {
      const g = encodeURIComponent(guildId)
      const [rolesRes, channelsRes] = await Promise.all([
        $fetch<any>(`/api/discord/roles?guild_id=${g}`),
        $fetch<any>(`/api/discord/channels?guild_id=${g}&types=text,voice,category`),
      ])
      roles.value = (rolesRes?.roles ?? []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        managed: Boolean(r.managed),
        position: Number(r.position ?? 0),
      }))
      botTopPosition.value = typeof rolesRes?.botTopPosition === 'number' ? rolesRes.botTopPosition : null
      channels.value = (channelsRes?.channels ?? []).map((c: any) => ({
        id: String(c.id),
        name: String(c.name ?? ''),
        type: Number(c.type ?? 0),
        parentId: c.parentId ? String(c.parentId) : null,
        position: Number(c.position ?? 0),
      }))
    } catch (err: any) {
      optionsError.value = messageOf(err, 'Failed to load roles and channels.')
    } finally {
      optionsLoading.value = false
    }
  }

  /** Switching presets clears the slot roles and drops channels the new preset cannot use. */
  function setPreset(id: PresetId) {
    // Clicking the selected preset again must not throw away the chosen roles.
    if (id === presetId.value) return
    presetId.value = id
    slots.value = {}
    const eligible = new Set(eligibleChannels.value.map((c) => c.id))
    // Before the channel list has loaded there is nothing to compare against: keep the selection.
    if (channels.value.length > 0) channelIds.value = channelIds.value.filter((cid) => eligible.has(cid))
  }

  function setSlot(key: string, ids: string[]) {
    slots.value = { ...slots.value, [key]: ids }
  }

  function toggleChannel(id: string, checked: boolean | 'indeterminate') {
    if (checked === 'indeterminate') return
    const has = channelIds.value.includes(id)
    if (checked && !has && channelIds.value.length < MAX_PRESET_CHANNELS) {
      channelIds.value = [...channelIds.value, id]
    } else if (!checked && has) {
      channelIds.value = channelIds.value.filter((cid) => cid !== id)
    }
  }

  const preview = ref<PresetPreviewState>(initialPreview())
  /** Outcome of the last applied preset, so the page can say whether the revert record was saved. */
  const lastApply = ref<{ logged: boolean } | null>(null)

  async function openPreview() {
    if (!validation.value.ok) return
    lastApply.value = null
    preview.value = { ...initialPreview(), open: true, loading: true }
    const state = preview.value
    // A late response must not touch state that was closed or replaced by another openPreview.
    const isCurrent = () => preview.value === state
    try {
      const result = await $fetch<PresetPreview>('/api/permissions/preset-preview', {
        method: 'POST',
        body: { guild_id: guildId, ...body() },
      })
      if (isCurrent()) state.preview = result
    } catch (err: any) {
      if (isCurrent()) state.error = messageOf(err, 'Failed to load the preview.')
    } finally {
      if (isCurrent()) state.loading = false
    }
  }

  /** Applies the previewed preset. Returns true when it was applied. */
  async function confirmApply(): Promise<boolean> {
    const current = preview.value
    const plan = current.preview?.plan
    if (!plan || !current.preview?.canApply || current.applying) return false
    current.applying = true
    current.error = null
    try {
      const result = await $fetch<FixResult>('/api/permissions/preset-apply', {
        method: 'POST',
        body: { guild_id: guildId, ...body(), plan_hash: plan.hash },
      })
      lastApply.value = { logged: result?.logged === true }
    } catch (err: any) {
      current.error = messageOf(err, 'Failed to apply the preset.')
      current.applying = false
      return false
    }
    preview.value = initialPreview()
    channelIds.value = []
    return true
  }

  function closePreview() {
    preview.value = initialPreview()
  }

  return {
    presetId, slots, channelIds,
    roles, botTopPosition, channels, optionsLoading, optionsError,
    preset, eligibleChannels, validation,
    preview, lastApply,
    loadOptions, setPreset, setSlot, toggleChannel, openPreview, confirmApply, closePreview,
  }
}
