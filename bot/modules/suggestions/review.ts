import type { SuggestionRepository, SuggestionRow, SuggestionVoteRepository } from "@modus/db";
import {
  buildSuggestionMessage,
  embedInputFromRow,
  type SuggestionMessagePayload,
} from "./embed";
import { STATUS_META, type StaffStatus } from "./status";

export interface ReviewDeps {
  suggestions: Pick<SuggestionRepository, "setStatus" | "markWithdrawn">;
  votes: Pick<SuggestionVoteRepository, "tally">;
  /** Edits the posted message; "missing" when it no longer exists. Throws on other errors. */
  editMessage(
    suggestion: SuggestionRow,
    payload: SuggestionMessagePayload,
  ): Promise<"ok" | "missing">;
  /** Best-effort note in the suggestion's discussion thread. */
  postThreadNote(suggestion: SuggestionRow, content: string): Promise<void>;
}

export type ReviewResult =
  | {
      ok: true;
      suggestion: SuggestionRow;
      embedUpdated: boolean;
      /** True when the posted message was gone, so the suggestion was marked withdrawn. */
      withdrawn: boolean;
    }
  | { ok: false; reason: "withdrawn" };

/** Shared by `/suggestion review`; the dashboard route repeats these steps over REST. */
export async function applyReview(
  deps: ReviewDeps,
  suggestion: SuggestionRow,
  input: {
    status: StaffStatus;
    reason: string | null;
    reviewerId: string;
    closeVotingOnDecision: boolean;
  },
): Promise<ReviewResult> {
  if (suggestion.status === "withdrawn") return { ok: false, reason: "withdrawn" };

  const updated = await deps.suggestions.setStatus(suggestion.id, {
    status: input.status,
    reason: input.reason,
    reviewedBy: input.reviewerId,
  });
  if (!updated) return { ok: false, reason: "withdrawn" };

  const tally = await deps.votes.tally(updated.id);
  const payload = buildSuggestionMessage(
    embedInputFromRow(updated, tally, input.closeVotingOnDecision),
  );

  let embedUpdated = false;
  let withdrawn = false;
  try {
    const result = await deps.editMessage(updated, payload);
    if (result === "missing") {
      await deps.suggestions.markWithdrawn(updated.id);
      withdrawn = true;
    } else embedUpdated = true;
  } catch {
    // The status is saved; the caller reports that the message could not be refreshed.
  }

  if (updated.threadId && !withdrawn) {
    const note =
      `Marked **${STATUS_META[input.status].label}** by <@${input.reviewerId}>` +
      (input.reason ? `: ${input.reason}` : "");
    try {
      await deps.postThreadNote(updated, note);
    } catch {
      // Archived/locked/deleted thread — never fail the review over a courtesy note.
    }
  }

  return { ok: true, suggestion: updated, embedUpdated, withdrawn };
}
