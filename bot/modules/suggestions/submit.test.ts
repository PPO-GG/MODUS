import { describe, expect, it, vi } from "vitest";
import type { SuggestionRow } from "@modus/db";
import { submitSuggestion, type SubmitDeps } from "./submit";

const created: SuggestionRow = {
  id: "sug-1",
  guildId: "g1",
  number: 12,
  authorId: "u1",
  title: "Movie night",
  body: "Fridays?",
  status: "pending",
  statusReason: null,
  reviewedBy: null,
  reviewedAt: null,
  channelId: null,
  messageId: null,
  threadId: null,
  createdAt: new Date("2026-10-02T12:00:00Z"),
};

function makeDeps(over: Partial<SubmitDeps> = {}) {
  const deps = {
    suggestions: {
      create: vi.fn(async () => created),
      setPost: vi.fn(async () => undefined),
      deleteById: vi.fn(async () => undefined),
    },
    post: vi.fn(async () => ({ channelId: "c1", messageId: "m1" })),
    createThread: vi.fn(async () => "t1" as string | null),
    deletePost: vi.fn(async () => undefined),
    ...over,
  };
  return deps;
}

const input = { guildId: "g1", authorId: "u1", title: "Movie night", body: "Fridays?", createThread: true };

describe("submitSuggestion", () => {
  it("creates the row, posts the embed with 0/0 votes, stores the message and thread, returns a jump link", async () => {
    const deps = makeDeps();
    const result = await submitSuggestion(deps, input);

    expect(deps.suggestions.create).toHaveBeenCalledWith({
      guildId: "g1",
      authorId: "u1",
      title: "Movie night",
      body: "Fridays?",
    });
    const [, payload] = deps.post.mock.calls[0] as unknown as [SuggestionRow, any];
    expect(payload.embeds[0].title).toBe("#12 Movie night");
    expect(payload.components[0].components.map((b: any) => b.label)).toEqual(["▲ 0", "▼ 0"]);
    expect(deps.suggestions.setPost).toHaveBeenNthCalledWith(1, "sug-1", { channelId: "c1", messageId: "m1" });
    expect(deps.suggestions.setPost).toHaveBeenNthCalledWith(2, "sug-1", {
      channelId: "c1",
      messageId: "m1",
      threadId: "t1",
    });
    expect(result).toMatchObject({
      ok: true,
      messageUrl: "https://discord.com/channels/g1/c1/m1",
    });
  });

  it("skips thread creation when createThread is off", async () => {
    const deps = makeDeps();
    await submitSuggestion(deps, { ...input, createThread: false });
    expect(deps.createThread).not.toHaveBeenCalled();
    expect(deps.suggestions.setPost).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when the thread could not be created", async () => {
    const deps = makeDeps({ createThread: vi.fn(async () => null) });
    const result = await submitSuggestion(deps, input);
    expect(result.ok).toBe(true);
    expect(deps.suggestions.setPost).toHaveBeenCalledTimes(1);
  });

  it("deletes the row so the number is not burned when posting fails", async () => {
    const deps = makeDeps({
      post: vi.fn(async () => {
        throw new Error("Missing Access");
      }),
    });
    const result = await submitSuggestion(deps, input);
    expect(deps.suggestions.deleteById).toHaveBeenCalledWith("sug-1");
    expect(deps.suggestions.setPost).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/couldn't post/i);
  });

  it("(a) first setPost rejects: cleans up, reports persist error, returns friendly error", async () => {
    const reportError = vi.fn();
    const deps = makeDeps({
      suggestions: {
        create: vi.fn(async () => created),
        setPost: vi.fn(async () => {
          throw new Error("DB error");
        }),
        deleteById: vi.fn(async () => undefined),
      },
      reportError,
    });
    const result = await submitSuggestion(deps, input);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/couldn't post/i);
    expect((deps as any).deletePost).toHaveBeenCalledWith({ channelId: "c1", messageId: "m1" });
    expect(deps.suggestions.deleteById).toHaveBeenCalledWith("sug-1");
    expect(reportError).toHaveBeenCalledWith("persist", expect.any(Error));
  });

  it("(b) post rejects AND deleteById rejects: still returns friendly error, reports both", async () => {
    const reportError = vi.fn();
    const deps = makeDeps({
      post: vi.fn(async () => {
        throw new Error("Post error");
      }),
      reportError,
      suggestions: {
        create: vi.fn(async () => created),
        setPost: vi.fn(async () => undefined),
        deleteById: vi.fn(async () => {
          throw new Error("Delete error");
        }),
      },
    });
    const result = await submitSuggestion(deps, input);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/couldn't post/i);
    expect(reportError).toHaveBeenNthCalledWith(1, "post", expect.any(Error));
    expect(reportError).toHaveBeenNthCalledWith(2, "cleanup", expect.any(Error));
  });

  it("(c) deletePost rejecting during cleanup does not mask the result", async () => {
    const reportError = vi.fn();
    const deps = makeDeps({
      suggestions: {
        create: vi.fn(async () => created),
        setPost: vi.fn(async () => {
          throw new Error("DB error");
        }),
        deleteById: vi.fn(async () => undefined),
      },
      deletePost: vi.fn(async () => {
        throw new Error("Delete post error");
      }),
      reportError,
    });
    const result = await submitSuggestion(deps, input);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/couldn't post/i);
    expect(reportError).toHaveBeenCalledWith("persist", expect.any(Error));
  });

  it("(d) createThread rejecting returns ok:true with URL, reports thread error", async () => {
    const reportError = vi.fn();
    const deps = makeDeps({
      createThread: vi.fn(async () => {
        throw new Error("Thread error");
      }),
      reportError,
    });
    const result = await submitSuggestion(deps, input);

    expect(result.ok).toBe(true);
    expect(result.ok && result.messageUrl).toBe("https://discord.com/channels/g1/c1/m1");
    expect(reportError).toHaveBeenCalledWith("thread", expect.any(Error));
    expect(deps.suggestions.setPost).toHaveBeenCalledTimes(1);
  });

  it("(e) second setPost (thread id) rejecting returns ok:true, reports thread error", async () => {
    const reportError = vi.fn();
    let callCount = 0;
    const deps = makeDeps({
      suggestions: {
        create: vi.fn(async () => created),
        setPost: vi.fn(async () => {
          callCount++;
          if (callCount === 2) {
            throw new Error("Update thread error");
          }
        }),
        deleteById: vi.fn(async () => undefined),
      },
      reportError,
    });
    const result = await submitSuggestion(deps, input);

    expect(result.ok).toBe(true);
    expect(result.ok && result.messageUrl).toBe("https://discord.com/channels/g1/c1/m1");
    expect(reportError).toHaveBeenCalledWith("thread", expect.any(Error));
  });
});
