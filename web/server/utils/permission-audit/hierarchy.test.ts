import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import { BOT_ROLE_ID, bits, botRole, everyoneRole, makeInput, role } from './fixtures'
import { checkHierarchy } from './hierarchy'

const withAssignedRole = (assigned: ReturnType<typeof role>[], extra = {}) =>
  makeInput({
    roles: [everyoneRole(), botRole(), ...assigned],
    modules: [{ name: 'autoroles', enabled: true, settings: { rules: [{ roleId: assigned[0]?.id ?? 'x' }] } }],
    ...extra,
  })

describe('checkHierarchy', () => {
  it('reports info when the bot holds Administrator', () => {
    const findings = checkHierarchy(makeInput({ roles: [everyoneRole(), botRole(bits(P.Administrator))] }))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: `bot-administrator:${BOT_ROLE_ID}`,
      check: 'hierarchy',
      severity: 'info',
      subject: { type: 'role', id: BOT_ROLE_ID, name: 'MODUS' },
    })
  })

  it('for an Administrator bot, the finding lists what MODUS needs and the safe order to remove Administrator', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.Administrator))],
      modules: [{ name: 'moderation', enabled: true, settings: {} }],
    })
    const finding = checkHierarchy(input).find((f) => f.id === `bot-administrator:${BOT_ROLE_ID}`)!
    expect(finding.detail).toContain('Without Administrator, the bot\'s role needs:')
    expect(finding.detail).toContain('Required (a module fails without these):')
    expect(finding.detail).toContain('• Ban Members — moderation')
    expect(finding.recommendation).toContain('grant the permissions listed above')
    expect(finding.recommendation).toContain('then remove Administrator')
    expect(finding.recommendation).not.toContain('Readiness findings list')
  })

  it('does not report a needs list for a bot without Administrator', () => {
    const findings = checkHierarchy(
      makeInput({ modules: [{ name: 'moderation', enabled: true, settings: {} }] }),
    )
    expect(findings.some((f) => f.id.startsWith('bot-administrator'))).toBe(false)
  })

  it('reports nothing for a normal bot and no role-assigning modules', () => {
    expect(checkHierarchy(makeInput())).toEqual([])
  })

  it('flags an assigned role positioned above the bot as critical, naming the module', () => {
    const findings = checkHierarchy(withAssignedRole([role('50', 'VIP', '0', 20)]))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 'role-above-bot:50',
      check: 'hierarchy',
      severity: 'critical',
      subject: { type: 'role', id: '50', name: 'VIP' },
    })
    expect(findings[0]!.detail).toContain('autoroles')
  })

  it('flags an assigned role at the same position as the bot (must be strictly below)', () => {
    expect(checkHierarchy(withAssignedRole([role('50', 'VIP', '0', 10)])).map((f) => f.id)).toEqual([
      'role-above-bot:50',
    ])
  })

  it('does not flag an assigned role below the bot', () => {
    expect(checkHierarchy(withAssignedRole([role('50', 'VIP', '0', 3)]))).toEqual([])
  })

  it('still enforces hierarchy when the bot has Administrator', () => {
    const findings = checkHierarchy(
      makeInput({
        roles: [everyoneRole(), botRole(bits(P.Administrator)), role('50', 'VIP', '0', 20)],
        modules: [{ name: 'autoroles', enabled: true, settings: { rules: [{ roleId: '50' }] } }],
      }),
    )
    expect(findings.map((f) => f.id).sort()).toEqual([`bot-administrator:${BOT_ROLE_ID}`, 'role-above-bot:50'])
  })

  it('merges modules that assign the same role into one finding', () => {
    const findings = checkHierarchy(
      makeInput({
        roles: [everyoneRole(), botRole(), role('50', 'VIP', '0', 20)],
        modules: [
          { name: 'autoroles', enabled: true, settings: { rules: [{ roleId: '50' }] } },
          { name: 'verification', enabled: true, settings: { buttons: [{ roleId: '50' }] } },
        ],
      }),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]!.detail).toContain('autoroles')
    expect(findings[0]!.detail).toContain('verification')
  })

  it('ignores disabled modules', () => {
    const input = withAssignedRole([role('50', 'VIP', '0', 20)])
    input.modules[0]!.enabled = false
    expect(checkHierarchy(input)).toEqual([])
  })

  it('skips a configured role that no longer exists in the guild', () => {
    const input = makeInput({
      modules: [{ name: 'autoroles', enabled: true, settings: { rules: [{ roleId: 'deleted' }] } }],
    })
    expect(checkHierarchy(input)).toEqual([])
  })

  it('skips @everyone as a target', () => {
    const input = makeInput({
      modules: [{ name: 'autoroles', enabled: true, settings: { rules: [{ roleId: '100' }] } }],
    })
    expect(checkHierarchy(input)).toEqual([])
  })

  it('treats a bot with no roles as position 0', () => {
    const findings = checkHierarchy(
      makeInput({
        roles: [everyoneRole(), role('50', 'VIP', '0', 1)],
        bot: { userId: '900', roleIds: [] },
        modules: [{ name: 'autoroles', enabled: true, settings: { rules: [{ roleId: '50' }] } }],
      }),
    )
    expect(findings.map((f) => f.id).sort()).toEqual(['bot-no-role:900', 'role-above-bot:50'])
  })

  it('warns when the bot has no role of its own in the server', () => {
    const findings = checkHierarchy(
      makeInput({ roles: [everyoneRole()], bot: { userId: '900', roleIds: [] } }),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 'bot-no-role:900',
      check: 'hierarchy',
      severity: 'warning',
      subject: { type: 'bot', id: '900' },
    })
    expect(findings[0]!.detail).toContain('@everyone')
  })

  it('does not warn when the bot has a role, even one missing from the role list', () => {
    expect(checkHierarchy(makeInput())).toEqual([])
    expect(
      checkHierarchy(makeInput({ roles: [], bot: { userId: '900', roleIds: ['901'] } })),
    ).toEqual([])
  })

  it('ignores the @everyone id in the bot role list', () => {
    const findings = checkHierarchy(
      makeInput({ roles: [everyoneRole()], bot: { userId: '900', roleIds: ['100'] } }),
    )
    expect(findings.map((f) => f.id)).toEqual(['bot-no-role:900'])
  })
})
