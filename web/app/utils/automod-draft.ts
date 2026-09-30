import type { DraftRule } from "@modus/db/automod-rules";

export interface DraftResult {
  rule: DraftRule;
  warnings: string[];
  notes: string[];
}

export function draftUnavailableMessage(
  reason: "not_premium" | "no_shared_key" | undefined,
): string {
  if (reason === "not_premium") {
    return "Requires Premium or your own AI key. Add a key in AI settings.";
  }
  if (reason === "no_shared_key") {
    return "Premium AI key not configured. Please contact the bot admin.";
  }
  return "AI drafts are unavailable for this server.";
}

/**
 * Map a validated draft onto the automod page's rule form. Mirrors the
 * re-hydration openEditModal does for stored rules (timeout picker fields,
 * ban delete_days default, exempt-list text inputs).
 */
export function draftToFormState(rule: DraftRule) {
  return {
    name: rule.name,
    trigger: rule.trigger as string,
    conditions: rule.conditions,
    actions: rule.actions.map((action) => {
      const params: Record<string, any> = { ...(action.params ?? {}) };
      if (action.type === "timeout_user" && params.duration) {
        const match = String(params.duration).match(/^(\d+)([mhd])$/);
        if (match) {
          params._durationAmt = parseInt(match[1] as string, 10);
          params._durationUnit = match[2] as string;
        }
      }
      if (action.type === "ban_user" && params.delete_days === undefined) {
        params.delete_days = 0;
      }
      return { type: action.type, params, delaySeconds: action.delaySeconds };
    }),
    cooldown: rule.cooldown,
    priority: rule.priority,
    exemptRoles: [...rule.exempt_roles],
    exemptChannels: [...rule.exempt_channels],
    exemptRolesInput: rule.exempt_roles.join(", "),
    exemptChannelsInput: rule.exempt_channels.join(", "),
  };
}
