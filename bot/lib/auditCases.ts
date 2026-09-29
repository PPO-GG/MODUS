import { AuditLogEvent } from "discord.js";

/** The subset of a discord.js GuildAuditLogsEntry the mapper needs (plain data, easy to test). */
export interface AuditEntryLike {
  action: number;
  targetId: string | null;
  executorId: string | null;
  reason: string | null;
  createdTimestamp: number;
  changes: Array<{ key: string; old?: unknown; new?: unknown }>;
}

export interface AuditCaseInput {
  action: "kick" | "ban" | "unban" | "timeout" | "untimeout";
  targetId: string;
  moderatorId: string | null;
  reason: string | null;
  durationMinutes: number | null;
  createdAt: Date;
}

/**
 * Map a native Discord moderation audit entry to a case, or null if it isn't
 * one. Entries executed by the bot itself are skipped — the command path has
 * already recorded them.
 */
export function auditEntryToCase(entry: AuditEntryLike, botUserId: string): AuditCaseInput | null {
  if (!entry.targetId) return null;
  if (entry.executorId === botUserId) return null;

  const base = {
    targetId: entry.targetId,
    moderatorId: entry.executorId ?? null,
    reason: entry.reason ?? null,
    createdAt: new Date(entry.createdTimestamp),
  };

  switch (entry.action) {
    case AuditLogEvent.MemberBanAdd:
      return { ...base, action: "ban", durationMinutes: null };
    case AuditLogEvent.MemberBanRemove:
      return { ...base, action: "unban", durationMinutes: null };
    case AuditLogEvent.MemberKick:
      return { ...base, action: "kick", durationMinutes: null };
    case AuditLogEvent.MemberUpdate: {
      const change = entry.changes.find((c) => c.key === "communication_disabled_until");
      if (!change) return null;
      if (change.new) {
        const until = Date.parse(String(change.new));
        const minutes = Math.round((until - entry.createdTimestamp) / 60_000);
        return { ...base, action: "timeout", durationMinutes: Number.isFinite(minutes) ? Math.max(1, minutes) : null };
      }
      if (change.old) return { ...base, action: "untimeout", durationMinutes: null };
      return null;
    }
    default:
      return null;
  }
}
