/** Request-body validation for POST /api/suggestions/review (pure, so it can be unit-tested). */
export const STAFF_STATUSES = ["pending", "considering", "approved", "denied", "implemented"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const MAX_REASON_LENGTH = 500;

export type ReviewBody = {
  guildId: string;
  id: string;
  status: StaffStatus;
  reason: string | null;
};

export function parseReviewBody(
  body: unknown,
): { ok: true; value: ReviewBody } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const guildId = typeof b.guild_id === "string" ? b.guild_id.trim() : "";
  const id = typeof b.id === "string" ? b.id.trim() : "";
  const status = typeof b.status === "string" ? b.status : "";
  if (!guildId || !id || !status) {
    return { ok: false, message: "Missing required fields: guild_id, id, status." };
  }
  if (!(STAFF_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: `status must be one of: ${STAFF_STATUSES.join(", ")}.` };
  }
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, message: `reason must be ${MAX_REASON_LENGTH} characters or fewer.` };
  }
  return {
    ok: true,
    value: { guildId, id, status: status as StaffStatus, reason: reason || null },
  };
}

/** Panel limits/defaults — mirror SUGGESTION_PANEL_* in bot/lib/schemas.ts (a parity test pins them). */
export const PANEL_LIMITS = { title: 100, blurb: 1500, buttonLabel: 80 } as const;
export const PANEL_DEFAULTS = {
  title: "Suggestions",
  blurb: "Have an idea for the server? Press the button below to submit it.",
  buttonLabel: "New suggestion",
} as const;

export type PanelBody = {
  guildId: string;
  channelId: string;
  title: string;
  blurb: string;
  buttonLabel: string;
};

/** Request-body validation for POST /api/suggestions/panel (pure). Blank texts fall back to the defaults. */
export function parsePanelBody(
  body: unknown,
): { ok: true; value: PanelBody } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const guildId = text(b.guild_id);
  const channelId = text(b.channel_id);
  if (!guildId || !channelId) {
    return { ok: false, message: "Missing required fields: guild_id, channel_id." };
  }
  // The id is interpolated into Discord REST paths: digits only.
  if (!/^\d{15,25}$/.test(channelId)) {
    return { ok: false, message: "channel_id must be a Discord channel id." };
  }
  const title = text(b.title) || PANEL_DEFAULTS.title;
  const blurb = text(b.blurb) || PANEL_DEFAULTS.blurb;
  const buttonLabel = text(b.button_label) || PANEL_DEFAULTS.buttonLabel;
  if (title.length > PANEL_LIMITS.title) {
    return { ok: false, message: `title must be ${PANEL_LIMITS.title} characters or fewer.` };
  }
  if (blurb.length > PANEL_LIMITS.blurb) {
    return { ok: false, message: `blurb must be ${PANEL_LIMITS.blurb} characters or fewer.` };
  }
  if (buttonLabel.length > PANEL_LIMITS.buttonLabel) {
    return { ok: false, message: `button_label must be ${PANEL_LIMITS.buttonLabel} characters or fewer.` };
  }
  return { ok: true, value: { guildId, channelId, title, blurb, buttonLabel } };
}

/** Edit the stored panel message only when it lives in the requested channel; otherwise post a new one. */
export function resolveDeployMode(
  stored: { panelChannelId?: unknown; panelMessageId?: unknown },
  channelId: string,
): { mode: "edit"; messageId: string } | { mode: "post" } {
  if (
    typeof stored.panelChannelId === "string" &&
    stored.panelChannelId === channelId &&
    typeof stored.panelMessageId === "string" &&
    stored.panelMessageId !== ""
  ) {
    return { mode: "edit", messageId: stored.panelMessageId };
  }
  return { mode: "post" };
}

/** The panel can only be posted to a text (0) or announcement (5) channel of THIS guild. */
export function isPostablePanelChannel(channel: unknown, guildId: string): boolean {
  if (typeof channel !== "object" || channel === null) return false;
  const c = channel as { guild_id?: unknown; type?: unknown };
  return c.guild_id === guildId && (c.type === 0 || c.type === 5);
}

/** Discord rejects edits to a message in an archived thread with error 50083. */
export function isArchivedThreadError(error: unknown): boolean {
  const e = error as { data?: { code?: unknown }; response?: { _data?: { code?: unknown } } } | null;
  return (e?.data?.code ?? e?.response?._data?.code) === 50083;
}
