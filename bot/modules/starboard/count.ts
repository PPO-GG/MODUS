/** Reactors are paged 100 at a time, up to this many users. */
export const REACTOR_FETCH_CAP = 1000;

export interface UserLike {
  id: string;
  bot?: boolean | null;
}

/** The slice of discord.js MessageReaction this module needs (a Collection satisfies the fetch result). */
export interface ReactionLike {
  count: number | null;
  users: {
    fetch(options: {
      limit: number;
      after?: string;
    }): Promise<{ size: number; values(): Iterable<UserLike> }>;
  };
}

/**
 * Number of distinct non-bot reactors other than the message author. Pages
 * through the reaction's users; past REACTOR_FETCH_CAP the exact filtered
 * count isn't worth the REST cost, so it falls back to `reaction.count`.
 */
export async function countReactors(reaction: ReactionLike, authorId: string): Promise<number> {
  let counted = 0;
  let fetched = 0;
  let after: string | undefined;

  while (fetched < REACTOR_FETCH_CAP) {
    const page = await reaction.users.fetch({ limit: 100, after });
    if (page.size === 0) return counted;

    let maxId = after;
    for (const user of page.values()) {
      if (!user.bot && user.id !== authorId) counted++;
      if (maxId === undefined || BigInt(user.id) > BigInt(maxId)) maxId = user.id;
    }
    fetched += page.size;
    if (page.size < 100) return counted;
    after = maxId;
  }

  return reaction.count ?? counted;
}
