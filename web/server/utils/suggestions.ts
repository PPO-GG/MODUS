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
