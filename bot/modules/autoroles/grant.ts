import { PermissionFlagsBits } from "discord.js";
import type { AutoRole } from "../../lib/schemas";
import { meetsAll, type MemberFacts } from "./requirements";

/**
 * "failed" = a free pre-check refused (no API call made); "error" = the Discord
 * role add was actually attempted and threw (counts toward the sweep breaker).
 */
export type GrantOutcome = "granted" | "recorded" | "skipped" | "failed" | "error";

/** The slice of discord.js GuildMember that granting needs (keeps tests Discord-free). */
export interface GrantMember {
  id: string;
  joinedTimestamp: number | null;
  /** true while the member has not passed Membership Screening. */
  pending: boolean | null;
  user: { bot: boolean; createdTimestamp: number };
  roles: {
    cache: { has(roleId: string): boolean };
    add(roleId: string, reason?: string): Promise<unknown>;
  };
  guild: {
    id: string;
    roles: {
      cache: {
        get(roleId: string):
          | {
              id: string;
              managed: boolean;
              position: number;
              permissions: { has(permission: bigint): boolean };
            }
          | undefined;
      };
    };
    members: {
      me: {
        permissions: { has(permission: bigint): boolean };
        roles: { highest: { position: number } };
      } | null;
    };
  };
}

export interface GrantDeps {
  grants: {
    insertIfAbsent(guildId: string, userId: string, ruleId: string): Promise<boolean>;
    delete(guildId: string, userId: string, ruleId: string): Promise<void>;
  };
  logger: { warn(message: string, guildId?: string, source?: string): unknown };
  nowMs(): number;
}

const LOG_THROTTLE_MS = 60 * 60_000;
const lastLogged = new Map<string, number>();

/** Test helper. */
export function resetLogThrottle(): void {
  lastLogged.clear();
}

function logOncePerHour(deps: GrantDeps, guildId: string, rule: AutoRole, reason: string): void {
  const key = `${guildId}:${rule.id}:${reason}`;
  const now = deps.nowMs();
  const last = lastLogged.get(key);
  if (last !== undefined && now - last < LOG_THROTTLE_MS) return;
  lastLogged.set(key, now);
  void deps.logger.warn(`Cannot grant rule "${rule.name}" (${rule.id}): ${reason}`, guildId, "autoroles");
}

/** Returns a human reason the role cannot be granted, or null when it can. */
function assignabilityProblem(member: GrantMember, rule: AutoRole): string | null {
  const role = member.guild.roles.cache.get(rule.roleId);
  if (!role) return "the target role no longer exists";
  if (role.managed) return "the target role is managed by an integration";
  if (role.id === member.guild.id) return "the target role is @everyone";
  if (role.permissions.has(PermissionFlagsBits.Administrator)) {
    return "the target role has the Administrator permission, which auto roles never grants";
  }
  const me = member.guild.members.me;
  if (!me) return "the bot's own member is unavailable";
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return "the bot lacks the Manage Roles permission";
  if (role.position >= me.roles.highest.position) return "the target role is not below the bot's highest role";
  return null;
}

/**
 * Idempotent grant shared by every trigger. The grant row is inserted first
 * (unique index) so concurrent triggers cannot double-grant, and deleted again
 * if the role add fails so a later fix self-heals.
 */
export async function tryGrant(
  deps: GrantDeps,
  member: GrantMember,
  rule: AutoRole,
): Promise<GrantOutcome> {
  if (member.user.bot) return "skipped";
  // Still in Membership Screening: granting now could bypass the rules gate.
  // The join path re-runs when they accept (guildMemberUpdate).
  if (member.pending === true) return "skipped";
  const guildId = member.guild.id;

  // Already has the role: record it (no API call) so a later manual removal sticks.
  if (member.roles.cache.has(rule.roleId)) {
    return (await deps.grants.insertIfAbsent(guildId, member.id, rule.id)) ? "recorded" : "skipped";
  }

  const problem = assignabilityProblem(member, rule);
  if (problem) {
    logOncePerHour(deps, guildId, rule, problem);
    return "failed";
  }

  if (!(await deps.grants.insertIfAbsent(guildId, member.id, rule.id))) return "skipped";

  try {
    await member.roles.add(rule.roleId, `Auto role: ${rule.name}`);
    return "granted";
  } catch (err) {
    await deps.grants.delete(guildId, member.id, rule.id).catch((rollbackErr: unknown) => {
      // Not throttled: a leftover grant row without the role blocks this member for this rule forever.
      void deps.logger.warn(
        `Auto role rollback failed for guild ${guildId}, user ${member.id}, rule ${rule.id}: ` +
          `the stale grant row must be removed manually (${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)})`,
        guildId,
        "autoroles",
      );
    });
    logOncePerHour(deps, guildId, rule, `role add failed (${err instanceof Error ? err.message : String(err)})`);
    return "error";
  }
}

export function memberFacts(
  member: GrantMember,
  level: number | null,
  isJoinEvent: boolean,
): MemberFacts {
  return {
    joinedAtMs: member.joinedTimestamp,
    accountCreatedAtMs: member.user.createdTimestamp,
    level,
    isJoinEvent,
  };
}

/** Evaluate `rules` for one member and grant every enabled rule they qualify for. */
export async function grantQualifyingRoles(
  deps: GrantDeps,
  member: GrantMember,
  rules: AutoRole[],
  ctx: { level: number | null; isJoinEvent: boolean },
): Promise<GrantOutcome[]> {
  const facts = memberFacts(member, ctx.level, ctx.isJoinEvent);
  const now = deps.nowMs();
  const outcomes: GrantOutcome[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !meetsAll(rule.requirements, facts, now)) continue;
    outcomes.push(await tryGrant(deps, member, rule));
  }
  return outcomes;
}
