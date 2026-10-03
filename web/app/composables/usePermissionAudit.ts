import { computed, ref } from 'vue'
import type {
  CheckId,
  Finding,
  FindingSubject,
  FixPreview,
  FixResult,
  Report,
  Severity,
} from '#shared/permission-audit-types'

export type SeverityFilter = 'all' | Severity
export type CheckFilter = 'all' | CheckId

export const CHECK_LABELS: Record<CheckId, string> = {
  'role-perms': 'Role permissions',
  hierarchy: 'Role hierarchy',
  overwrites: 'Channel overwrites',
  readiness: 'MODUS readiness',
}

export function filterFindings(
  findings: Finding[],
  severity: SeverityFilter,
  check: CheckFilter,
): Finding[] {
  return findings.filter(
    (f) => (severity === 'all' || f.severity === severity) && (check === 'all' || f.check === check),
  )
}

export interface FindingGroup {
  key: string
  subject: FindingSubject
  findings: Finding[]
}

/** Group by subject, preserving first-appearance order (findings arrive severity-sorted). */
export function groupBySubject(findings: Finding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>()
  for (const finding of findings) {
    const key = `${finding.subject.type}:${finding.subject.id}`
    const group = groups.get(key)
    if (group) group.findings.push(finding)
    else groups.set(key, { key, subject: finding.subject, findings: [finding] })
  }
  return [...groups.values()]
}

export interface FixState {
  open: boolean
  finding: Finding | null
  loading: boolean
  applying: boolean
  preview: FixPreview | null
  error: string | null
}

const initialFixState = (): FixState => ({
  open: false,
  finding: null,
  loading: false,
  applying: false,
  preview: null,
  error: null,
})

const messageOf = (err: any, fallback: string): string =>
  err?.data?.statusMessage || err?.statusMessage || fallback

export function usePermissionAudit(guildId: string) {
  const report = ref<Report | null>(null)
  const loading = ref(true)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const severity = ref<SeverityFilter>('all')
  const check = ref<CheckFilter>('all')

  const filtered = computed(() =>
    filterFindings(report.value?.findings ?? [], severity.value, check.value),
  )
  const groups = computed(() => groupBySubject(filtered.value))

  /** `fresh` bypasses the server's 30s cache (the Re-run button). */
  async function run(fresh = false) {
    refreshing.value = true
    error.value = null
    try {
      report.value = await $fetch<Report>(
        `/api/permissions/audit?guild_id=${encodeURIComponent(guildId)}${fresh ? '&fresh=1' : ''}`,
      )
    } catch (err: any) {
      report.value = null
      error.value = messageOf(err, 'Failed to run the permission audit.')
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  const fix = ref<FixState>(initialFixState())
  /** Outcome of the last applied fix, so the page can say whether the revert record was saved. */
  const lastFix = ref<{ logged: boolean } | null>(null)

  async function openFix(finding: Finding) {
    lastFix.value = null
    fix.value = { ...initialFixState(), open: true, finding, loading: true }
    const state = fix.value
    // A late response must not touch state that was closed or replaced by another openFix.
    const isCurrent = () => fix.value === state
    try {
      const result = await $fetch<FixPreview>(
        `/api/permissions/fix-preview?guild_id=${encodeURIComponent(guildId)}&finding_id=${encodeURIComponent(finding.id)}`,
      )
      if (isCurrent()) state.preview = result
    } catch (err: any) {
      if (isCurrent()) state.error = messageOf(err, 'Failed to load the fix preview.')
    } finally {
      if (isCurrent()) state.loading = false
    }
  }

  /** Applies the previewed fix. Returns true when it was applied. */
  async function confirmFix(): Promise<boolean> {
    const current = fix.value
    const plan = current.preview?.plan
    if (!current.finding || !plan || !current.preview?.canApply || current.applying) return false
    current.applying = true
    current.error = null
    try {
      const result = await $fetch<FixResult>('/api/permissions/fix', {
        method: 'POST',
        body: { guild_id: guildId, finding_id: current.finding.id, plan_hash: plan.hash },
      })
      lastFix.value = { logged: result?.logged === true }
    } catch (err: any) {
      current.error = messageOf(err, 'Failed to apply the fix.')
      current.applying = false
      return false
    }
    fix.value = initialFixState()
    await run(true)
    return true
  }

  function closeFix() {
    lastFix.value = null
    fix.value = initialFixState()
  }

  return {
    report, loading, refreshing, error, severity, check, filtered, groups, run,
    fix, lastFix, openFix, confirmFix, closeFix,
  }
}
