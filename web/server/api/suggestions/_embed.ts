/**
 * Local copy of bot/modules/suggestions/embed.ts's builder (+ the status
 * display metadata from bot/modules/suggestions/status.ts). Duplicated rather
 * than shared — web/ cannot import from bot/, and this repo's convention (see
 * ../giveaways/_embed.ts) is local helpers per feature. The parity test
 * server/utils/suggestions-embed-parity.test.ts fails if the two drift:
 * change both files together.
 */
export type SuggestionStatus =
  | "pending"
  | "considering"
  | "approved"
  | "denied"
  | "implemented"
  | "withdrawn";

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

export const STATUS_META: Record<SuggestionStatus, { label: string; color: number; emoji: string }> = {
  pending: { label: "Pending", color: 0x99aab5, emoji: "🕓" },
  considering: { label: "Considering", color: 0xfee75c, emoji: "🤔" },
  approved: { label: "Approved", color: 0x57f287, emoji: "✅" },
  denied: { label: "Denied", color: 0xed4245, emoji: "❌" },
  implemented: { label: "Implemented", color: 0x3498db, emoji: "🚀" },
  withdrawn: { label: "Withdrawn", color: 0x4f545c, emoji: "🗑️" },
};

/** `denied` and `implemented` lock voting when the module's closeVotingOnDecision setting is on. */
export function isVotingLocked(status: SuggestionStatus, closeVotingOnDecision: boolean): boolean {
  if (status === "withdrawn") return true;
  return closeVotingOnDecision && (status === "denied" || status === "implemented");
}

const ACTION_ROW = 1;
const BUTTON = 2;
const SECONDARY = 2;

const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4000;
const MAX_FIELD_VALUE = 1024;

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function voteCustomId(suggestionId: string, direction: "up" | "down"): string {
  return `suggestions:vote:${suggestionId}:${direction}`;
}

export function buildSuggestionMessage(input: SuggestionEmbedInput): {
  embeds: unknown[];
  components: unknown[];
} {
  const meta = STATUS_META[input.status];
  const statusValue = `${meta.emoji} **${meta.label}**${input.reviewedBy ? ` — <@${input.reviewedBy}>` : ""}`;

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
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

  const embed = {
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
    ],
  };
}
