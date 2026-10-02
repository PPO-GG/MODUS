import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import { bits, botRole, everyoneRole, makeInput, role } from './fixtures'
import { runPermissionAudit } from './index'

describe('runPermissionAudit', () => {
  it('returns an empty report for an empty guild', () => {
    const report = runPermissionAudit(makeInput({ roles: [], channels: [], modules: [] }))
    expect(report.findings).toEqual([])
    expect(report.summary).toEqual({ critical: 0, warning: 0, info: 0 })
  })

  it('stamps generatedAt from the injected clock', () => {
    const report = runPermissionAudit(makeInput({ now: () => new Date('2026-10-02T12:00:00.000Z') }))
    expect(report.generatedAt).toBe('2026-10-02T12:00:00.000Z')
  })

  it('sorts critical before warning before info and counts each', () => {
    const report = runPermissionAudit(
      makeInput({
        roles: [
          everyoneRole(bits(P.BanMembers, P.MentionEveryone)),
          botRole(bits(P.Administrator)),
          role('55', 'Other', bits(P.Administrator), 3, { managed: true }),
        ],
      }),
    )
    expect(report.findings.map((f) => f.severity)).toEqual(['critical', 'warning', 'info', 'info'])
    expect(report.summary).toEqual({ critical: 1, warning: 1, info: 2 })
  })

  it('produces unique finding ids', () => {
    const report = runPermissionAudit(
      makeInput({ roles: [everyoneRole(bits(P.BanMembers, P.MentionEveryone)), botRole(bits(P.Administrator))] }),
    )
    const ids = report.findings.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
