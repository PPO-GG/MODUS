import {
  computeBasePermissions,
  computeChannelPermissions,
  hasPermission,
  missingPermissions,
  permissionLabel,
  type PermissionName,
} from '../../../shared/discord-permissions'
import { getModuleNeeds } from '../../../shared/module-requirements'
import type { Finding } from '../../../shared/permission-audit-types'
import type { AuditInput } from './types'

const labels = (names: PermissionName[]) => names.map(permissionLabel).join(', ')

export function checkReadiness(input: AuditInput): Finding[] {
  const botBase = computeBasePermissions(input.guildId, input.roles, input.bot.roleIds)
  // Administrator satisfies every requirement.
  if (hasPermission(botBase, 'Administrator')) return []

  const findings: Finding[] = []
  const channelsById = new Map(input.channels.map((c) => [c.id, c]))

  for (const mod of input.modules) {
    if (!mod.enabled) continue
    const needs = getModuleNeeds(mod.name, mod.settings)
    if (!needs) continue
    const moduleSubject = { type: 'module' as const, id: mod.name, name: mod.name }

    const missingRequired = missingPermissions(botBase, needs.required)
    if (missingRequired.length > 0) {
      findings.push({
        id: `missing-guild-perms:${mod.name}`,
        check: 'readiness',
        severity: 'critical',
        title: `The bot is missing ${labels(missingRequired)} for ${mod.name}`,
        detail: `The ${mod.name} module needs ${labels(needs.required)} but the bot's roles do not grant ${labels(missingRequired)}, so the module will fail.`,
        subject: moduleSubject,
        recommendation: `Server Settings → Roles → the bot's role: enable ${labels(missingRequired)}.`,
      })
    }

    const missingOptional = missingPermissions(botBase, needs.optional)
    if (missingOptional.length > 0) {
      findings.push({
        id: `missing-optional-perms:${mod.name}`,
        check: 'readiness',
        severity: 'warning',
        title: `Some ${mod.name} features need ${labels(missingOptional)}`,
        detail: `The bot's roles do not grant ${labels(missingOptional)}. The ${mod.name} module still works, but the features that use them will not.`,
        subject: moduleSubject,
        recommendation: `Server Settings → Roles → the bot's role: enable ${labels(missingOptional)} if you use those features.`,
      })
    }

    for (const ref of needs.channels) {
      const channel = channelsById.get(ref.id)
      if (!channel) {
        findings.push({
          id: `channel-missing:${mod.name}:${ref.id}`,
          check: 'readiness',
          severity: 'warning',
          title: `${mod.name}: the ${ref.label} no longer exists`,
          detail: `${mod.name} is configured to use a ${ref.label} (id ${ref.id}) that is not in this server any more.`,
          subject: moduleSubject,
          recommendation: `Open the ${mod.name} module settings and pick a new ${ref.label}.`,
        })
        continue
      }

      const effective = computeChannelPermissions(
        botBase,
        channel,
        input.guildId,
        input.bot.userId,
        input.bot.roleIds,
      )
      const missing = missingPermissions(effective, ref.perms)
      if (missing.length > 0) {
        findings.push({
          id: `channel-perms:${mod.name}:${channel.id}`,
          check: 'readiness',
          severity: 'critical',
          title: `The bot is missing ${labels(missing)} in #${channel.name}`,
          detail: `${mod.name} uses #${channel.name} as its ${ref.label} and needs ${labels(ref.perms)} there, but the bot lacks ${labels(missing)}. A channel or category overwrite may be denying them.`,
          subject: { type: 'channel', id: channel.id, name: channel.name },
          recommendation: `Edit #${channel.name} → Permissions: allow ${labels(missing)} for the bot's role (also check the category's overwrites).`,
        })
      }
    }
  }

  return findings
}
