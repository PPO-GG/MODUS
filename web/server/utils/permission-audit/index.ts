import type { Finding, Report, Severity } from '../../../shared/permission-audit-types'
import { checkHierarchy } from './hierarchy'
import { checkOverwrites } from './overwrites'
import { checkReadiness } from './readiness'
import { checkRolePerms } from './role-perms'
import type { AuditInput } from './types'

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }

/** Pure: no I/O. Runs every check and returns a severity-sorted report. */
export function runPermissionAudit(input: AuditInput): Report {
  const findings: Finding[] = [
    ...checkRolePerms(input),
    ...checkHierarchy(input),
    ...checkOverwrites(input),
    ...checkReadiness(input),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const summary = { critical: 0, warning: 0, info: 0 }
  for (const finding of findings) summary[finding.severity] += 1

  return {
    generatedAt: (input.now?.() ?? new Date()).toISOString(),
    summary,
    findings,
  }
}
