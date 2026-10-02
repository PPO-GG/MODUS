import {
  computeBasePermissions,
  computeChannelPermissions,
  hasPermission,
  heldPermissions,
  parseBits,
  permissionLabel,
  type PermissionName,
} from '../../../shared/discord-permissions'
import type { Finding } from '../../../shared/permission-audit-types'
import type { AuditInput } from './types'

const MANAGE_PERMS: PermissionName[] = ['ManageChannels', 'ManageRoles', 'ManageWebhooks']

export function checkOverwrites(input: AuditInput): Finding[] {
  const findings: Finding[] = []
  const { guildId } = input
  const everyoneBase = computeBasePermissions(guildId, input.roles, [])
  const byId = new Map(input.channels.map((c) => [c.id, c]))

  for (const channel of input.channels) {
    const subject = { type: 'channel' as const, id: channel.id, name: channel.name }
    const everyoneOverwrite = (channel.permission_overwrites ?? []).find(
      (o) => o.type === 0 && o.id === guildId,
    )

    if (everyoneOverwrite) {
      const allow = parseBits(everyoneOverwrite.allow)

      const manage = heldPermissions(allow, MANAGE_PERMS)
      if (manage.length > 0) {
        const names = manage.map(permissionLabel).join(', ')
        findings.push({
          id: `everyone-channel-manage:${channel.id}`,
          check: 'overwrites',
          severity: 'critical',
          title: `@everyone is granted ${names} in #${channel.name}`,
          detail: `The channel's @everyone overwrite explicitly allows ${names}, so every member can use it here.`,
          subject,
          recommendation: `Edit #${channel.name} → Permissions → @everyone and reset these permissions to neutral or deny.`,
        })
      }

      if (hasPermission(allow, 'MentionEveryone')) {
        findings.push({
          id: `everyone-channel-mention:${channel.id}`,
          check: 'overwrites',
          severity: 'warning',
          title: `@everyone is granted Mention Everyone in #${channel.name}`,
          detail: `The channel's @everyone overwrite explicitly allows Mention Everyone, so any member can ping the whole server here.`,
          subject,
          recommendation: `Edit #${channel.name} → Permissions → @everyone and reset Mention Everyone to neutral or deny.`,
        })
      }
    }

    // A child that lets @everyone view inside a category that hides it.
    if (channel.type !== 4 && channel.parent_id) {
      const parent = byId.get(channel.parent_id)
      if (parent && parent.type === 4) {
        const parentView = hasPermission(
          computeChannelPermissions(everyoneBase, parent, guildId, '', []),
          'ViewChannel',
        )
        const childView = hasPermission(
          computeChannelPermissions(everyoneBase, channel, guildId, '', []),
          'ViewChannel',
        )
        if (!parentView && childView) {
          findings.push({
            id: `child-exposed:${channel.id}`,
            check: 'overwrites',
            severity: 'warning',
            title: `#${channel.name} is visible to @everyone inside the private category "${parent.name}"`,
            detail: `The category "${parent.name}" hides its channels from @everyone, but #${channel.name} has its own overwrite that lets @everyone see it.`,
            subject,
            recommendation: `Edit #${channel.name} → Permissions and use "Sync permissions with category", or remove its @everyone View Channel allow.`,
          })
        }
      }
    }
  }

  return findings
}
