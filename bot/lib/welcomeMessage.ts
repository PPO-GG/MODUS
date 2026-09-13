/**
 * Builds the welcome post as a classic message: an embed holding the title,
 * text and accent colour, plus the rendered welcome image.
 *
 * Classic embeds rather than a Components V2 media gallery, because the
 * Discord desktop client crops gallery images wider than the message column
 * (it keeps the image's full pixel height while narrowing the width).
 */

import {
  AttachmentBuilder,
  EmbedBuilder,
  escapeMarkdown,
  type MessageMentionOptions,
} from "discord.js";
import type { WelcomeMessageSettings } from "./schemas";

export const WELCOME_IMAGE_NAME = "welcome.png";

export interface WelcomeMessageVars {
  userId: string;
  username: string;
  displayName: string;
  tag: string;
  serverName: string;
  memberCount: number;
}

export interface WelcomeMessagePayload {
  content?: string;
  embeds: EmbedBuilder[];
  files: AttachmentBuilder[];
  allowedMentions: MessageMentionOptions;
}

/**
 * Escape a user-controlled value: markdown is escaped and every `@` gets a
 * zero-width space so nicknames like "@everyone" or "<@&id>" can't ping.
 */
function sanitize(value: string): string {
  return escapeMarkdown(value).replace(/@/g, "@\u200b");
}

export function applyWelcomePlaceholders(
  text: string,
  vars: WelcomeMessageVars,
): string {
  return text
    .replace(/\{user\}/g, `<@${vars.userId}>`)
    .replace(/\{username\}/g, sanitize(vars.username))
    .replace(/\{displayname\}/g, sanitize(vars.displayName))
    .replace(/\{tag\}/g, sanitize(vars.tag))
    .replace(/\{server_name\}/g, sanitize(vars.serverName))
    .replace(/\{member_count\}/g, String(vars.memberCount));
}

/**
 * Layouts:
 * - text-first: one embed with the image inside it, at the bottom.
 * - image-first: the image as a plain attachment, which Discord renders above
 *   the embed.
 * - text / image mode: just the embed / just the attachment.
 *
 * Mentions inside embeds render but never notify, so when the text uses
 * {user} the member is also mentioned in the message content.
 *
 * Returns null when there is nothing to post. In "both" mode a missing image
 * degrades to a text-only post so a render outage doesn't silence welcomes.
 */
export function buildWelcomeMessage(
  message: WelcomeMessageSettings,
  vars: WelcomeMessageVars,
  image: Buffer | null,
): WelcomeMessagePayload | null {
  const wantsText = message.mode !== "image";
  const wantsImage = message.mode !== "text";

  const title = wantsText ? message.title.trim() : "";
  const body = wantsText ? message.body.trim() : "";
  const hasText = Boolean(title || body);
  const hasImage = wantsImage && image !== null;

  if (!hasText && !hasImage) return null;

  const embeds: EmbedBuilder[] = [];
  if (hasText) {
    const embed = new EmbedBuilder();
    if (title) embed.setTitle(applyWelcomePlaceholders(title, vars));
    if (body) embed.setDescription(applyWelcomePlaceholders(body, vars));
    if (message.accentColor) {
      embed.setColor(parseInt(message.accentColor.slice(1), 16));
    }
    if (hasImage && message.order === "text-first") {
      embed.setImage(`attachment://${WELCOME_IMAGE_NAME}`);
    }
    embeds.push(embed);
  }

  const pingsMember = hasText && /\{user\}/.test(title + body);

  return {
    content: pingsMember ? `<@${vars.userId}>` : undefined,
    embeds,
    files: hasImage
      ? [new AttachmentBuilder(image!, { name: WELCOME_IMAGE_NAME })]
      : [],
    allowedMentions: { users: pingsMember ? [vars.userId] : [] },
  };
}
