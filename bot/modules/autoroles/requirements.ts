import type { AutoRole, AutoRoleRequirement } from "../../lib/schemas";

export const DAY_MS = 86_400_000;

export interface MemberFacts {
  /** null => unknown (partial member). */
  joinedAtMs: number | null;
  accountCreatedAtMs: number;
  /** null => not opted in to XP, or unknown. */
  level: number | null;
  isJoinEvent: boolean;
}

export function meetsRequirement(
  req: AutoRoleRequirement,
  facts: MemberFacts,
  nowMs: number,
): boolean {
  switch (req.type) {
    case "level":
      return facts.level !== null && facts.level >= req.level;
    case "tenure_days":
      return facts.joinedAtMs !== null && nowMs - facts.joinedAtMs >= req.days * DAY_MS;
    case "account_age_days":
      return nowMs - facts.accountCreatedAtMs >= req.days * DAY_MS;
    case "on_join":
      return facts.isJoinEvent;
  }
}

/** AND over all requirements. An empty list never qualifies. */
export function meetsAll(
  requirements: AutoRoleRequirement[],
  facts: MemberFacts,
  nowMs: number,
): boolean {
  return (
    requirements.length > 0 && requirements.every((r) => meetsRequirement(r, facts, nowMs))
  );
}

export function hasRequirement(rule: AutoRole, type: AutoRoleRequirement["type"]): boolean {
  return rule.requirements.some((r) => r.type === type);
}

export function isLevelOnly(rule: AutoRole): boolean {
  return rule.requirements.length > 0 && rule.requirements.every((r) => r.type === "level");
}

/** Rules with time-based requirements can only be swept by scanning the member list. */
export function needsMemberList(rule: AutoRole): boolean {
  return hasRequirement(rule, "tenure_days") || hasRequirement(rule, "account_age_days");
}

export function maxLevelRequirement(rule: AutoRole): number {
  let max = 0;
  for (const r of rule.requirements) {
    if (r.type === "level" && r.level > max) max = r.level;
  }
  return max;
}
