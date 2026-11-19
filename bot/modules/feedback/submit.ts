import type { RESTPostAPIWebhookWithTokenJSONBody } from "discord.js";
import type { BotFeedbackRepository, BotFeedbackRow, FeedbackContextV1 } from "@modus/db";

export const FEEDBACK_CATEGORIES = ["bug", "idea", "other"] as const;
type Category = (typeof FEEDBACK_CATEGORIES)[number];
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1500;
/** One submission per user per window. */
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export interface FeedbackDeps {
  feedback: Pick<BotFeedbackRepository, "create" | "countSince">;
  /** Webhook post. Throws on failure. */
  notify(row: BotFeedbackRow): Promise<void>;
  now(): Date;
  reportError?(stage: "notify", error: unknown): void;
}

export type FeedbackResult =
  | { ok: true; id: string; notified: boolean }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number }
  | { ok: false; reason: "invalid"; error: string };

export interface FeedbackInput {
  guildId: string;
  userId: string;
  category: string;
  message: string;
  contactOk: boolean;
  context: FeedbackContextV1;
}

const isCategory = (value: string): value is Category =>
  (FEEDBACK_CATEGORIES as readonly string[]).includes(value);

export async function submitFeedback(
  deps: FeedbackDeps,
  input: FeedbackInput,
): Promise<FeedbackResult> {
  const message = input.message.trim();
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return {
      ok: false,
      reason: "invalid",
      error: `Your message must be ${MESSAGE_MIN} to ${MESSAGE_MAX} characters long.`,
    };
  }
  if (!isCategory(input.category)) {
    return { ok: false, reason: "invalid", error: "Choose bug, idea or other as the category." };
  }

  const since = new Date(deps.now().getTime() - RATE_WINDOW_MS);
  if ((await deps.feedback.countSince(input.userId, since)) > 0) {
    // ponytail: countSince gives no timestamp, so this is the upper bound (a full window).
    // Upgrade path: return the newest row's createdAt from the repository.
    return { ok: false, reason: "rate_limited", retryAfterMs: RATE_WINDOW_MS };
  }

  // Save first: the table is the system of record, the webhook only a notification.
  const row = await deps.feedback.create({ ...input, category: input.category, message });
  try {
    await deps.notify(row);
    return { ok: true, id: row.id, notified: true };
  } catch (error) {
    deps.reportError?.("notify", error);
    return { ok: true, id: row.id, notified: false };
  }
}

const EMBED_COLOR: Record<string, number> = { bug: 0xed4245, idea: 0x57f287, other: 0x5865f2 };

export function buildWebhookPayload(row: BotFeedbackRow): RESTPostAPIWebhookWithTokenJSONBody {
  const ctx = row.context as Partial<FeedbackContextV1> | null;
  const guildName = ctx?.guildName ?? "unknown";
  return {
    // Empty parse list: a submission can never ping @everyone or roles.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `New ${row.category} feedback`,
        description: row.message,
        color: EMBED_COLOR[row.category] ?? EMBED_COLOR.other,
        timestamp: row.createdAt.toISOString(),
        fields: [
          { name: "Server", value: `${guildName} (${row.guildId})`.slice(0, 1024), inline: true },
          { name: "User", value: row.userId, inline: true },
          { name: "OK to contact", value: row.contactOk ? "Yes" : "No", inline: true },
          { name: "Bot version", value: String(ctx?.botVersion ?? "unknown"), inline: true },
        ],
      },
    ],
  };
}

/** True only for the exact string "true". */
export function isFeedbackEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.FEEDBACK_ENABLED === "true";
}

/**
 * POSTs the payload to the webhook URL. Thrown errors never carry the URL
 * (it is a secret): only the HTTP status or a fixed message.
 */
export async function postFeedbackWebhook(
  url: string,
  row: BotFeedbackRow,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildWebhookPayload(row)),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Feedback webhook request failed");
  }
  if (!response.ok) throw new Error(`Feedback webhook responded with status ${response.status}`);
}
