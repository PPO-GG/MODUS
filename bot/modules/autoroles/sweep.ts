import type { AutoRole } from "../../lib/schemas";
import { memberFacts, type GrantMember, type GrantOutcome } from "./grant";
import { parseAutoRoles } from "./rules";
import {
  hasRequirement,
  isLevelOnly,
  maxLevelRequirement,
  meetsAll,
  needsMemberList,
} from "./requirements";

export const MAX_GRANTS_PER_GUILD_PER_SWEEP = 25;
export const GRANT_DELAY_MS = 250;
/** Consecutive failed role adds after which the guild's tick stops (systemic 403, e.g. MFA-elevated guild). */
export const MAX_CONSECUTIVE_ERRORS = 3;

export interface SweepDeps {
  /** Raw module settings (DatabaseService.getModuleSettings). */
  loadSettings(): Promise<unknown>;
  listGranted(ruleId: string): Promise<Set<string>>;
  /** Delete grants whose rule id is not in `keepRuleIds`; returns rows deleted. */
  reconcile(keepRuleIds: string[]): Promise<number>;
  listLevels(minLevel: number): Promise<Array<{ userId: string; level: number }>>;
  fetchMembers(): Promise<GrantMember[]>;
  getMember(userId: string): Promise<GrantMember | null>;
  tryGrant(member: GrantMember, rule: AutoRole): Promise<GrantOutcome>;
  nowMs(): number;
  sleep(ms: number): Promise<void>;
}

export interface SweepResult {
  granted: number;
  recorded: number;
  capped: boolean;
  /** Role adds that hit the Discord API and threw during this tick. */
  errors: number;
  /** True when the tick stopped early after MAX_CONSECUTIVE_ERRORS errors in a row. */
  aborted: boolean;
}

export async function sweepGuild(deps: SweepDeps): Promise<SweepResult> {
  const result: SweepResult = { granted: 0, recorded: 0, capped: false, errors: 0, aborted: false };
  const parsed = parseAutoRoles(await deps.loadSettings());

  // Only reconcile against a real rules array: DatabaseService returns {} when
  // the read fails, and treating that as "no rules" would wipe every grant.
  if (parsed.allRuleIds !== null) {
    await deps.reconcile(parsed.allRuleIds);
  }

  // on_join rules can only ever be satisfied on the join event.
  const rules = parsed.rules.filter((r) => r.enabled && !hasRequirement(r, "on_join"));
  if (rules.length === 0) return result;

  let members: GrantMember[] | null = null;
  let levelMap: Map<string, number> | null = null;
  const now = deps.nowMs();

  let consecutiveErrors = 0;

  // Returns false when the per-sweep cap is reached or the error breaker trips and the sweep should stop.
  const grantIfQualifies = async (
    member: GrantMember,
    rule: AutoRole,
    level: number | null,
  ): Promise<boolean> => {
    if (member.user.bot) return true;
    if (!meetsAll(rule.requirements, memberFacts(member, level, false), now)) return true;
    const outcome = await deps.tryGrant(member, rule);
    if (outcome === "error") {
      result.errors++;
      await deps.sleep(GRANT_DELAY_MS);
      if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        result.aborted = true;
        return false;
      }
      return true;
    }
    if (outcome === "granted" || outcome === "recorded") consecutiveErrors = 0;
    if (outcome === "recorded") result.recorded++;
    if (outcome === "granted") {
      result.granted++;
      await deps.sleep(GRANT_DELAY_MS);
      if (result.granted >= MAX_GRANTS_PER_GUILD_PER_SWEEP) {
        result.capped = true;
        return false;
      }
    }
    return true;
  };

  for (const rule of rules) {
    const granted = await deps.listGranted(rule.id);

    if (needsMemberList(rule)) {
      members ??= await deps.fetchMembers();
      if (hasRequirement(rule, "level") && !levelMap) {
        levelMap = new Map((await deps.listLevels(0)).map((r) => [r.userId, r.level]));
      }
      for (const member of members) {
        if (granted.has(member.id)) continue;
        const level = hasRequirement(rule, "level") ? (levelMap?.get(member.id) ?? null) : null;
        if (!(await grantIfQualifies(member, rule, level))) return result;
      }
    } else if (isLevelOnly(rule)) {
      for (const row of await deps.listLevels(maxLevelRequirement(rule))) {
        if (granted.has(row.userId)) continue;
        const member = await deps.getMember(row.userId);
        if (!member) continue;
        if (!(await grantIfQualifies(member, rule, row.level))) return result;
      }
    }
  }

  return result;
}
