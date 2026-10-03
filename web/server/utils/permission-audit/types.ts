import type { ChannelLike, RoleLike } from '../../../shared/discord-permissions'
import type { FixPlan, PresetStats } from '../../../shared/permission-audit-types'

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

/**
 * What a plan source derived from fresh Discord data. A null plan carries the
 * reasons in `problems` (empty means "nothing applies", and the caller supplies
 * a generic message).
 */
export interface PlanDerivation {
  plan: FixPlan | null
  problems: string[]
  stats?: PresetStats
}

/** Derives a plan from the audit input. Pure. */
export type PlanSource = (input: AuditInput) => PlanDerivation
