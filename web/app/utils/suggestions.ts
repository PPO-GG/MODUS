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

/** Panel limits/defaults — mirror SUGGESTION_PANEL_* in bot/lib/schemas.ts and web/server/utils/suggestions.ts. */
export const PANEL_LIMITS = { title: 100, blurb: 1500, buttonLabel: 80 } as const;
export const PANEL_DEFAULTS = {
  title: "Suggestions",
  blurb: "Have an idea for the server? Press the button below to submit it.",
  buttonLabel: "New suggestion",
} as const;

export interface PanelDraft {
  title: string;
  blurb: string;
  buttonLabel: string;
}

/** First problem with the panel texts, or null. Blank texts are fine: they save as the defaults. */
export function validatePanel(draft: PanelDraft): string | null {
  if (draft.title.trim().length > PANEL_LIMITS.title)
    return `The title must be ${PANEL_LIMITS.title} characters or fewer.`;
  if (draft.blurb.trim().length > PANEL_LIMITS.blurb)
    return `The blurb must be ${PANEL_LIMITS.blurb} characters or fewer.`;
  if (draft.buttonLabel.trim().length > PANEL_LIMITS.buttonLabel)
    return `The button label must be ${PANEL_LIMITS.buttonLabel} characters or fewer.`;
  return null;
}

/** Trimmed copy for saving/posting; blank texts become the defaults (Discord rejects empty embeds/labels). */
export function toSavedPanel(draft: PanelDraft): PanelDraft {
  return {
    title: draft.title.trim() || PANEL_DEFAULTS.title,
    blurb: draft.blurb.trim() || PANEL_DEFAULTS.blurb,
    buttonLabel: draft.buttonLabel.trim() || PANEL_DEFAULTS.buttonLabel,
  };
}

/** A stored panel text as shown in the form: kept when it is a non-blank string within the limit (trimmed length), otherwise the default. Mirrors the bot schema's fall-back-to-default. */
export function storedPanelText(value: unknown, limit: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const length = value.trim().length;
  return length > 0 && length <= limit ? value : fallback;
}

export type PanelAction = "posted" | "updated" | "reposted";

export function panelResultTitle(action: PanelAction): string {
  switch (action) {
    case "updated":
      return "Panel updated";
    case "reposted":
      return "Panel posted (the old message was gone)";
    default:
      return "Panel posted";
  }
}
