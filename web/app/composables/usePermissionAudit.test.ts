import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Finding, FixPreview } from '#shared/permission-audit-types'
import { filterFindings, groupBySubject, usePermissionAudit } from './usePermissionAudit'

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

describe('usePermissionAudit fix flow', () => {
  afterEach(() => vi.unstubAllGlobals())

  const fixable = finding({ id: 'child-exposed:c1', fixable: true, subject: { type: 'channel', id: 'c1', name: 'general' } })
  const preview = (over: Partial<FixPreview> = {}): FixPreview => ({
    plan: { findingId: 'child-exposed:c1', summary: 'Sync', changes: [], hash: 'h'.repeat(64) },
    canApply: true,
    blockers: [],
    ...over,
  })
  const report = { generatedAt: '2026-10-02T00:00:00Z', summary: { critical: 0, warning: 0, info: 0 }, findings: [] }

  it('openFix loads the preview and opens the modal state', async () => {
    const fetchMock = vi.fn(async () => preview())
    vi.stubGlobal('$fetch', fetchMock)
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    expect(fetchMock).toHaveBeenCalledWith('/api/permissions/fix-preview?guild_id=12345&finding_id=child-exposed%3Ac1')
    expect(audit.fix.value).toMatchObject({ open: true, loading: false, error: null, finding: fixable })
    expect(audit.fix.value.preview!.canApply).toBe(true)
  })

  it('openFix surfaces a preview error and keeps the modal open', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw { data: { statusMessage: 'You need Manage Server' } } }))
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    expect(audit.fix.value).toMatchObject({ open: true, loading: false, error: 'You need Manage Server', preview: null })
  })

  it('confirmFix posts the previewed hash, refreshes the audit with fresh=1 and resets', async () => {
    const calls: unknown[][] = []
    vi.stubGlobal('$fetch', vi.fn(async (...args: unknown[]) => {
      calls.push(args)
      const url = String(args[0])
      if (url.startsWith('/api/permissions/fix-preview')) return preview()
      if (url === '/api/permissions/fix') return { applied: true, logged: true }
      return report
    }))
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    await expect(audit.confirmFix()).resolves.toBe(true)
    const post = calls.find((c) => c[0] === '/api/permissions/fix')!
    expect(post[1]).toEqual({ method: 'POST', body: { guild_id: '12345', finding_id: 'child-exposed:c1', plan_hash: 'h'.repeat(64) } })
    expect(calls.some((c) => String(c[0]).includes('/api/permissions/audit') && String(c[0]).includes('fresh=1'))).toBe(true)
    expect(audit.fix.value).toMatchObject({ open: false, finding: null, preview: null, applying: false })
  })

  it('confirmFix does nothing when the preview says it cannot be applied', async () => {
    const fetchMock = vi.fn(async () => preview({ canApply: false, blockers: ['The bot needs Manage Roles'] }))
    vi.stubGlobal('$fetch', fetchMock)
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    fetchMock.mockClear()
    await expect(audit.confirmFix()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('confirmFix keeps the modal open and shows the reason when applying fails', async () => {
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/permissions/fix-preview')) return preview()
      throw { data: { statusMessage: 'The channel changed since the preview.' } }
    }))
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    await expect(audit.confirmFix()).resolves.toBe(false)
    expect(audit.fix.value).toMatchObject({ open: true, applying: false, error: 'The channel changed since the preview.' })
    expect(audit.fix.value.preview).not.toBeNull()
  })

  it('closeFix resets the state', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => preview()))
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    audit.closeFix()
    expect(audit.fix.value).toMatchObject({ open: false, finding: null, preview: null, error: null })
  })

  const stubApply = (result: unknown) =>
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/permissions/fix-preview')) return preview()
      if (url === '/api/permissions/fix') return result
      return report
    }))

  it('records whether the applied fix was logged', async () => {
    stubApply({ applied: true, logged: true })
    const audit = usePermissionAudit('12345')
    expect(audit.lastFix.value).toBeNull()
    await audit.openFix(fixable)
    await audit.confirmFix()
    expect(audit.lastFix.value).toEqual({ logged: true })
  })

  it('records logged: false when the log entry could not be saved', async () => {
    stubApply({ applied: true, logged: false })
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    await expect(audit.confirmFix()).resolves.toBe(true)
    expect(audit.lastFix.value).toEqual({ logged: false })
  })

  it('resets lastFix on closeFix and on openFix', async () => {
    stubApply({ applied: true, logged: false })
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    await audit.confirmFix()
    audit.closeFix()
    expect(audit.lastFix.value).toBeNull()
    await audit.openFix(fixable)
    await audit.confirmFix()
    expect(audit.lastFix.value).toEqual({ logged: false })
    await audit.openFix(fixable)
    expect(audit.lastFix.value).toBeNull()
  })

  it('leaves lastFix null when applying fails', async () => {
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/permissions/fix-preview')) return preview()
      throw { data: { statusMessage: 'nope' } }
    }))
    const audit = usePermissionAudit('12345')
    await audit.openFix(fixable)
    await audit.confirmFix()
    expect(audit.lastFix.value).toBeNull()
  })

  const deferred = <T>() => {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('openFix ignores a stale failure from an earlier request when another fix was opened', async () => {
    const a = deferred<FixPreview>()
    const b = deferred<FixPreview>()
    const findingB = finding({ id: 'child-exposed:c2', fixable: true, subject: { type: 'channel', id: 'c2', name: 'other' } })
    vi.stubGlobal('$fetch', vi.fn((url: string) => (url.includes('c1') || url.includes('child-exposed%3Ac1') ? a.promise : b.promise)))
    const audit = usePermissionAudit('12345')
    const openA = audit.openFix(fixable)
    const openB = audit.openFix(findingB)
    a.reject({ data: { statusMessage: 'A failed' } })
    await openA
    expect(audit.fix.value).toMatchObject({ open: true, loading: true, error: null, preview: null, finding: findingB })
    const previewB = preview({ plan: { findingId: 'child-exposed:c2', summary: 'B', changes: [], hash: 'b'.repeat(64) } })
    b.resolve(previewB)
    await openB
    expect(audit.fix.value).toMatchObject({ open: true, loading: false, error: null, finding: findingB })
    expect(audit.fix.value.preview).toEqual(previewB)
  })

  it('openFix ignores a late failure after the modal was closed', async () => {
    const a = deferred<FixPreview>()
    vi.stubGlobal('$fetch', vi.fn(() => a.promise))
    const audit = usePermissionAudit('12345')
    const openA = audit.openFix(fixable)
    audit.closeFix()
    a.reject({ data: { statusMessage: 'A failed' } })
    await openA
    expect(audit.fix.value).toEqual({ open: false, finding: null, loading: false, applying: false, preview: null, error: null })
  })
})
