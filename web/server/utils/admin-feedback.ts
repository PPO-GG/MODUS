/**
 * Admin feedback inbox: query/body validation, DTO mapping and route handler
 * factories with injected dependencies (so tests can prove that auth runs
 * before any repository call).
 */
import type { BotFeedbackRow, FeedbackStatus } from "@modus/db";

export const DEFAULT_FEEDBACK_LIMIT = 50;

export interface FeedbackQuery {
  status?: FeedbackStatus;
  limit: number;
  before?: Date;
}

export interface FeedbackItemDto {
  id: string;
  guildId: string;
  userId: string;
  category: string;
  message: string;
  contactOk: boolean;
  context: unknown;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export class FeedbackRequestError extends Error {}

const STATUSES: readonly string[] = ["open", "resolved"];
const MAX_LIMIT = 100;

function single(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFeedbackQuery(raw: Record<string, unknown>): FeedbackQuery {
  const query: FeedbackQuery = { limit: DEFAULT_FEEDBACK_LIMIT };

  const status = single(raw.status);
  if (status !== undefined) {
    if (typeof status !== "string" || !STATUSES.includes(status)) {
      throw new FeedbackRequestError("status must be open or resolved.");
    }
    query.status = status as FeedbackStatus;
  }

  const limit = single(raw.limit);
  if (limit !== undefined) {
    const n = typeof limit === "string" && /^\d+$/.test(limit) ? Number(limit) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      throw new FeedbackRequestError(`limit must be a whole number from 1 to ${MAX_LIMIT}.`);
    }
    query.limit = n;
  }

  const before = single(raw.before);
  if (before !== undefined) {
    const date = typeof before === "string" && before !== "" ? new Date(before) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new FeedbackRequestError("before must be an ISO date.");
    }
    query.before = date;
  }

  return query;
}

export function parseFeedbackStatusBody(body: unknown): FeedbackStatus {
  const status = (body as { status?: unknown } | null)?.status;
  if (typeof status !== "string" || !STATUSES.includes(status)) {
    throw new FeedbackRequestError("status must be open or resolved.");
  }
  return status as FeedbackStatus;
}

export function toFeedbackItemDto(row: BotFeedbackRow): FeedbackItemDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    category: row.category,
    message: row.message,
    contactOk: row.contactOk,
    context: row.context,
    status: row.status,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedBy: row.resolvedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function defaultHttpError(statusCode: number, statusMessage: string): Error {
  return Object.assign(new Error(statusMessage), { statusCode, statusMessage });
}

const DB_UNAVAILABLE = "Database unavailable (NUXT_DATABASE_URL not set).";

interface HandlerBase<Event> {
  authorize: (event: Event) => Promise<{ userId: string }>;
  logError: (error: unknown) => void;
  createHttpError?: (statusCode: number, statusMessage: string) => unknown;
}

export interface FeedbackListDeps<Event> extends HandlerBase<Event> {
  getQuery: (event: Event) => Record<string, unknown>;
  getRepositories: () => {
    botFeedback: { list: (q: FeedbackQuery) => Promise<BotFeedbackRow[]> };
  } | null;
}

export interface FeedbackStatusDeps<Event> extends HandlerBase<Event> {
  getId: (event: Event) => string | undefined;
  readBody: (event: Event) => Promise<unknown>;
  getRepositories: () => {
    botFeedback: {
      setStatus: (
        id: string,
        status: FeedbackStatus,
        actorId: string,
      ) => Promise<BotFeedbackRow | null>;
    };
  } | null;
}

export function createFeedbackListHandler<Event>(deps: FeedbackListDeps<Event>) {
  const httpError = deps.createHttpError ?? defaultHttpError;
  return async (event: Event): Promise<{ items: FeedbackItemDto[] }> => {
    await deps.authorize(event);

    let query: FeedbackQuery;
    try {
      query = parseFeedbackQuery(deps.getQuery(event));
    } catch (error) {
      if (error instanceof FeedbackRequestError) throw httpError(400, error.message);
      throw error;
    }

    const repos = deps.getRepositories();
    if (!repos) throw httpError(503, DB_UNAVAILABLE);

    try {
      return { items: (await repos.botFeedback.list(query)).map(toFeedbackItemDto) };
    } catch (error) {
      deps.logError(error);
      throw httpError(500, "Failed to fetch feedback.");
    }
  };
}

export function createFeedbackStatusHandler<Event>(deps: FeedbackStatusDeps<Event>) {
  const httpError = deps.createHttpError ?? defaultHttpError;
  return async (event: Event): Promise<FeedbackItemDto> => {
    const { userId } = await deps.authorize(event);

    const id = deps.getId(event);
    if (!id) throw httpError(400, "Feedback id is required.");

    let status: FeedbackStatus;
    try {
      status = parseFeedbackStatusBody(await deps.readBody(event));
    } catch (error) {
      if (error instanceof FeedbackRequestError) throw httpError(400, error.message);
      throw error;
    }

    const repos = deps.getRepositories();
    if (!repos) throw httpError(503, DB_UNAVAILABLE);

    let row: BotFeedbackRow | null;
    try {
      row = await repos.botFeedback.setStatus(id, status, userId);
    } catch (error) {
      deps.logError(error);
      throw httpError(500, "Failed to update feedback.");
    }
    if (!row) throw httpError(404, "Feedback not found.");
    return toFeedbackItemDto(row);
  };
}
