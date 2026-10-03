import type {
  SuggestionRepository,
  SuggestionRow,
  SuggestionVoteRepository,
  VoteTally,
} from "@modus/db";
import { isVotingLocked, type SuggestionStatus } from "./status";

export interface VoteDeps {
  suggestions: Pick<SuggestionRepository, "getById">;
  votes: Pick<SuggestionVoteRepository, "toggle" | "tally">;
}

export type VoteOutcome =
  | { kind: "reply"; content: string }
  | { kind: "update"; suggestion: SuggestionRow; tally: VoteTally };

/** Applies one vote click. `reply` outcomes are ephemeral refusals that write nothing. */
export async function castVote(
  deps: VoteDeps,
  input: {
    suggestionId: string;
    userId: string;
    direction: "up" | "down";
    closeVotingOnDecision: boolean;
    guildId: string;
  },
): Promise<VoteOutcome> {
  const suggestion = await deps.suggestions.getById(input.suggestionId);
  if (!suggestion || suggestion.status === "withdrawn") {
    return { kind: "reply", content: "This suggestion is no longer available." };
  }
  if (suggestion.guildId !== input.guildId) {
    return { kind: "reply", content: "This suggestion is no longer available." };
  }
  if (suggestion.authorId === input.userId) {
    return { kind: "reply", content: "You can't vote on your own suggestion." };
  }
  if (isVotingLocked(suggestion.status as SuggestionStatus, input.closeVotingOnDecision)) {
    return { kind: "reply", content: "Voting is closed for this suggestion." };
  }

  await deps.votes.toggle(input.suggestionId, input.userId, input.direction);
  const tally = await deps.votes.tally(input.suggestionId);
  // Re-read after the tally: a staff review that landed during the vote must not be
  // overwritten by an embed rendered from the stale pre-vote row.
  const fresh = (await deps.suggestions.getById(input.suggestionId)) ?? suggestion;
  return { kind: "update", suggestion: fresh, tally };
}
