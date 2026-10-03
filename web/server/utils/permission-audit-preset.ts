/**
 * Preview and apply for permission presets: thin wrappers that feed the
 * preset planner into the shared plan core in permission-audit-fix.ts, so a
 * preset gets exactly the same authority, capability, hash and logging checks
 * as an audit fix.
 */
import type { FixResult, PresetPreview } from '../../shared/permission-audit-types'
import type { PresetRequest } from '../../shared/permission-presets'
import {
  applyPlan,
  previewPlan,
  type FixDeps,
  type PlanContext,
  type PlanOptions,
} from './permission-audit-fix'
import { presetPlanSource } from './permission-audit/presets'

const PRESET_NO_PLAN = 'This preset no longer applies to the selected channels.'
const PRESET_OPTIONS: PlanOptions = {
  noPlanError: PRESET_NO_PLAN,
  mismatchError: 'The selected channels changed since the preview. Preview the preset again.',
  logTitle: 'Permission preset',
}

export async function previewPreset(
  deps: FixDeps,
  ctx: PlanContext,
  req: PresetRequest,
): Promise<PresetPreview> {
  const preview = await previewPlan(deps, ctx, presetPlanSource(req), PRESET_NO_PLAN)
  return { ...preview, stats: preview.stats ?? null }
}

export async function applyPreset(
  deps: FixDeps,
  ctx: PlanContext,
  req: PresetRequest,
  planHash: string,
): Promise<FixResult> {
  return applyPlan(deps, ctx, presetPlanSource(req), planHash, PRESET_OPTIONS)
}
