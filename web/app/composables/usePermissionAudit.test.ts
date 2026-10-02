import { describe, expect, it } from 'vitest'
import type { Finding } from '#shared/permission-audit-types'
import { filterFindings, groupBySubject } from './usePermissionAudit'

const finding = (over: Partial<Finding> & Pick<Finding, 'id'>): Finding => ({
  check: 'role-perms',
  severity: 'critical',
  title: 't',
  detail: 'd',
  subject: { type: 'role', id: 'r1', name: 'Role' },
  recommendation: 'r',
  ...over,
})

const findings: Finding[] = [
  finding({ id: 'a', severity: 'critical', check: 'role-perms' }),
  finding({ id: 'b', severity: 'warning', check: 'overwrites', subject: { type: 'channel', id: 'c1', name: 'general' } }),
  finding({ id: 'c', severity: 'critical', check: 'readiness', subject: { type: 'channel', id: 'c1', name: 'general' } }),
  finding({ id: 'd', severity: 'info', check: 'hierarchy' }),
]

describe('filterFindings', () => {
  it('returns everything for all/all', () => {
    expect(filterFindings(findings, 'all', 'all')).toHaveLength(4)
  })
  it('filters by severity', () => {
    expect(filterFindings(findings, 'critical', 'all').map((f) => f.id)).toEqual(['a', 'c'])
  })
  it('filters by check', () => {
    expect(filterFindings(findings, 'all', 'overwrites').map((f) => f.id)).toEqual(['b'])
  })
  it('combines both filters', () => {
    expect(filterFindings(findings, 'critical', 'readiness').map((f) => f.id)).toEqual(['c'])
    expect(filterFindings(findings, 'info', 'readiness')).toEqual([])
  })
})

describe('groupBySubject', () => {
  it('groups findings that share a subject, in order of first appearance', () => {
    const groups = groupBySubject(findings)
    expect(groups.map((g) => g.key)).toEqual(['role:r1', 'channel:c1'])
    expect(groups[0]!.findings.map((f) => f.id)).toEqual(['a', 'd'])
    expect(groups[1]!.findings.map((f) => f.id)).toEqual(['b', 'c'])
    expect(groups[1]!.subject.name).toBe('general')
  })
  it('returns an empty list for no findings', () => {
    expect(groupBySubject([])).toEqual([])
  })
})
