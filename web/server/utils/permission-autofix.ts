/**
 * Fix-on-save: after a module's settings are saved, give the bot the channel
 * access that module now needs (the same `channel-perms` fix the audit page
 * offers). Best-effort and never throws, so a Discord problem can never fail
 * the settings save that triggered it. No Nitro globals, so it is testable.
 */
import { loadAuditInput } from './permission-audit-data'
import { FixError, applyFix, previewFix, type FixDeps, type PlanContext } from './permission-audit-fix'
import { runPermissionAudit } from './permission-audit'

export interface AutoFixResult {
  /** Plan summaries of the fixes that were applied. */
  applied: string[]
  /** Channels the bot still cannot use, with the reasons it could not be fixed. */
  blocked: { channel: string; reasons: string[] }[]
}

export async function autoGrantModuleChannels(
  deps: FixDeps,
  ctx: PlanContext,
  moduleName: string,
): Promise<AutoFixResult> {
  const result: AutoFixResult = { applied: [], blocked: [] }
  try {
    const input = await loadAuditInput(ctx.guildId, deps.botToken, deps.get, deps.configs)
    const findings = runPermissionAudit(input).findings.filter(
      (f) => f.fixable && f.id.startsWith(`channel-perms:${moduleName}:`),
    )
    for (const finding of findings) {
      const fixCtx = { ...ctx, findingId: finding.id }
      const preview = await previewFix(deps, fixCtx)
      if (preview.canApply && preview.plan) {
        const done = await applyFix(deps, fixCtx, preview.plan.hash)
        result.applied.push(done.plan.summary)
      } else if (preview.blockers.length > 0) {
        result.blocked.push({ channel: finding.subject.name, reasons: preview.blockers })
      }
    }
  } catch (err) {
    // A caller without Manage Server (403) is not an error: they just don't get the auto-fix.
    if (!(err instanceof FixError && err.status === 403)) {
      console.warn(`[Permission autofix] ${ctx.guildId}/${moduleName} failed:`, (err as Error)?.message || err)
    }
  }
  return result
}
