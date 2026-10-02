/**
 * Pure helpers for the Auto Roles dashboard page. The limits here mirror
 * AutoRoleSchema in bot/lib/schemas.ts — keep them in sync.
 */

export type RequirementType = "level" | "tenure_days" | "account_age_days" | "on_join";

export interface RequirementDraft {
  type: RequirementType;
  level?: number;
  days?: number;
}

export interface AutoRoleRule {
  id: string;
  name: string;
  enabled: boolean;
  roleId: string;
  requirements: RequirementDraft[];
}

export const MAX_RULES = 25;
export const MAX_REQUIREMENTS = 5;

export const REQUIREMENT_TYPES: Array<{
  value: RequirementType;
  label: string;
  description: string;
}> = [
  { value: "level", label: "XP level", description: "Member has reached this XP level (requires XP opt-in)." },
  { value: "tenure_days", label: "Time in server", description: "Member has been in the server for this many days." },
  { value: "account_age_days", label: "Account age", description: "Member's Discord account is at least this many days old." },
  { value: "on_join", label: "On join", description: "Granted the moment a member joins. Can only be combined with account age." },
];

export function newRequirement(type: RequirementType): RequirementDraft {
  switch (type) {
    case "level":
      return { type, level: 5 };
    case "tenure_days":
      return { type, days: 7 };
    case "account_age_days":
      return { type, days: 30 };
    case "on_join":
      return { type };
  }
}

export function describeRequirement(req: RequirementDraft): string {
  switch (req.type) {
    case "level":
      return `Level ${req.level}+`;
    case "tenure_days":
      return `${req.days}+ days in server`;
    case "account_age_days":
      return `Account ${req.days}+ days old`;
    case "on_join":
      return "On join";
  }
}

const isInt = (n: unknown, min: number, max: number): boolean =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** First problem with the rule, or null when it is valid. */
export function validateRule(rule: AutoRoleRule): string | null {
  if (!rule.name.trim()) return "Give the rule a name.";
  if (!rule.roleId) return "Choose the role to grant.";
  if (rule.requirements.length === 0) return "Add at least one requirement.";
  if (rule.requirements.length > MAX_REQUIREMENTS) {
    return `A rule can have at most ${MAX_REQUIREMENTS} requirements.`;
  }
  for (const req of rule.requirements) {
    if (req.type === "level" && !isInt(req.level, 1, 1000)) return "Level must be a whole number from 1 to 1000.";
    if (req.type === "tenure_days" && !isInt(req.days, 1, 3650)) return "Days in server must be a whole number from 1 to 3650.";
    if (req.type === "account_age_days" && !isInt(req.days, 1, 36500)) return "Account age days must be a whole number from 1 to 36500.";
  }
  const hasJoin = rule.requirements.some((r) => r.type === "on_join");
  if (hasJoin && rule.requirements.some((r) => r.type === "level" || r.type === "tenure_days")) {
    return "On join can only be combined with account age — level and time in server can never be met at the moment of joining.";
  }
  return null;
}

/**
 * Grants are keyed by rule id, so a rule whose role changed must get a new id:
 * reconcile then drops the old grants and the sweep backfills the new role.
 */
export function reissueIdIfRoleChanged(
  original: AutoRoleRule,
  edited: AutoRoleRule,
  newId: string,
): AutoRoleRule {
  return original.roleId !== edited.roleId ? { ...edited, id: newId } : edited;
}

const ADMINISTRATOR = 8n;

/**
 * Why the bot can't/won't grant this role, or null when it can. Mirrors the
 * bot's own checks in bot/modules/autoroles/grant.ts. `botTopPosition` null
 * means unknown: no hierarchy warning rather than a false one.
 */
export function roleProblem(
  role: { id: string; managed: boolean; position: number; permissions: string } | undefined,
  ctx: { guildId: string; botTopPosition: number | null },
): string | null {
  if (!role) return "This role no longer exists, so nothing will be granted.";
  if (role.managed || role.id === ctx.guildId) return "This role can't be granted by the bot.";
  let isAdmin = false;
  try {
    isAdmin = (BigInt(role.permissions) & ADMINISTRATOR) !== 0n;
  } catch {
    isAdmin = false;
  }
  if (isAdmin) return "This role has the Administrator permission, so Auto Roles will never grant it.";
  if (ctx.botTopPosition !== null && role.position >= ctx.botTopPosition) {
    return "This role is at or above the bot's highest role, so the bot can't grant it. Move the bot's role higher in Server Settings \u2192 Roles.";
  }
  return null;
}

/** The stored shape: only the fields each requirement type actually uses. */
export function toSavedRule(rule: AutoRoleRule): Record<string, unknown> {
  return {
    id: rule.id,
    name: rule.name.trim(),
    enabled: rule.enabled,
    roleId: rule.roleId,
    requirements: rule.requirements.map((req) => {
      switch (req.type) {
        case "level":
          return { type: "level", level: req.level };
        case "tenure_days":
          return { type: "tenure_days", days: req.days };
        case "account_age_days":
          return { type: "account_age_days", days: req.days };
        case "on_join":
          return { type: "on_join" };
      }
    }),
  };
}
