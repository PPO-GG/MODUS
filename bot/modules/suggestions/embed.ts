/**
 * Pure embed/component builders — no discord.js Client dependency, so they
 * are unit-testable and mirrored (as a locally duplicated copy, per this
 * repo's convention) by web/server/api/suggestions/_embed.ts. The parity test
 * web/server/utils/suggestions-embed-parity.test.ts fails if the two drift:
 * change both files together.
 */
import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from "discord.js";
import type { SuggestionRow, VoteTally } from "@modus/db";
import { isVotingLocked, STATUS_META, type SuggestionStatus } from "./status";

export interface SuggestionEmbedInput {
  id: string;
  number: number;
  title: string;
  body: string;
  authorId: string;
  status: SuggestionStatus;
  statusReason: string | null;
  reviewedBy: string | null;
  up: number;
  down: number;
  votingLocked: boolean;
  createdAtMs: number;
}

export interface SuggestionMessagePayload {
  embeds: APIEmbed[];
  components: APIActionRowComponent<APIButtonComponent>[];
}

// Numeric constants instead of discord.js enums so the web copy is identical.
const ACTION_ROW = 1;
const BUTTON = 2;
const SECONDARY = 2;

const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4000;
const MAX_FIELD_VALUE = 1024;

export const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function voteCustomId(suggestionId: string, direction: "up" | "down"): string {
  return `suggestions:vote:${suggestionId}:${direction}`;
}

export function buildSuggestionMessage(input: SuggestionEmbedInput): SuggestionMessagePayload {
  const meta = STATUS_META[input.status];
  const statusValue = `${meta.emoji} **${meta.label}**${input.reviewedBy ? ` — <@${input.reviewedBy}>` : ""}`;

  const fields: NonNullable<APIEmbed["fields"]> = [
    { name: "Submitted by", value: `<@${input.authorId}>`, inline: true },
    { name: "Status", value: truncate(statusValue, MAX_FIELD_VALUE), inline: true },
  ];
  if (input.statusReason) {
    fields.push({
      name: "Reason",
      value: truncate(input.statusReason, MAX_FIELD_VALUE),
      inline: false,
    });
  }

  const embed: APIEmbed = {
    title: truncate(`#${input.number} ${input.title}`, MAX_TITLE),
    description: truncate(input.body, MAX_DESCRIPTION),
    color: meta.color,
    fields,
    timestamp: new Date(input.createdAtMs).toISOString(),
  };

  const button = (direction: "up" | "down", label: string) => ({
    type: BUTTON,
    style: SECONDARY,
    custom_id: voteCustomId(input.id, direction),
    label,
    disabled: input.votingLocked,
  });

  return {
    embeds: [embed],
    components: [
      {
        type: ACTION_ROW,
        components: [button("up", `▲ ${input.up}`), button("down", `▼ ${input.down}`)],
      },
    ] as unknown as APIActionRowComponent<APIButtonComponent>[],
  };
}

export function embedInputFromRow(
  row: SuggestionRow,
  tally: VoteTally,
  closeVotingOnDecision: boolean,
): SuggestionEmbedInput {
  const status = row.status as SuggestionStatus;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    body: row.body,
    authorId: row.authorId,
    status,
    statusReason: row.statusReason,
    reviewedBy: row.reviewedBy,
    up: tally.up,
    down: tally.down,
    votingLocked: isVotingLocked(status, closeVotingOnDecision),
    createdAtMs: row.createdAt.getTime(),
  };
}
