/**
 * Channel Access: the classified snapshot the editor renders, and preview /
 * apply wrappers that feed the access planner into the shared plan core in
 * permission-audit-fix.ts, so an access edit gets exactly the same authority,
 * capability, hash and logging checks as an audit fix.
 */
import { computeBasePermissions, hasPermission } from '../../shared/discord-permissions'
import {
  channelKind,
  classifyChannel,
  isAdminRole,
  type AccessEdit,
  type AccessStateResponse,
  type ChannelAccessState,
} from '../../shared/channel-access'
import type { AccessPreview, FixResult } from '../../shared/permission-audit-types'
import {
  applyPlan,
  loadAndAuthorize,
  previewPlan,
  type FixDeps,
  type PlanContext,
  type PlanOptions,
} from './permission-audit-fix'
import { accessPlanSource, isSyncedWith } from './permission-audit/access'
import type { AuditInput } from './permission-audit/types'

const ACCESS_NO_PLAN = 'These channels no longer need any change.'
const ACCESS_OPTIONS: PlanOptions = {
  noPlanError: ACCESS_NO_PLAN,
  mismatchError: 'The channels changed since the preview. Review the changes again.',
  logTitle: 'Channel access',
}

/** Pure: the editor's snapshot from fresh audit input. */
export function buildAccessState(input: AuditInput): AccessStateResponse {
  const botBase = computeBasePermissions(input.guildId, input.roles, input.bot.roleIds)
  const botRoles = input.roles.filter((r) => input.bot.roleIds.includes(r.id))
  const byId = new Map(input.channels.map((c) => [c.id, c]))

  const channels: ChannelAccessState[] = input.channels.map((channel) => {
    const kind = channelKind(channel.type)
    const parent = channel.parent_id ? byId.get(channel.parent_id) : undefined
    // Forums and stages cannot be edited, but their View / post bits still read like a text or voice channel.
    const classifyAs = kind ?? (channel.type === 13 ? 'voice' : 'text')
    const classified = classifyChannel(channel.permission_overwrites ?? [], classifyAs, input.guildId, input.roles)
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: parent && parent.type === 4 ? parent.id : null,
      position: channel.position ?? 0,
      kind,
      rule: classified.rule,
      see: classified.see,
      post: classified.post,
      seeSummary: classified.seeSummary,
      postSummary: classified.postSummary,
      memberOverrides: classified.memberOverrides,
      syncedWithParent: parent && parent.type === 4 ? isSyncedWith(channel, parent) : null,
    }
  })

  return {
    roles: input.roles
      .filter((r) => r.id !== input.guildId)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, managed: Boolean(r.managed), position: r.position, admin: isAdminRole(r) })),
    botTopPosition: botRoles.length > 0 ? Math.max(...botRoles.map((r) => r.position)) : null,
    botRoleIds: [...input.bot.roleIds],
    botAdmin: hasPermission(botBase, 'Administrator'),
    channels,
  }
}

export async function loadAccessState(deps: FixDeps, ctx: PlanContext): Promise<AccessStateResponse> {
  return buildAccessState(await loadAndAuthorize(deps, ctx))
}

export async function previewAccess(deps: FixDeps, ctx: PlanContext, edits: AccessEdit[]): Promise<AccessPreview> {
  const preview = await previewPlan(deps, ctx, accessPlanSource(edits), ACCESS_NO_PLAN)
  return { ...preview, stats: preview.stats ?? null }
}

export async function applyAccess(
  deps: FixDeps,
  ctx: PlanContext,
  edits: AccessEdit[],
  planHash: string,
): Promise<FixResult> {
  return applyPlan(deps, ctx, accessPlanSource(edits), planHash, ACCESS_OPTIONS)
}
