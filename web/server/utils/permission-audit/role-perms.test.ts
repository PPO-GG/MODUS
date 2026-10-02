import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import { bits, botRole, everyoneRole, makeInput, role } from './fixtures'
import { checkRolePerms } from './role-perms'

describe('checkRolePerms', () => {
  it('reports nothing for a benign @everyone', () => {
    expect(checkRolePerms(makeInput())).toEqual([])
  })

  it('flags @everyone Administrator as one critical finding naming only Administrator', () => {
    const findings = checkRolePerms(
      makeInput({ roles: [everyoneRole(bits(P.Administrator, P.BanMembers)), botRole()] }),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 'everyone-critical:100',
      check: 'role-perms',
      severity: 'critical',
      subject: { type: 'role', id: '100', name: '@everyone' },
    })
    expect(findings[0]!.title).toContain('Administrator')
    expect(findings[0]!.title).not.toContain('Ban Members')
  })

  it('lists every dangerous permission @everyone holds in a single critical finding', () => {
    const [finding] = checkRolePerms(
      makeInput({ roles: [everyoneRole(bits(P.ManageRoles, P.BanMembers, P.ViewChannel)), botRole()] }),
    )
    expect(finding!.severity).toBe('critical')
    expect(finding!.title).toContain('Manage Roles')
    expect(finding!.title).toContain('Ban Members')
    expect(finding!.title).not.toContain('View Channel')
  })

  it('flags Mention Everyone, Manage Messages, Manage Nicknames and Moderate Members as a warning', () => {
    const findings = checkRolePerms(
      makeInput({ roles: [everyoneRole(bits(P.MentionEveryone, P.ModerateMembers)), botRole()] }),
    )
    expect(findings.map((f) => [f.id, f.severity])).toEqual([['everyone-warning:100', 'warning']])
  })

  it('emits both a critical and a warning finding when both classes are present', () => {
    const findings = checkRolePerms(
      makeInput({ roles: [everyoneRole(bits(P.KickMembers, P.MentionEveryone)), botRole()] }),
    )
    expect(findings.map((f) => f.id).sort()).toEqual(['everyone-critical:100', 'everyone-warning:100'])
  })

  it('flags a managed integration role with Administrator as info', () => {
    const findings = checkRolePerms(
      makeInput({
        roles: [everyoneRole(), botRole(), role('555', 'SomeIntegration', bits(P.Administrator), 5, { managed: true })],
      }),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ id: 'managed-admin:555', severity: 'info', subject: { type: 'role', id: '555' } })
  })

  it("does not flag the bot's own managed role (hierarchy reports that)", () => {
    expect(
      checkRolePerms(makeInput({ roles: [everyoneRole(), botRole(bits(P.Administrator))] })),
    ).toEqual([])
  })

  it('does not flag ordinary roles with Administrator (out of scope)', () => {
    expect(
      checkRolePerms(makeInput({ roles: [everyoneRole(), botRole(), role('7', 'Admins', bits(P.Administrator), 5)] })),
    ).toEqual([])
  })

  it('does not throw when the guild has no roles', () => {
    expect(checkRolePerms(makeInput({ roles: [] }))).toEqual([])
  })
})
