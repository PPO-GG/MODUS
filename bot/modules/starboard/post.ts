import type { APIEmbed } from "discord.js";

export interface BoardAttachment {
  url: string;
  name: string;
  contentType: string | null;
  /** Spoiler-flagged uploads must never be shown inline in the embed. */
  spoiler: boolean;
}

export interface BoardPostInput {
  guildId: string;
  channelId: string;
  messageId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  attachments: BoardAttachment[];
  createdAtMs: number;
  count: number;
  emojiDisplay: string;
}

export interface BoardMessagePayload {
  content: string;
  embeds: APIEmbed[];
}

const EMBED_COLOR = 0xffac33;
const MAX_DESCRIPTION = 4000;
const MAX_LISTED_ATTACHMENTS = 5;
const MAX_FIELD_VALUE = 1024;

export function jumpUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/** Backslash-escapes the characters that would break out of a markdown link's text. */
function escapeLinkText(name: string): string {
  return name.replace(/[\\[\]]/g, "\\$&");
}

/** Whole `[name](url)` lines only: stops at the first line that would overflow the field. */
function listAttachments(attachments: BoardAttachment[]): string {
  const lines: string[] = [];
  let length = 0;
  for (const a of attachments.slice(0, MAX_LISTED_ATTACHMENTS)) {
    const line = `[${escapeLinkText(a.name)}](${a.url})${a.spoiler ? " (spoiler)" : ""}`;
    const next = length + (lines.length > 0 ? 1 : 0) + line.length;
    if (next > MAX_FIELD_VALUE) break;
    lines.push(line);
    length = next;
  }
  return lines.join("\n");
}

export function buildBoardMessage(input: BoardPostInput): BoardMessagePayload {
  const firstImage = input.attachments.find(
    (a) => !a.spoiler && a.contentType?.startsWith("image/"),
  );
  const listed = listAttachments(input.attachments.filter((a) => a !== firstImage));

  const fields: NonNullable<APIEmbed["fields"]> = [
    {
      name: "Source",
      value: `[Jump to message](${jumpUrl(input.guildId, input.channelId, input.messageId)})`,
    },
  ];
  if (listed) fields.push({ name: "Attachments", value: listed });

  const description =
    input.content.length > MAX_DESCRIPTION
      ? `${input.content.slice(0, MAX_DESCRIPTION - 1)}…`
      : input.content;

  const embed: APIEmbed = {
    color: EMBED_COLOR,
    author: input.authorAvatarUrl
      ? { name: input.authorName, icon_url: input.authorAvatarUrl }
      : { name: input.authorName },
    fields,
    timestamp: new Date(input.createdAtMs).toISOString(),
  };
  if (description) embed.description = description;
  if (firstImage) embed.image = { url: firstImage.url };

  return {
    content: `${input.emojiDisplay} **${input.count}** | <#${input.channelId}>`,
    embeds: [embed],
  };
}
