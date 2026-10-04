import { ChannelType } from "discord.js";

export type SubmitTarget = "text" | "forum";

/**
 * How a suggestion is posted into the configured channel: an embed in a text or
 * announcement channel (plus an optional thread), or one forum post for a forum
 * or media channel. null = a channel type suggestions cannot live in.
 */
export function submitTarget(type: ChannelType | null | undefined): SubmitTarget | null {
  if (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement) return "text";
  if (type === ChannelType.GuildForum || type === ChannelType.GuildMedia) return "forum";
  return null;
}

/** Whether posts in a channel of this type ARE threads (so a suggestion there lives in the thread). */
export function isThreadOnlyType(type: ChannelType | null | undefined): boolean {
  return submitTarget(type) === "forum";
}

/**
 * The tag to apply to a new forum post when the forum requires one (a post with
 * no tag is rejected). Moderated tags need Manage Threads to apply, so they are
 * never picked. Prefers a tag named like "Suggestion", else the first usable tag.
 */
export function pickRequiredTag(
  tags: ReadonlyArray<{ id: string; name: string; moderated: boolean }>,
): string | null {
  const usable = tags.filter((tag) => !tag.moderated);
  return (usable.find((tag) => /suggest/i.test(tag.name)) ?? usable[0])?.id ?? null;
}
