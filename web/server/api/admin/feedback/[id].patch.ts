/**
 * PATCH /api/admin/feedback/:id
 *
 * Marks a feedback row resolved or open again.
 * Body: { status: "open" | "resolved" }
 *
 * Auth: bot admins only. The row stores who resolved it (resolvedBy).
 */
import { getRepos } from "../../../utils/db";
import { requireBotAdmin } from "../../../utils/session";
import { createFeedbackStatusHandler } from "../../../utils/admin-feedback";

const handler = createFeedbackStatusHandler({
  authorize: requireBotAdmin,
  getId: (event) => getRouterParam(event, "id"),
  readBody: (event) => readBody(event),
  getRepositories: getRepos,
  createHttpError: (statusCode, statusMessage) => createError({ statusCode, statusMessage }),
  logError: (error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`[Admin Feedback API] Postgres update failed (${errorName}).`);
  },
});

export default defineEventHandler(handler);
