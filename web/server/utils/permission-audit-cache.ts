/**
 * The audit report cache, shared by the audit route and the fix route (a
 * successful fix drops the guild's cached report so the page shows fresh data).
 */
import type { Report } from '#shared/permission-audit-types'
import { createTtlCache } from './permission-audit-data'

export const auditReportCache = createTtlCache<Report>(30_000)
