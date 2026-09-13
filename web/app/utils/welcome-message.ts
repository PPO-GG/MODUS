// Welcome message settings (the text posted with the welcome image).
// Mirrors WelcomeMessageSchema in bot/lib/schemas.ts.

export interface WelcomeMessage {
  mode: "image" | "text" | "both";
  order: "text-first" | "image-first";
  title: string;
  body: string;
  accentColor: string | null;
}

export const DEFAULT_WELCOME_MESSAGE: Readonly<WelcomeMessage> = Object.freeze({
  mode: "both",
  order: "text-first",
  title: "",
  body: "Welcome to **{server_name}**, {user}! 🎉",
  accentColor: null,
});

export const WELCOME_MESSAGE_MODES: { label: string; value: WelcomeMessage["mode"] }[] = [
  { label: "Image", value: "image" },
  { label: "Text", value: "text" },
  { label: "Both", value: "both" },
];

export const WELCOME_MESSAGE_ORDERS: {
  label: string;
  icon: string;
  value: WelcomeMessage["order"];
}[] = [
  { label: "Text first", icon: "i-heroicons-bars-3-bottom-left", value: "text-first" },
  { label: "Image first", icon: "i-heroicons-photo", value: "image-first" },
];

export const WELCOME_PLACEHOLDERS = [
  "{user}",
  "{username}",
  "{displayname}",
  "{server_name}",
  "{member_count}",
];

export interface WelcomePreviewVars {
  userId: string;
  username: string;
  displayName: string;
  serverName: string;
  memberCount: number;
}

/** Merge saved (possibly missing or partial) settings over the defaults. */
export function normalizeWelcomeMessage(
  saved: Partial<WelcomeMessage> | null | undefined,
): WelcomeMessage {
  return { ...DEFAULT_WELCOME_MESSAGE, ...saved };
}

export interface WelcomeMessageParts {
  /** Embed title, placeholders filled. */
  title: string;
  /** Embed description markdown, placeholders filled. */
  body: string;
  /** The bot also mentions the member above the embed (embed mentions don't notify). */
  pingsMember: boolean;
}

/**
 * The embed text the bot will post, with placeholders filled. `{user}`
 * becomes a mention so the preview renders it as a pill. Empty when the mode
 * is image-only or there is no text.
 */
export function welcomeMessageParts(
  message: WelcomeMessage,
  vars: WelcomePreviewVars,
): WelcomeMessageParts {
  if (message.mode === "image") return { title: "", body: "", pingsMember: false };
  const title = message.title.trim();
  const body = message.body.trim();
  const fill = (text: string) =>
    text
      .replace(/\{user\}/g, `<@${vars.userId}>`)
      .replace(/\{username\}/g, vars.username)
      .replace(/\{displayname\}/g, vars.displayName)
      .replace(/\{server_name\}/g, vars.serverName)
      .replace(/\{member_count\}/g, String(vars.memberCount));
  return {
    title: fill(title),
    body: fill(body),
    pingsMember: /\{user\}/.test(title + body),
  };
}
