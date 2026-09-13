/**
 * Builds the welcome post: an optional text block and the rendered welcome
 * image, in the configured order, inside one Components V2 container.
 */

import {
  AttachmentBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
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
  components: ContainerBuilder[];
  files: AttachmentBuilder[];
  flags: MessageFlags.IsComponentsV2;
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
 * Returns null when there is nothing to post (image-only with no image, or
 * text-only with empty text). In "both" mode a missing image degrades to a
 * text-only post so a render outage doesn't silence welcomes.
 */
export function buildWelcomeMessage(
  message: WelcomeMessageSettings,
  vars: WelcomeMessageVars,
  image: Buffer | null,
): WelcomeMessagePayload | null {
  const wantsText = message.mode !== "image";
  const wantsImage = message.mode !== "text";

  const title = message.title.trim();
  const body = message.body.trim();
  const text = wantsText
    ? applyWelcomePlaceholders(
        [title && `# ${title}`, body].filter(Boolean).join("\n"),
        vars,
      )
    : "";
  const hasImage = wantsImage && image !== null;

  if (!text && !hasImage) return null;

  const textBlock = text ? new TextDisplayBuilder().setContent(text) : null;
  const gallery = hasImage
    ? new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://${WELCOME_IMAGE_NAME}`),
      )
    : null;

  const container = new ContainerBuilder();
  if (message.accentColor) {
    container.setAccentColor(parseInt(message.accentColor.slice(1), 16));
  }

  const addText = () => textBlock && container.addTextDisplayComponents(textBlock);
  const addImage = () => gallery && container.addMediaGalleryComponents(gallery);
  if (message.order === "image-first") {
    addImage();
    addText();
  } else {
    addText();
    addImage();
  }

  return {
    components: [container],
    files: hasImage
      ? [new AttachmentBuilder(image!, { name: WELCOME_IMAGE_NAME })]
      : [],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: ["roles"], users: [vars.userId] },
  };
}
