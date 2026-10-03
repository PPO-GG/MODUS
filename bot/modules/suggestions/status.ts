import type { SuggestionStatus } from "@modus/db";

export type { SuggestionStatus };

/** Statuses staff may set. `withdrawn` is system-only and terminal. */
export const STAFF_STATUSES = [
  "pending",
  "considering",
  "approved",
  "denied",
  "implemented",
] as const satisfies readonly SuggestionStatus[];
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export function isStaffStatus(value: string): value is StaffStatus {
  return (STAFF_STATUSES as readonly string[]).includes(value);
}

export function isVotingLocked(status: SuggestionStatus, closeVotingOnDecision: boolean): boolean {
  if (status === "withdrawn") return true;
  return closeVotingOnDecision && (status === "denied" || status === "implemented");
}

export const STATUS_META: Record<SuggestionStatus, { label: string; color: number; emoji: string }> = {
  pending: { label: "Pending", color: 0x99aab5, emoji: "🕓" },
  considering: { label: "Considering", color: 0xfee75c, emoji: "🤔" },
  approved: { label: "Approved", color: 0x57f287, emoji: "✅" },
  denied: { label: "Denied", color: 0xed4245, emoji: "❌" },
  implemented: { label: "Implemented", color: 0x3498db, emoji: "🚀" },
  withdrawn: { label: "Withdrawn", color: 0x4f545c, emoji: "🗑️" },
};
