import { computeBasePermissions, hasPermission } from '../../../shared/discord-permissions'
import { getModuleNeeds } from '../../../shared/module-requirements'
import type { Finding } from '../../../shared/permission-audit-types'
import type { AuditInput } from './types'

export function checkHierarchy(input: AuditInput): Finding[] {
  const findings: Finding[] = []
  const botRoles = input.roles.filter((r) => input.bot.roleIds.includes(r.id) && r.id !== input.guildId)
  const botTop = botRoles.reduce<(typeof botRoles)[number] | undefined>(
    (top, r) => (!top || r.position > top.position ? r : top),
    undefined,
  )
  const botTopPosition = botTop?.position ?? 0

  const botBase = computeBasePermissions(input.guildId, input.roles, input.bot.roleIds)
  if (hasPermission(botBase, 'Administrator')) {
    findings.push({
      id: `bot-administrator:${botTop?.id ?? input.guildId}`,
      check: 'hierarchy',
      severity: 'info',
      title: 'The bot has Administrator',
      detail:
        'The bot ignores every channel permission and can do anything its role position allows. This is convenient but broader than MODUS needs.',
      subject: { type: 'role', id: botTop?.id ?? input.guildId, name: botTop?.name ?? '@everyone' },
      recommendation:
        "Server Settings → Roles → the bot's role: remove Administrator and grant only the permissions the Readiness findings list. Check those first, because channel permissions start to apply to the bot.",
    })
  }

  // Roles each enabled module assigns, merged so one role yields one finding.
  const modulesByRole = new Map<string, Set<string>>()
  for (const mod of input.modules) {
    if (!mod.enabled) continue
    for (const roleId of getModuleNeeds(mod.name, mod.settings)?.roleIds ?? []) {
      if (!modulesByRole.has(roleId)) modulesByRole.set(roleId, new Set())
      modulesByRole.get(roleId)!.add(mod.name)
    }
  }

  for (const [roleId, moduleNames] of modulesByRole) {
    if (roleId === input.guildId) continue
    const target = input.roles.find((r) => r.id === roleId)
    if (!target || target.managed) continue
    // Discord requires the bot's top role to sit strictly above the target.
    if (target.position < botTopPosition) continue
    findings.push({
      id: `role-above-bot:${roleId}`,
      check: 'hierarchy',
      severity: 'critical',
      title: `"${target.name}" is not below the bot's highest role`,
      detail: `${[...moduleNames].join(', ')} assigns this role, but its position (${target.position}) is not below the bot's highest role (${botTopPosition}), so Discord will refuse to assign it.`,
      subject: { type: 'role', id: roleId, name: target.name },
      recommendation: `Server Settings → Roles: drag the bot's role above "${target.name}".`,
    })
  }

  return findings
}
