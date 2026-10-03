/**
 * Report shapes shared by the audit engine (server) and the dashboard page
 * (client). Types only — no runtime code.
 */
export type Severity = 'critical' | 'warning' | 'info'
export type CheckId = 'role-perms' | 'hierarchy' | 'overwrites' | 'readiness'

export interface FindingSubject {
  type: 'role' | 'channel' | 'module' | 'bot'
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
  /** True when the rule supports an automatic fix (see planFix). Whether it can be applied right now is decided by the preview. */
  fixable?: boolean
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

/** One permission overwrite on a channel, with raw bitfields and display names. */
export interface OverwriteState {
  id: string
  /** 0 = role, 1 = member. */
  type: 0 | 1
  /** Display only: role name, '@everyone', 'the bot', or 'member <id>'. */
  label: string
  /** Raw Discord bitfields (decimal strings). Writes and the plan hash use these, never the names. */
  allow: string
  deny: string
  /** Known permission names in the bitfields, for display. */
  allowNames: string[]
  denyNames: string[]
}

export type FixOp = 'set-overwrite' | 'delete-overwrite' | 'replace-overwrites'

export interface FixChange {
  channelId: string
  channelName: string
  op: FixOp
  /** Target of a set/delete (role id or user id); absent for replace. */
  targetId?: string
  targetType?: 0 | 1
  /** Overwrites affected by this change, before and after. For replace-overwrites these are the channel's full lists. */
  before: OverwriteState[]
  after: OverwriteState[]
}

export interface FixPlan {
  findingId: string
  /** One line for the modal title and the log entry. */
  summary: string
  changes: FixChange[]
  /** SHA-256 hex of the canonical raw change data; the apply call must present it. */
  hash: string
}

export interface FixPreview {
  plan: FixPlan | null
  canApply: boolean
  blockers: string[]
}

export interface FixResult {
  applied: true
  plan: FixPlan
  /** False when the fix was applied but the guild log entry could not be written. */
  logged: boolean
}
