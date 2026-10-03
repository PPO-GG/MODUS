import type { SuggestionRepository, SuggestionRow } from "@modus/db";
import {
  buildSuggestionMessage,
  embedInputFromRow,
  type SuggestionMessagePayload,
} from "./embed";

export interface SubmitDeps {
  suggestions: Pick<SuggestionRepository, "create" | "setPost" | "deleteById">;
  /** Posts the embed to the suggestions channel. Throws when it cannot. */
  post(
    suggestion: SuggestionRow,
    payload: SuggestionMessagePayload,
  ): Promise<{ channelId: string; messageId: string }>;
  /** Deletes a posted message from Discord. Best-effort; errors are swallowed. */
  deletePost(post: { channelId: string; messageId: string }): Promise<void>;
  /** Best-effort discussion thread; null when it could not be created. */
  createThread(
    suggestion: SuggestionRow,
    post: { channelId: string; messageId: string },
  ): Promise<string | null>;
  /** Optional error reporter for logging errors at different stages. */
  reportError?(stage: string, error: unknown): void;
}

export type SubmitResult =
  | { ok: true; suggestion: SuggestionRow; messageUrl: string }
  | { ok: false; error: string };

export async function submitSuggestion(
  deps: SubmitDeps,
  input: {
    guildId: string;
    authorId: string;
    title: string;
    body: string;
    createThread: boolean;
  },
): Promise<SubmitResult> {
  const suggestion = await deps.suggestions.create({
    guildId: input.guildId,
    authorId: input.authorId,
    title: input.title,
    body: input.body,
  });

  const payload = buildSuggestionMessage(embedInputFromRow(suggestion, { up: 0, down: 0 }, true));

  let posted: { channelId: string; messageId: string };
  try {
    posted = await deps.post(suggestion, payload);
  } catch (error) {
    // Do not burn the number: drop the row so the next suggestion reuses it.
    deps.reportError?.("post", error);
    try {
      await deps.suggestions.deleteById(suggestion.id);
    } catch (deleteError) {
      deps.reportError?.("cleanup", deleteError);
    }
    return {
      ok: false,
      error:
        "I couldn't post to the suggestions channel. Ask an admin to check my permissions there.",
    };
  }

  // Persist the message location; delete the Discord message if DB write fails.
  try {
    await deps.suggestions.setPost(suggestion.id, posted);
  } catch (error) {
    deps.reportError?.("persist", error);
    try {
      await deps.deletePost(posted);
    } catch {
      // Swallow deletePost errors; the result is determined by the persist error.
    }
    try {
      await deps.suggestions.deleteById(suggestion.id);
    } catch {
      // Swallow cleanup errors; the result is determined by the persist error.
    }
    return {
      ok: false,
      error:
        "I couldn't post to the suggestions channel. Ask an admin to check my permissions there.",
    };
  }

  // Thread creation is best-effort and does not block success.
  if (input.createThread) {
    try {
      const threadId = await deps.createThread(suggestion, posted);
      if (threadId) {
        try {
          await deps.suggestions.setPost(suggestion.id, { ...posted, threadId });
        } catch (error) {
          deps.reportError?.("thread", error);
        }
      }
    } catch (error) {
      deps.reportError?.("thread", error);
    }
  }

  return {
    ok: true,
    suggestion,
    messageUrl: `https://discord.com/channels/${input.guildId}/${posted.channelId}/${posted.messageId}`,
  };
}
