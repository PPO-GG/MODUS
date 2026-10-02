import type { ChannelLike, RoleLike } from '../../../shared/discord-permissions'

export interface AuditModule {
  /** Module key as stored in `guild_configs.module_name` (lowercase). */
  name: string
  enabled: boolean
  settings: Record<string, any>
}

export interface AuditInput {
  guildId: string
  roles: RoleLike[]
  channels: ChannelLike[]
  bot: { userId: string; roleIds: string[] }
  modules: AuditModule[]
  /** Injectable clock for tests. */
  now?: () => Date
}
