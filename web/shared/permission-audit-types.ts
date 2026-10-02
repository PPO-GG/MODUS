/**
 * Report shapes shared by the audit engine (server) and the dashboard page
 * (client). Types only — no runtime code.
 */
export type Severity = 'critical' | 'warning' | 'info'
export type CheckId = 'role-perms' | 'hierarchy' | 'overwrites' | 'readiness'

export interface FindingSubject {
  type: 'role' | 'channel' | 'module'
  id: string
  name: string
}

export interface Finding {
  /** `<rule>:<subjectId>` — unique within a report, used as a UI key. */
  id: string
  check: CheckId
  severity: Severity
  title: string
  detail: string
  subject: FindingSubject
  /** Plain-text "how to fix in Discord". */
  recommendation: string
}

export interface ReportSummary {
  critical: number
  warning: number
  info: number
}

export interface Report {
  /** ISO timestamp. */
  generatedAt: string
  summary: ReportSummary
  /** Sorted critical → warning → info. */
  findings: Finding[]
}
