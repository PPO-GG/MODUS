// Shared trigger/action metadata for the AutoMod page and rule editor.
// Icons live here (not in labels) so dropdowns and chips render the same
// glyph without emoji.

export type ActionTone = "danger" | "warn" | "info";

export interface TriggerOption {
  label: string;
  value: string;
  icon: string;
}

export interface TriggerGroup {
  label: string;
  items: TriggerOption[];
}

export interface ActionOption {
  label: string;
  value: string;
  icon: string;
  /** Short label used in rule chips. */
  short: string;
  tone: ActionTone;
}

export const triggerGroups: TriggerGroup[] = [
  {
    label: "Message events",
    items: [
      { label: "Message created", value: "message_create", icon: "i-lucide-message-square" },
      { label: "Message edited", value: "message_edit", icon: "i-lucide-pencil-line" },
      { label: "Message deleted", value: "message_delete", icon: "i-lucide-trash-2" },
    ],
  },
  {
    label: "Member events",
    items: [
      { label: "Member joined", value: "member_join", icon: "i-lucide-user-plus" },
      { label: "Member updated", value: "member_update", icon: "i-lucide-user-pen" },
    ],
  },
  {
    label: "Reaction events",
    items: [{ label: "Reaction added", value: "reaction_add", icon: "i-lucide-smile" }],
  },
];

const triggerOptions = triggerGroups.flatMap((g) => g.items);

export const triggerIcon = (trigger: string): string =>
  triggerOptions.find((t) => t.value === trigger)?.icon ?? "i-lucide-zap";

export const triggerLabel = (trigger: string): string =>
  triggerOptions.find((t) => t.value === trigger)?.label ?? trigger;

export const actionOptions: ActionOption[] = [
  { label: "Delete message", short: "Delete", value: "delete_message", icon: "i-lucide-trash-2", tone: "danger" },
  { label: "Warn user", short: "Warn", value: "warn_user", icon: "i-lucide-triangle-alert", tone: "warn" },
  { label: "Timeout user", short: "Timeout", value: "timeout_user", icon: "i-lucide-clock", tone: "warn" },
  { label: "Kick user", short: "Kick", value: "kick_user", icon: "i-lucide-log-out", tone: "danger" },
  { label: "Ban user", short: "Ban", value: "ban_user", icon: "i-lucide-ban", tone: "danger" },
  { label: "DM user", short: "DM", value: "dm_user", icon: "i-lucide-mail", tone: "info" },
  { label: "Send channel message", short: "Post message", value: "send_channel_message", icon: "i-lucide-messages-square", tone: "info" },
  { label: "Reply to message", short: "Reply", value: "reply_to_message", icon: "i-lucide-reply", tone: "info" },
  { label: "Add reaction", short: "Add reaction", value: "add_reaction", icon: "i-lucide-smile", tone: "info" },
  { label: "Add role", short: "Add role", value: "add_role", icon: "i-lucide-circle-plus", tone: "info" },
  { label: "Remove role", short: "Remove role", value: "remove_role", icon: "i-lucide-circle-minus", tone: "info" },
  { label: "Log to mod log", short: "Log", value: "log_to_modlog", icon: "i-lucide-clipboard-list", tone: "info" },
];

const actionMeta = (type: string): ActionOption | undefined =>
  actionOptions.find((a) => a.value === type);

export const actionIcon = (type: string): string => actionMeta(type)?.icon ?? "i-lucide-zap";

export const actionLabel = (type: string): string => actionMeta(type)?.short ?? type;

export const actionTone = (type: string): ActionTone => actionMeta(type)?.tone ?? "info";

/** Chip classes for a rule's THEN actions. */
export const actionChipClass = (type: string): string =>
  ({
    danger: "bg-red-400/10 ring-red-400/25 text-red-300",
    warn: "bg-amber-400/10 ring-amber-400/25 text-amber-300",
    info: "bg-sky-200/[0.06] ring-sky-100/15 text-sky-200",
  })[actionTone(type)];

/** Left accent bar for an action card in the editor. */
export const actionAccentBar = (type: string): string =>
  ({
    danger: "bg-red-400",
    warn: "bg-amber-400",
    info: "bg-sky-300/70",
  })[actionTone(type)];
