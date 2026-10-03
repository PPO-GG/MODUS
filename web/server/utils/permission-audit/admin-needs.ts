import { INVITE_BASELINE_NAMES, INVITE_PERMISSION_NAMES } from '../../../shared/bot-invite'
import { PERMISSION_BITS, permissionLabel, type PermissionName } from '../../../shared/discord-permissions'
import { getModuleNeeds } from '../../../shared/module-requirements'
import type { AuditInput } from './types'

const ORDER = Object.keys(PERMISSION_BITS) as PermissionName[]
const inOrder = (a: PermissionName, b: PermissionName) => ORDER.indexOf(a) - ORDER.indexOf(b)

/** `• Permission — module, module` lines, permissions in a stable (bit) order. */
const bullets = (byPermission: Map<PermissionName, string[]>): string[] =>
  [...byPermission.keys()]
    .sort(inOrder)
    .map((name) => `• ${permissionLabel(name)} — ${byPermission.get(name)!.join(', ')}`)

/**
 * Plain-text list of what MODUS needs from the bot's role when the bot does
 * NOT have Administrator, built from the modules the guild has configured
 * (the same requirements the readiness check uses). Shown on the Administrator
 * finding, because with Administrator the readiness check has nothing to say.
 * Multi-line; the page renders it with preserved line breaks.
 */
export function describeAdminBotNeeds(input: AuditInput): string {
  const required = new Map<PermissionName, string[]>()
  const optional = new Map<PermissionName, string[]>()
  const channelLines: string[] = []
  const channelsById = new Map(input.channels.map((c) => [c.id, c]))

  const add = (map: Map<PermissionName, string[]>, name: PermissionName, moduleName: string) => {
    const modules = map.get(name)
    if (!modules) map.set(name, [moduleName])
    else if (!modules.includes(moduleName)) modules.push(moduleName)
  }

  let configured = 0
  const modules = input.modules.filter((m) => m.enabled).sort((a, b) => a.name.localeCompare(b.name))
  for (const mod of modules) {
    const needs = getModuleNeeds(mod.name, mod.settings)
    if (!needs) continue
    configured += 1
    for (const name of needs.required) add(required, name, mod.name)
    for (const name of needs.optional) add(optional, name, mod.name)
    for (const ref of needs.channels) {
      const channel = channelsById.get(ref.id)
      // A deleted channel is reported by the channel-missing finding.
      if (!channel) continue
      channelLines.push(`• #${channel.name}: ${ref.perms.map(permissionLabel).join(', ')} (${mod.name})`)
    }
  }
  // A permission some module requires is not also listed as optional.
  for (const name of required.keys()) optional.delete(name)

  const lines: string[] = []
  if (configured === 0) {
    lines.push('No configured modules need specific permissions yet.')
  } else {
    lines.push("Needed by the modules you've configured:")
    if (required.size > 0) lines.push('Required (a module fails without these):', ...bullets(required))
    if (optional.size > 0) lines.push('Optional (a feature degrades without these):', ...bullets(optional))
    if (channelLines.length > 0) lines.push('In specific channels:', ...channelLines)
  }
  lines.push(
    `Basic messaging in any channel it posts in: ${INVITE_BASELINE_NAMES.map(permissionLabel).join(', ')}.`,
    `Everything MODUS can use is the ${INVITE_PERMISSION_NAMES.length} permissions in the invite list (Discover Servers → Invite Bot to Server).`,
  )
  return lines.join('\n')
}
