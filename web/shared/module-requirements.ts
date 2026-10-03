/**
 * What each MODUS module needs from the bot's Discord permissions, derived
 * from the module's saved settings. Single source of truth for the
 * permission audit's readiness check (and, later, the least-privilege
 * invite link). Isomorphic — no side effects.
 */
import type { PermissionName } from './discord-permissions'

export interface ChannelRef {
  id: string
  /** Human label for the setting that references the channel. */
  label: string
  perms: PermissionName[]
}

export interface ModuleNeeds {
  /** Guild-wide permissions without which the module breaks. */
  required: PermissionName[]
  /** Guild-wide permissions that only degrade a feature. */
  optional: PermissionName[]
  /** Permissions needed in specific configured channels. */
  channels: ChannelRef[]
  /** Roles the module assigns (must sit below the bot's top role). */
  roleIds: string[]
}

type Settings = Record<string, unknown>
type Build = (s: Settings) => Partial<ModuleNeeds>

const POST: PermissionName[] = ['ViewChannel', 'SendMessages', 'EmbedLinks']
const THREAD_PARENT: PermissionName[] = [
  'ViewChannel',
  'SendMessages',
  'EmbedLinks',
  'CreatePrivateThreads',
  'SendMessagesInThreads',
  'ManageThreads',
]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const records = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(isRecord) : []
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : []
const unique = <T>(items: T[]): T[] => [...new Set(items)]

const chan = (id: unknown, label: string, perms: PermissionName[]): ChannelRef[] => {
  const channelId = str(id)
  return channelId ? [{ id: channelId, label, perms }] : []
}

const REQUIREMENTS: Record<string, Build> = {
  moderation: (s) => ({
    required: ['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages'],
    optional: ['ManageChannels', 'ManageRoles', 'ViewAuditLog'],
    channels: chan(s.modLogChannelId, 'mod-log channel', POST),
  }),
  antiraid: (s) => {
    const required: PermissionName[] = ['ManageChannels', 'ManageRoles']
    if (s.action === 'kick') required.push('KickMembers')
    if (s.action === 'ban') required.push('BanMembers')
    return { required, channels: chan(s.alertChannelId, 'alert channel', POST) }
  },
  tickets: (s) => ({
    // The info message is pinned in each thread; failure is swallowed.
    optional: ['PinMessages'],
    channels: [
      ...chan(s.panelChannelId, 'ticket panel channel', POST),
      // The transcript is posted as an attached file.
      ...chan(s.transcriptChannelId, 'transcript channel', [...POST, 'AttachFiles']),
      ...chan(s.defaultParentChannelId, 'ticket parent channel', THREAD_PARENT),
      ...records(s.types).flatMap((t) => chan(t.parentChannelId, 'ticket parent channel', THREAD_PARENT)),
    ],
  }),
  tempvoice: (s) => ({
    required: ['ManageChannels', 'MoveMembers', 'MuteMembers', 'DeafenMembers'],
    // /tempvoice lock and unlock edit channel permission overwrites.
    optional: ['ManageRoles'],
    channels: [
      ...strings(s.lobbyChannelIds).flatMap((id) =>
        chan(id, 'lobby channel', ['ViewChannel', 'Connect', 'MoveMembers']),
      ),
      ...chan(s.categoryId, 'temp-voice category', ['ViewChannel', 'ManageChannels']),
    ],
  }),
  autoroles: (s) => ({
    required: ['ManageRoles'],
    roleIds: records(s.rules)
      .filter((rule) => rule.enabled !== false)
      .map((rule) => str(rule.roleId))
      .filter(Boolean),
  }),
  'reaction-roles': (s) => ({
    required: ['ManageRoles'],
    roleIds: records(s.panels)
      .flatMap((panel) => records(panel.entries))
      .map((entry) => str(entry.roleId))
      .filter(Boolean),
    channels: records(s.panels).flatMap((panel) => chan(panel.channelId, 'role panel channel', POST)),
  }),
  verification: (s) => ({
    required: ['ManageRoles'],
    roleIds: records(s.buttons)
      .map((button) => str(button.roleId))
      .filter(Boolean),
    channels: chan(s.verificationChannelId, 'verification panel channel', POST),
  }),
  logging: (s) => ({ channels: chan(s.auditChannelId, 'audit log channel', POST) }),
  starboard: (s) => ({
    channels: records(s.boards)
      .filter((board) => board.enabled !== false)
      .flatMap((board) => chan(board.channelId, 'starboard channel', POST)),
  }),
  xp: (s) => ({
    // The level-up message is an embed.
    channels: chan(s.announcementChannel, 'level-up announcement channel', POST),
  }),
  // The bot renames itself to show the current track (updateNickname setting).
  music: () => ({ required: ['Connect', 'Speak'], optional: ['ChangeNickname'] }),
  events: () => ({ required: ['ManageEvents'] }),
  // Native polls need the Create Polls permission.
  polls: () => ({ required: ['SendPolls'] }),
  // Deleting is always needed; the rest depends on which actions rules use.
  automod: () => ({
    required: ['ManageMessages'],
    optional: ['ModerateMembers', 'KickMembers', 'BanMembers', 'AddReactions'],
  }),
  recording: () => ({ required: ['Connect'] }),
}

export const MODULE_NAMES_WITH_REQUIREMENTS: string[] = Object.keys(REQUIREMENTS)

function mergeChannels(refs: ChannelRef[]): ChannelRef[] {
  const byId = new Map<string, ChannelRef>()
  for (const ref of refs) {
    const existing = byId.get(ref.id)
    if (!existing) {
      byId.set(ref.id, { ...ref, perms: [...ref.perms] })
      continue
    }
    for (const perm of ref.perms) {
      if (!existing.perms.includes(perm)) existing.perms.push(perm)
    }
    if (!existing.label.split(' / ').includes(ref.label)) existing.label += ` / ${ref.label}`
  }
  return [...byId.values()]
}

/**
 * The bot permissions a module needs given its saved settings, or null when
 * the module has no permission requirements. Never throws on malformed
 * settings.
 */
export function getModuleNeeds(moduleName: string, settings: unknown): ModuleNeeds | null {
  const key = moduleName.toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(REQUIREMENTS, key)) return null
  const partial = REQUIREMENTS[key]!(isRecord(settings) ? settings : {})
  return {
    required: unique(partial.required ?? []),
    optional: unique(partial.optional ?? []),
    channels: mergeChannels(partial.channels ?? []),
    roleIds: unique(partial.roleIds ?? []),
  }
}
