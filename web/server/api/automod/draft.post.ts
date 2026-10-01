/**
 * POST /api/automod/draft
 *
 * Turn a plain-English description into a validated draft automod rule using
 * the guild's own AI key, or the shared key if the guild is premium. Nothing is
 * saved; the dashboard loads the draft into the rule editor for review.
 *
 * Body: { guild_id: string, prompt: string (1-500 chars) }
 * Returns: { rule, warnings, notes }
 * Errors: 400 bad body, 401/403 access, 403 { reason } no usable AI key,
 *         422 { errors } model output failed validation, 429 too frequent,
 *         502 provider or Discord failure, 503 database unavailable.
 */
import { createDraftHandler } from "../../utils/automod-draft";
import { automodDraftDeps } from "../../utils/automod-draft-runtime";

export default defineEventHandler(createDraftHandler(automodDraftDeps));
