/**
 * The permissions MODUS asks for in its invite link, as checked by the bot
 * itself when it joins a server. Keep in sync with web/shared/bot-invite.ts
 * (invitePermissions.test.ts fails if they drift).
 */
import { GuildMember, PermissionFlagsBits } from "discord.js";

export const INVITE_BASELINE_NAMES = [
  "ViewChannel",
  "SendMessages",
  "SendMessagesInThreads",
  "EmbedLinks",
  "AttachFiles",
  "ReadMessageHistory",
  "AddReactions",
  "UseExternalEmojis",
] as const;

export const INVITE_PERMISSION_NAMES = [
  ...INVITE_BASELINE_NAMES,
  "ManageMessages",
  "KickMembers",
  "BanMembers",
  "ModerateMembers",
  "ViewAuditLog",
  "ManageRoles",
  "ManageChannels",
  "CreatePrivateThreads",
  "ManageThreads",
  "CreatePublicThreads",
  "PinMessages",
  "SendPolls",
  "ManageEvents",
  "Connect",
  "Speak",
  "MoveMembers",
  "MuteMembers",
  "DeafenMembers",
  "ChangeNickname",
] as const;

export interface MissingInvitePermissions {
  /** Basic messaging permissions: without these most of the bot fails. */
  baseline: string[];
  /** Module-specific permissions: only those modules fail. */
  other: string[];
}

/** "ViewChannel" -> "View Channel". */
export const permissionLabel = (name: string): string =>
  name.replace(/([a-z])([A-Z])/g, "$1 $2");

/** Invite permissions the bot's roles do not grant it in this server. */
export function findMissingInvitePermissions(
  me: GuildMember,
): MissingInvitePermissions {
  const missing = (names: readonly string[]) =>
    names
      .filter(
        (n) =>
          !me.permissions.has(
            PermissionFlagsBits[n as keyof typeof PermissionFlagsBits],
          ),
      )
      .map(permissionLabel);
  const baseline = missing(INVITE_BASELINE_NAMES);
  const rest = INVITE_PERMISSION_NAMES.filter(
    (n) => !(INVITE_BASELINE_NAMES as readonly string[]).includes(n),
  );
  return { baseline, other: missing(rest) };
}
