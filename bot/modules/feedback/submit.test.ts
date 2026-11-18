import { describe, expect, it, vi } from "vitest";
import type { BotFeedbackRow, FeedbackContextV1 } from "@modus/db";
import {
  buildWebhookPayload,
  isFeedbackEnabled,
  postFeedbackWebhook,
  submitFeedback,
  RATE_WINDOW_MS,
  type FeedbackDeps,
  type FeedbackInput,
} from "./submit";
import { createFeedbackModule } from "./index";

const NOW = new Date("2026-11-18T12:00:00Z");
const MINUTE = 60_000;

const context: FeedbackContextV1 = {
  v: 1,
  guildName: "Test Guild",
  memberCount: 42,
  shardId: 0,
  botVersion: "1.37.1",
  locale: "en-US",
};

const input = (over: Partial<FeedbackInput> = {}): FeedbackInput => ({
  guildId: "g1",
  userId: "u1",
  category: "bug",
  message: "The play command fails.",
  contactOk: true,
  context,
  ...over,
});

const row = (over: Partial<BotFeedbackRow> = {}): BotFeedbackRow => ({
  id: "f1",
  guildId: "g1",
  userId: "u1",
  category: "bug",
  message: "The play command fails.",
  contactOk: true,
  context,
  status: "open",
  resolvedAt: null,
  resolvedBy: null,
  createdAt: NOW,
  ...over,
});

/** Fake repo: countSince honours `since` against the given row timestamps. */
function makeDeps(existing: Date[] = [], over: Partial<FeedbackDeps> = {}) {
  const deps = {
    feedback: {
      create: vi.fn(async () => row()),
      countSince: vi.fn(async (_userId: string, since: Date) =>
        existing.filter((d) => d.getTime() >= since.getTime()).length,
      ),
    },
    notify: vi.fn(async () => undefined),
    now: () => NOW,
    reportError: vi.fn(),
    ...over,
  };
  return deps;
}

describe("submitFeedback", () => {
  it("saves once and notifies once when valid", async () => {
    const deps = makeDeps();
    const result = await submitFeedback(deps, input());
    expect(result).toEqual({ ok: true, id: "f1", notified: true });
    expect(deps.feedback.create).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("keeps the row and reports notify failure", async () => {
    const boom = new Error("down");
    const deps = makeDeps([], { notify: vi.fn(async () => { throw boom; }) });
    const result = await submitFeedback(deps, input());
    expect(result).toEqual({ ok: true, id: "f1", notified: false });
    expect(deps.feedback.create).toHaveBeenCalledTimes(1);
    expect(deps.reportError).toHaveBeenCalledWith("notify", boom);
  });

  it("refuses with retryAfterMs when the user already sent one in the last hour", async () => {
    const deps = makeDeps([new Date(NOW.getTime() - 10 * MINUTE)]);
    const result = await submitFeedback(deps, input());
    expect(result).toEqual({ ok: false, reason: "rate_limited", retryAfterMs: RATE_WINDOW_MS });
    expect(deps.feedback.create).not.toHaveBeenCalled();
  });

  it("asks the repository to count since exactly one window ago", async () => {
    const deps = makeDeps();
    await submitFeedback(deps, input());
    expect(deps.feedback.countSince).toHaveBeenCalledWith(
      "u1",
      new Date(NOW.getTime() - RATE_WINDOW_MS),
    );
  });

  it("accepts when the last row is 61 minutes old", async () => {
    const deps = makeDeps([new Date(NOW.getTime() - 61 * MINUTE)]);
    const result = await submitFeedback(deps, input());
    expect(result.ok).toBe(true);
  });

  it.each([
    ["too short after trim", "   short   "],
    ["whitespace only", "            "],
    ["over the limit", "x".repeat(1501)],
  ])("refuses a message that is %s", async (_name, message) => {
    const deps = makeDeps();
    const result = await submitFeedback(deps, input({ message }));
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(deps.feedback.create).not.toHaveBeenCalled();
  });

  it("accepts messages of exactly 10 and 1500 characters", async () => {
    const short = await submitFeedback(makeDeps(), input({ message: "x".repeat(10) }));
    const long = await submitFeedback(makeDeps(), input({ message: "x".repeat(1500) }));
    expect([short.ok, long.ok]).toEqual([true, true]);
  });

  it("stores the trimmed message", async () => {
    const deps = makeDeps();
    await submitFeedback(deps, input({ message: "   a perfectly fine message   " }));
    expect(deps.feedback.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: "a perfectly fine message" }),
    );
  });

  it("refuses a category outside bug, idea, other", async () => {
    const deps = makeDeps();
    const result = await submitFeedback(deps, input({ category: "rant" }));
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(deps.feedback.create).not.toHaveBeenCalled();
  });
});

describe("buildWebhookPayload", () => {
  it("blocks all mentions", () => {
    const payload = buildWebhookPayload(row({ message: "hello @everyone <@123>" }));
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });

  it("includes guild name, guild id, user id, category, contact flag and bot version", () => {
    const text = JSON.stringify(buildWebhookPayload(row()));
    for (const expected of ["Test Guild", "g1", "u1", "bug", "1.37.1"]) {
      expect(text).toContain(expected);
    }
    expect(text.toLowerCase()).toContain("contact");
  });

  it("fits a 1500 character message into the embed description limit", () => {
    const payload = buildWebhookPayload(row({ message: "x".repeat(1500) }));
    const description = payload.embeds?.[0]?.description ?? "";
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(4096);
  });
});

describe("isFeedbackEnabled", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["1", false],
    ["TRUE", false],
    ["true", true],
  ])("returns the right answer for %j", (value, expected) => {
    expect(isFeedbackEnabled({ FEEDBACK_ENABLED: value })).toBe(expected);
  });
});

describe("feedback module flag parity", () => {
  it("exports no commands when the flag is off", () => {
    expect(createFeedbackModule({}).commands ?? []).toEqual([]);
    expect(createFeedbackModule({ FEEDBACK_ENABLED: "TRUE" }).commands ?? []).toEqual([]);
  });

  it("exports /feedback restricted to Manage Server when the flag is on", () => {
    const commands = createFeedbackModule({ FEEDBACK_ENABLED: "true" }).commands ?? [];
    const json = commands.map((c) => ("toJSON" in c ? c.toJSON() : c));
    expect(json.map((c) => c.name)).toEqual(["feedback"]);
    // Manage Guild = 1 << 5
    expect(json[0]?.default_member_permissions).toBe("32");
  });
});

describe("postFeedbackWebhook", () => {
  const URL_SECRET = "https://discord.com/api/webhooks/123/secret-token";

  it("posts the payload as JSON to the URL", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    await postFeedbackWebhook(URL_SECRET, row(), fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(URL_SECRET);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).allowed_mentions).toEqual({ parse: [] });
  });

  it("throws without the URL when the webhook answers with an error status", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 404 }));
    const err = await postFeedbackWebhook(URL_SECRET, row(), fetchFn as unknown as typeof fetch).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).toContain("404");
    expect(String((err as Error).message)).not.toContain("secret-token");
  });

  it("throws without the URL when the request itself fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error(`connect failed for ${URL_SECRET}`);
    });
    const err = await postFeedbackWebhook(URL_SECRET, row(), fetchFn as unknown as typeof fetch).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toContain("secret-token");
  });
});
