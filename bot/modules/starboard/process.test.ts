import { describe, expect, it, vi } from "vitest";
import type { StarboardPostRow } from "@modus/db";
import type { StarboardBoard } from "../../lib/schemas";
import { processBoard, type PostStore, type ProcessDeps, type SourceRef } from "./process";

const board: StarboardBoard = {
  id: "b1",
  name: "S",
  enabled: true,
  emoji: "⭐",
  threshold: 3,
  channelId: "board-chan",
  ignoredChannelIds: [],
  deleteBelowThreshold: false,
};
const source: SourceRef = { guildId: "g1", channelId: "c1", messageId: "m1", authorId: "author" };

/** In-memory PostStore mimicking the repository's contract. */
function memoryStore(opts: { conflictOnInsert?: boolean } = {}) {
  const rows = new Map<string, StarboardPostRow>();
  let seq = 0;
  const store: PostStore = {
    get: async (guildId, boardId, sourceMessageId) =>
      [...rows.values()].find(
        (r) => r.guildId === guildId && r.boardId === boardId && r.sourceMessageId === sourceMessageId,
      ) ?? null,
    insertIfAbsent: async (input) => {
      if (opts.conflictOnInsert) return null;
      const row = {
        id: `p${++seq}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      } as StarboardPostRow;
      rows.set(row.id, row);
      return row;
    },
    update: async (id, patch) => {
      const row = rows.get(id)!;
      rows.set(id, { ...row, ...patch } as StarboardPostRow);
    },
    deleteById: async (id) => {
      rows.delete(id);
    },
  };
  return { store, rows };
}

function makeDeps(store: PostStore, count: number, over: Partial<ProcessDeps> = {}) {
  const deps = {
    posts: store,
    countStars: vi.fn(async () => count),
    sendPost: vi.fn(async (_count: number) => "new-bm"),
    editPost: vi.fn(async (_id: string, _count: number) => "ok" as const),
    deletePost: vi.fn(async (_id: string) => undefined),
    ...over,
  };
  return deps;
}

describe("processBoard", () => {
  it("does nothing below threshold with no post", async () => {
    const { store, rows } = memoryStore();
    const deps = makeDeps(store, 2);
    expect(await processBoard(deps, board, source)).toBe("noop");
    expect(deps.sendPost).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it("posts and records a row when the threshold is crossed", async () => {
    const { store, rows } = memoryStore();
    const deps = makeDeps(store, 3);
    expect(await processBoard(deps, board, source)).toBe("create");
    expect(deps.sendPost).toHaveBeenCalledWith(3);
    const row = [...rows.values()][0]!;
    expect(row).toMatchObject({
      guildId: "g1",
      boardId: "b1",
      sourceChannelId: "c1",
      sourceMessageId: "m1",
      authorId: "author",
      boardMessageId: "new-bm",
      starCount: 3,
    });
  });

  it("is a noop for an unchanged count and edits when the count changes", async () => {
    const { store, rows } = memoryStore();
    await processBoard(makeDeps(store, 3), board, source);

    const same = makeDeps(store, 3);
    expect(await processBoard(same, board, source)).toBe("noop");
    expect(same.editPost).not.toHaveBeenCalled();

    const more = makeDeps(store, 5);
    expect(await processBoard(more, board, source)).toBe("update");
    expect(more.editPost).toHaveBeenCalledWith("new-bm", 5);
    expect([...rows.values()][0]!.starCount).toBe(5);
  });

  it("clears the board message id when the post was deleted by hand, then reposts on the next star", async () => {
    const { store, rows } = memoryStore();
    await processBoard(makeDeps(store, 3), board, source);

    const missing = makeDeps(store, 4, { editPost: vi.fn(async () => "missing" as const) });
    expect(await processBoard(missing, board, source)).toBe("update");
    const cleared = [...rows.values()][0]!;
    expect(cleared.boardMessageId).toBeNull();
    expect(cleared.starCount).toBe(4);

    const repost = makeDeps(store, 4, { sendPost: vi.fn(async () => "reposted-bm") });
    expect(await processBoard(repost, board, source)).toBe("create");
    expect(rows.size).toBe(1);
    expect([...rows.values()][0]).toMatchObject({ boardMessageId: "reposted-bm", starCount: 4 });
  });

  it("leaves the row untouched when the edit failed for a non-missing reason", async () => {
    const { store, rows } = memoryStore();
    await processBoard(makeDeps(store, 3), board, source);

    const failed = makeDeps(store, 5, { editPost: vi.fn(async () => "failed" as const) });
    expect(await processBoard(failed, board, source)).toBe("update");
    expect(failed.editPost).toHaveBeenCalledWith("new-bm", 5);
    expect(failed.deletePost).not.toHaveBeenCalled();
    expect(failed.sendPost).not.toHaveBeenCalled();
    expect([...rows.values()][0]).toMatchObject({ boardMessageId: "new-bm", starCount: 3 });
  });

  it("deletes the post and row below threshold when deleteBelowThreshold is on", async () => {
    const { store, rows } = memoryStore();
    await processBoard(makeDeps(store, 3), board, source);
    const deps = makeDeps(store, 1);
    const strict = { ...board, deleteBelowThreshold: true };
    expect(await processBoard(deps, strict, source)).toBe("delete");
    expect(deps.deletePost).toHaveBeenCalledWith("new-bm");
    expect(rows.size).toBe(0);
  });

  it("keeps the post and shows the lower count when deleteBelowThreshold is off", async () => {
    const { store, rows } = memoryStore();
    await processBoard(makeDeps(store, 3), board, source);
    const deps = makeDeps(store, 1);
    expect(await processBoard(deps, board, source)).toBe("update");
    expect(deps.deletePost).not.toHaveBeenCalled();
    expect(deps.editPost).toHaveBeenCalledWith("new-bm", 1);
    expect([...rows.values()][0]!.starCount).toBe(1);
  });

  it("writes no row when sending the board post fails", async () => {
    const { store, rows } = memoryStore();
    const deps = makeDeps(store, 3, { sendPost: vi.fn(async () => null) });
    await processBoard(deps, board, source);
    expect(rows.size).toBe(0);
  });

  it("deletes the surplus post when another writer already claimed the row (unique-index backstop)", async () => {
    const { store, rows } = memoryStore({ conflictOnInsert: true });
    const deps = makeDeps(store, 3);
    await processBoard(deps, board, source);
    expect(deps.deletePost).toHaveBeenCalledWith("new-bm");
    expect(rows.size).toBe(0);
  });

  it("deletes the orphaned post when insertIfAbsent throws", async () => {
    const { store, rows } = memoryStore();
    const insertError = new Error("DB connection lost");
    const storeWithError: PostStore = {
      ...store,
      insertIfAbsent: vi.fn(async () => {
        throw insertError;
      }),
    };
    const deps = makeDeps(storeWithError, 3);
    await expect(processBoard(deps, board, source)).rejects.toBe(insertError);
    expect(deps.deletePost).toHaveBeenCalledWith("new-bm");
    expect(rows.size).toBe(0);
  });

  it("deletes the orphaned post when update throws on existing row", async () => {
    const { store, rows } = memoryStore();
    // First, create a post with null boardMessageId
    await processBoard(makeDeps(store, 3), board, source);
    const row = [...rows.values()][0]!;
    await store.update(row.id, { boardMessageId: null });

    // Now try to update with a new count, but update throws
    const updateError = new Error("DB timeout");
    const storeWithError: PostStore = {
      ...store,
      update: vi.fn(async () => {
        throw updateError;
      }),
    };
    const deps = makeDeps(storeWithError, 4);
    await expect(processBoard(deps, board, source)).rejects.toBe(updateError);
    expect(deps.deletePost).toHaveBeenCalledWith("new-bm");
  });

  it("rethrows the persistence error even if cleanup deletePost throws", async () => {
    const { store, rows } = memoryStore();
    const persistError = new Error("DB write failed");
    const storeWithError: PostStore = {
      ...store,
      insertIfAbsent: vi.fn(async () => {
        throw persistError;
      }),
    };
    const cleanupError = new Error("Cleanup failed");
    const deps = makeDeps(storeWithError, 3, {
      deletePost: vi.fn(async () => {
        throw cleanupError;
      }),
    });
    await expect(processBoard(deps, board, source)).rejects.toBe(persistError);
    expect(deps.deletePost).toHaveBeenCalledWith("new-bm");
    expect(rows.size).toBe(0);
  });
});
