import {
  hasPermission,
  heldPermissions,
  parseBits,
  permissionLabel,
  type PermissionName,
} from '../../../shared/discord-permissions'
import type { Finding } from '../../../shared/permission-audit-types'
import type { AuditInput } from './types'

const CRITICAL_FOR_EVERYONE: PermissionName[] = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'BanMembers',
  'KickMembers',
]
const WARNING_FOR_EVERYONE: PermissionName[] = [
  'MentionEveryone',
  'ManageMessages',
  'ManageNicknames',
  'ModerateMembers',
]

const labels = (names: PermissionName[]) => names.map(permissionLabel).join(', ')

export function checkRolePerms(input: AuditInput): Finding[] {
  const findings: Finding[] = []
  const everyone = input.roles.find((r) => r.id === input.guildId)

  if (everyone) {
    const bits = parseBits(everyone.permissions)
    const subject = { type: 'role' as const, id: input.guildId, name: '@everyone' }

    // Administrator implies everything else; report it alone.
    const critical = hasPermission(bits, 'Administrator')
      ? (['Administrator'] as PermissionName[])
      : heldPermissions(bits, CRITICAL_FOR_EVERYONE)
    if (critical.length > 0) {
      findings.push({
        id: `everyone-critical:${input.guildId}`,
        check: 'role-perms',
        severity: 'critical',
        title: `@everyone has ${labels(critical)}`,
        detail: `Every member of the server holds ${labels(critical)} through the @everyone role.`,
        subject,
        recommendation:
          'Server Settings → Roles → @everyone → Permissions: turn these off and grant them only to specific staff roles.',
      })
    }

    const warning = heldPermissions(bits, WARNING_FOR_EVERYONE)
    if (warning.length > 0) {
      findings.push({
        id: `everyone-warning:${input.guildId}`,
        check: 'role-perms',
        severity: 'warning',
        title: `@everyone has ${labels(warning)}`,
        detail: `Every member of the server holds ${labels(warning)} through the @everyone role, which is easy to abuse.`,
        subject,
        recommendation:
          'Server Settings → Roles → @everyone → Permissions: turn these off unless you really want every member to have them.',
      })
    }
  }

  for (const role of input.roles) {
    if (role.id === input.guildId) continue
    if (!role.managed || input.bot.roleIds.includes(role.id)) continue
    if (!hasPermission(parseBits(role.permissions), 'Administrator')) continue
    findings.push({
      id: `managed-admin:${role.id}`,
      check: 'role-perms',
      severity: 'info',
      title: `Integration role "${role.name}" has Administrator`,
      detail: `"${role.name}" is managed by an integration (a bot or app) and holds Administrator.`,
      subject: { type: 'role', id: role.id, name: role.name },
      recommendation:
        'Check that you trust this integration. If it does not need full access, remove Administrator from its role in Server Settings → Roles.',
    })
  }

  return findings
}
