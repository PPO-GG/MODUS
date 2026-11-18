/**
 * GET /api/admin/feedback
 *
 * Feedback that server admins sent with /feedback, newest first.
 * Query: status? (open | resolved), limit? (1-100, default 50), before? (ISO date).
 *
 * Auth: bot admins only. Rows hold user ids and messages from every guild.
 */
import { getRepos } from "../../utils/db";
import { requireBotAdmin } from "../../utils/session";
import { createFeedbackListHandler } from "../../utils/admin-feedback";

const handler = createFeedbackListHandler({
  authorize: requireBotAdmin,
  getQuery,
  getRepositories: getRepos,
  createHttpError: (statusCode, statusMessage) => createError({ statusCode, statusMessage }),
  logError: (error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`[Admin Feedback API] Postgres query failed (${errorName}).`);
  },
});

export default defineEventHandler(handler);
