/**
 * GET /api/automod/draft-status?guild_id=
 *
 * Whether AI rule drafts are available for this guild and why not. Never
 * returns keys.
 * Returns: { available: boolean, source: "guild" | "shared" | null, reason?: "not_premium" | "no_shared_key" }
 */
import { createDraftStatusHandler } from "../../utils/automod-draft";
import { automodDraftDeps } from "../../utils/automod-draft-runtime";

export default defineEventHandler(createDraftStatusHandler(automodDraftDeps));
