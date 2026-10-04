import type { StarboardBoard } from "../../lib/schemas";
import { normalizeEmoji } from "./boards";
import { isEligibleChannel, type SourceChannel } from "./evaluate";

const IMAGE_CONTENT_TYPE = /^image\//i;
/**
 * A link whose PATH ends in an image extension. The path excludes `?` and `#`, so
 * an extension that only appears in the query does not count; after the optional
 * query/fragment the link must end (end of text, whitespace, a closing bracket,
 * or sentence punctuation followed by whitespace/end), which rejects `a.png.exe`.
 */
const IMAGE_URL =
  /https?:\/\/[^\s<>?#]+?\.(?:png|jpe?g|gif|webp)(?:[?#][^\s<>]*)?(?=$|[\s<>)\]]|[.,!?;:](?:\s|$))/i;

export interface AutoReactMessage {
  guildId: string | null;
  authorBot: boolean;
  system: boolean;
  content: string;
  attachments: ReadonlyArray<{ contentType: string | null }>;
}

/** Whether the message carries an image attachment or a direct image link. */
export function hasImage(message: Pick<AutoReactMessage, "content" | "attachments">): boolean {
  return (
    message.attachments.some((a) => a.contentType !== null && IMAGE_CONTENT_TYPE.test(a.contentType)) ||
    IMAGE_URL.test(message.content)
  );
}

/** Human, in-guild, non-system message with an image: the only kind that gets seeded. */
export function isSeedCandidate(message: AutoReactMessage): boolean {
  return message.guildId !== null && !message.authorBot && !message.system && hasImage(message);
}

/**
 * Emojis to seed on a message in `channel`: every enabled auto-react board that
 * watches this channel, in config order, de-duplicated (❤ and ❤️ are one emoji).
 * Values are as stored on the board — a unicode glyph or a custom-emoji id.
 */
export function planReactions(
  boards: readonly StarboardBoard[],
  channel: SourceChannel,
  boardChannelIds: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const emojis: string[] = [];
  for (const board of boards) {
    if (!board.enabled || !board.autoReact) continue;
    if (!isEligibleChannel(board, channel, boardChannelIds)) continue;
    const key = normalizeEmoji(board.emoji);
    if (seen.has(key)) continue;
    seen.add(key);
    emojis.push(board.emoji);
  }
  return emojis;
}

export type ReactResult = "ok" | "gone" | "failed";

/**
 * Adds the reactions one after another. `react` reports its own outcome: a
 * message that no longer exists ("gone") ends the run, any other failure (an
 * emoji the bot cannot use, a transient API error) only skips that emoji.
 * Never throws — a throwing `react` counts as a failure.
 */
export async function seedReactions(
  react: (emoji: string) => Promise<ReactResult>,
  emojis: readonly string[],
): Promise<void> {
  for (const emoji of emojis) {
    let result: ReactResult;
    try {
      result = await react(emoji);
    } catch {
      result = "failed";
    }
    if (result === "gone") return;
  }
}
