/**
 * Pure helpers for the Suggestions dashboard page. Statuses and limits mirror
 * bot/modules/suggestions/status.ts and web/server/utils/suggestions.ts.
 */

export type SuggestionStatus =
  | "pending"
  | "considering"
  | "approved"
  | "denied"
  | "implemented"
  | "withdrawn";
export type StaffStatus = Exclude<SuggestionStatus, "withdrawn">;

export const MAX_REASON_LENGTH = 500;

const LABELS: Record<SuggestionStatus, string> = {
  pending: "Pending",
  considering: "Considering",
  approved: "Approved",
  denied: "Denied",
  implemented: "Implemented",
  withdrawn: "Withdrawn",
};

export const STATUS_TABS: Array<{ value: SuggestionStatus; label: string }> = (
  ["pending", "considering", "approved", "denied", "implemented", "withdrawn"] as const
).map((value) => ({ value, label: LABELS[value] }));

export const STAFF_STATUS_OPTIONS: Array<{ value: StaffStatus; label: string }> = (
  ["pending", "considering", "approved", "denied", "implemented"] as const
).map((value) => ({ value, label: LABELS[value] }));

export function statusLabel(status: string): string {
  return (LABELS as Record<string, string>)[status] ?? status;
}

export function statusBadgeColor(
  status: string,
): "neutral" | "warning" | "success" | "error" | "info" {
  switch (status) {
    case "considering":
      return "warning";
    case "approved":
      return "success";
    case "denied":
      return "error";
    case "implemented":
      return "info";
    default:
      return "neutral";
  }
}

/** First problem with a review submission, or null when it can be sent. */
export function validateReview(status: string, reason: string): string | null {
  if (!STAFF_STATUS_OPTIONS.some((o) => o.value === status)) return "Choose a valid status.";
  if (reason.trim().length > MAX_REASON_LENGTH) {
    return `The reason must be ${MAX_REASON_LENGTH} characters or fewer.`;
  }
  return null;
}

export function relativeAge(iso: string, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}d`;
  return iso.slice(0, 10);
}

export function messageLink(
  guildId: string,
  channelId: string | null,
  messageId: string | null,
): string | null {
  if (!channelId || !messageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/**
 * Request gate: prevents race conditions by tracking token validity.
 * Use `next()` to bump the version and get a token, then check `isCurrent(token)`
 * to decide whether to apply a response (only apply if it's still the latest token).
 */
export function createRequestGate(): { next(): number; isCurrent(token: number): boolean } {
  let current = 0;
  return {
    next(): number {
      return ++current;
    },
    isCurrent(token: number): boolean {
      return token === current;
    },
  };
}
