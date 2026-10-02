import {
  PERMISSION_BITS as P,
  type ChannelLike,
  type OverwriteLike,
  type RoleLike,
} from '../../../shared/discord-permissions'
import type { AuditInput } from './types'

export const GUILD_ID = '100'
export const BOT_ID = '900'
export const BOT_ROLE_ID = '901'
const ZERO = BigInt(0)

export const bits = (...flags: bigint[]): string =>
  flags.reduce((acc, flag) => acc | flag, ZERO).toString()

export const role = (
  id: string,
  name: string,
  permissions = '0',
  position = 1,
  extra: Partial<RoleLike> = {},
): RoleLike => ({ id, name, position, permissions, ...extra })

export const everyoneRole = (permissions = bits(P.ViewChannel, P.SendMessages)): RoleLike =>
  role(GUILD_ID, '@everyone', permissions, 0)

export const botRole = (permissions = bits(P.ViewChannel, P.SendMessages), position = 10): RoleLike =>
  role(BOT_ROLE_ID, 'MODUS', permissions, position, { managed: true })

export const overwrite = (
  id: string,
  type: 0 | 1,
  allow: bigint = ZERO,
  deny: bigint = ZERO,
): OverwriteLike => ({ id, type, allow: allow.toString(), deny: deny.toString() })

export const textChannel = (
  id: string,
  name: string,
  overwrites: OverwriteLike[] = [],
  parentId: string | null = null,
): ChannelLike => ({ id, name, type: 0, parent_id: parentId, permission_overwrites: overwrites })

export const category = (id: string, name: string, overwrites: OverwriteLike[] = []): ChannelLike => ({
  id,
  name,
  type: 4,
  parent_id: null,
  permission_overwrites: overwrites,
})

export function makeInput(overrides: Partial<AuditInput> = {}): AuditInput {
  return {
    guildId: GUILD_ID,
    roles: [everyoneRole(), botRole()],
    channels: [],
    bot: { userId: BOT_ID, roleIds: [BOT_ROLE_ID] },
    modules: [],
    ...overrides,
  }
}
