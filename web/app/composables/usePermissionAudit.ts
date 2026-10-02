import { computed, ref } from 'vue'
import type {
  CheckId,
  Finding,
  FindingSubject,
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
      error.value =
        err?.data?.statusMessage || err?.statusMessage || 'Failed to run the permission audit.'
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  return { report, loading, refreshing, error, severity, check, filtered, groups, run }
}
