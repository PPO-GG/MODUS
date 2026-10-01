/**
 * Single source of truth for what an automod rule may contain. It mirrors the
 * evaluator in bot/modules/automod.ts (extractField / evaluateCondition /
 * executeActions); keep the two in sync when either changes.
 */

export const AUTOMOD_TRIGGERS = [
  "message_create",
  "message_edit",
  "message_delete",
  "member_join",
  "member_update",
  "reaction_add",
] as const;

export type AutomodTrigger = (typeof AUTOMOD_TRIGGERS)[number];

/** Triggers whose event context carries a message and its channel. */
export const MESSAGE_TRIGGERS: readonly AutomodTrigger[] = [
  "message_create",
  "message_edit",
  "message_delete",
  "reaction_add",
];

/**
 * Triggers where the triggering message still exists. On message_delete the
 * message is already gone, so deleting, replying to or reacting to it does
 * nothing in the bot.
 */
export const LIVE_MESSAGE_TRIGGERS: readonly AutomodTrigger[] = [
  "message_create",
  "message_edit",
  "reaction_add",
];

export type FieldType = "string" | "number" | "boolean" | "string[]";

export interface FieldSpec {
  type: FieldType;
  /** Triggers for which the evaluator can supply this field. */
  triggers: readonly AutomodTrigger[];
  description: string;
}

const ALL: readonly AutomodTrigger[] = AUTOMOD_TRIGGERS;
const MEMBER_UPDATE: readonly AutomodTrigger[] = ["member_update"];
const REACTION_ADD: readonly AutomodTrigger[] = ["reaction_add"];

export const AUTOMOD_FIELDS: Readonly<Record<string, FieldSpec>> = {
  "message.content": { type: "string", triggers: MESSAGE_TRIGGERS, description: "full message text" },
  "message.content_lower": { type: "string", triggers: MESSAGE_TRIGGERS, description: "lowercased message text" },
  "message.length": { type: "number", triggers: MESSAGE_TRIGGERS, description: "character count" },
  "message.word_count": { type: "number", triggers: MESSAGE_TRIGGERS, description: "word count" },
  "message.mentions_count": { type: "number", triggers: MESSAGE_TRIGGERS, description: "user + role mentions" },
  "message.emoji_count": { type: "number", triggers: MESSAGE_TRIGGERS, description: "emoji count" },
  "message.links_count": { type: "number", triggers: MESSAGE_TRIGGERS, description: "URLs in the message" },
  "message.attachments_count": { type: "number", triggers: MESSAGE_TRIGGERS, description: "attachment count" },
  "message.has_embed": { type: "boolean", triggers: MESSAGE_TRIGGERS, description: "message has an embed" },
  "message.is_all_caps": { type: "boolean", triggers: MESSAGE_TRIGGERS, description: "more than 3 letters and all uppercase" },
  "message.caps_ratio": { type: "number", triggers: MESSAGE_TRIGGERS, description: "share of uppercase letters, 0 to 1" },
  "message.sticker_count": { type: "number", triggers: MESSAGE_TRIGGERS, description: "sticker count" },
  "user.id": { type: "string", triggers: ALL, description: "user ID" },
  "user.username": { type: "string", triggers: ALL, description: "username" },
  "user.nickname": { type: "string", triggers: ALL, description: "server nickname, falls back to username" },
  "user.account_age_days": { type: "number", triggers: ALL, description: "days since the account was created" },
  "user.join_age_days": { type: "number", triggers: ALL, description: "days since the user joined this server" },
  "user.role_ids": { type: "string[]", triggers: ALL, description: "the member's role IDs (use with has_role / not_has_role)" },
  "user.is_bot": { type: "boolean", triggers: ALL, description: "user is a bot" },
  "channel.id": { type: "string", triggers: MESSAGE_TRIGGERS, description: "channel ID" },
  "channel.name": { type: "string", triggers: MESSAGE_TRIGGERS, description: "channel name" },
  "channel.is_nsfw": { type: "boolean", triggers: MESSAGE_TRIGGERS, description: "channel is age-restricted" },
  "member.nickname_changed": { type: "boolean", triggers: MEMBER_UPDATE, description: "nickname changed" },
  "member.old_nickname": { type: "string", triggers: MEMBER_UPDATE, description: "nickname before the change" },
  "member.new_nickname": { type: "string", triggers: MEMBER_UPDATE, description: "nickname after the change" },
  "member.avatar_changed": { type: "boolean", triggers: MEMBER_UPDATE, description: "server avatar changed" },
  "reaction.emoji": { type: "string", triggers: REACTION_ADD, description: "emoji name (or ID for custom emoji)" },
  "reaction.count": { type: "number", triggers: REACTION_ADD, description: "reaction count on the message" },
};

export const OPERATORS_BY_TYPE: Readonly<Record<FieldType, readonly string[]>> = {
  string: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "matches_regex",
    "in_list",
    "not_in_list",
  ],
  number: ["equals", "not_equals", "greater_than", "less_than"],
  boolean: ["equals", "not_equals"],
  "string[]": ["has_role", "not_has_role"],
};

export type ActionParamKind =
  | "text"
  | "url"
  | "days"
  | "duration"
  | "role"
  | "channel"
  | "emoji";

export interface ActionParamSpec {
  kind: ActionParamKind;
  required: boolean;
  description: string;
}

export interface ActionSpec {
  description: string;
  /** True when the bot needs a message that still exists (no-op otherwise). */
  needsMessage: boolean;
  params: Readonly<Record<string, ActionParamSpec>>;
}

export const AUTOMOD_ACTIONS: Readonly<Record<string, ActionSpec>> = {
  delete_message: { description: "delete the triggering message", needsMessage: true, params: {} },
  warn_user: { description: "record a warning against the user", needsMessage: false, params: {} },
  timeout_user: {
    description: "time the user out",
    needsMessage: false,
    params: {
      duration: { kind: "duration", required: true, description: 'e.g. "10m", "2h", "1d" (max 28d)' },
    },
  },
  kick_user: { description: "kick the user", needsMessage: false, params: {} },
  ban_user: {
    description: "ban the user",
    needsMessage: false,
    params: {
      delete_days: { kind: "days", required: false, description: "days of their messages to delete, integer 0-7" },
    },
  },
  dm_user: {
    description: "send the user a direct message",
    needsMessage: false,
    params: {
      message: { kind: "text", required: false, description: "text; {user} and {channel} are substituted" },
      image_url: { kind: "url", required: false, description: "http(s) image URL" },
    },
  },
  send_channel_message: {
    description: "post a message in a channel",
    needsMessage: false,
    params: {
      channel_id: { kind: "channel", required: false, description: "channel ID from the list; defaults to the message's channel" },
      message: { kind: "text", required: true, description: "text; {user} and {channel} are substituted" },
      image_url: { kind: "url", required: false, description: "http(s) image URL" },
    },
  },
  reply_to_message: {
    description: "reply to the triggering message",
    needsMessage: true,
    params: {
      message: { kind: "text", required: true, description: "text; {user} and {channel} are substituted" },
      image_url: { kind: "url", required: false, description: "http(s) image URL" },
    },
  },
  add_reaction: {
    description: "react to the triggering message",
    needsMessage: true,
    params: {
      emoji: { kind: "emoji", required: true, description: "unicode emoji or custom emoji as name:id" },
    },
  },
  add_role: {
    description: "give the user a role",
    needsMessage: false,
    params: { role_id: { kind: "role", required: true, description: "role ID from the list" } },
  },
  remove_role: {
    description: "remove a role from the user",
    needsMessage: false,
    params: { role_id: { kind: "role", required: true, description: "role ID from the list" } },
  },
  log_to_modlog: { description: "post the event to the mod log channel", needsMessage: false, params: {} },
};

export const LIMITS = {
  promptMax: 500,
  nameMax: 100,
  maxDepth: 3,
  maxConditionsPerGroup: 20,
  maxActions: 5,
  valueMax: 500,
  listItemMax: 100,
  listItemsMax: 100,
  regexMax: 200,
  maxUnboundedQuantifiers: 3,
  /** Wall-clock budget and input length for the runtime slowness probe. */
  regexProbeMs: 100,
  regexProbeLength: 2000,
  textMax: 2000,
  urlMax: 500,
  emojiMax: 64,
  cooldownMax: 3600,
  priorityMax: 10,
  delayMax: 300,
  daysMax: 7,
  timeoutMaxMinutes: 28 * 24 * 60,
  exemptMax: 25,
  notesMax: 5,
  noteMax: 300,
  errorsMax: 20,
} as const;
