import {
  AUTOMOD_ACTIONS,
  AUTOMOD_FIELDS,
  AUTOMOD_TRIGGERS,
  LIMITS,
  LIVE_MESSAGE_TRIGGERS,
  MESSAGE_TRIGGERS,
  OPERATORS_BY_TYPE,
  type ActionParamKind,
  type AutomodTrigger,
  type FieldType,
} from "./catalog";
import { checkRegexSafety, normalizeRegex } from "./regex-safety";

export interface GuildContext {
  roles: ReadonlyArray<{ id: string; name: string }>;
  channels: ReadonlyArray<{ id: string; name: string }>;
}

export interface DraftCondition {
  type: "condition";
  field: string;
  operator: string;
  value: string | number | boolean;
  flags?: string[];
  negate?: boolean;
}

export interface DraftConditionGroup {
  operator: "AND" | "OR";
  conditions: (DraftCondition | DraftConditionGroup)[];
  negate?: boolean;
}

export interface DraftAction {
  type: string;
  params?: Record<string, string | number>;
  delaySeconds?: number;
}

export interface DraftRule {
  name: string;
  trigger: AutomodTrigger;
  conditions: DraftConditionGroup;
  actions: DraftAction[];
  exempt_roles: string[];
  exempt_channels: string[];
  cooldown: number;
  priority: number;
}

export type ValidationResult =
  | { ok: true; rule: DraftRule; warnings: string[]; notes: string[] }
  | { ok: false; errors: string[] };

type Err = (path: string, message: string) => void;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Own-key check so keys like "constructor" / "__proto__" never resolve. */
const has = (table: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, key);

const isTrigger = (v: unknown): v is AutomodTrigger =>
  typeof v === "string" && (AUTOMOD_TRIGGERS as readonly string[]).includes(v);

const DURATION_RE = /^(\d+)\s*(m|min|mins|minutes?|h|hrs?|hours?|d|days?)$/i;

/**
 * Normalize a timeout duration to the "<n><m|h|d>" form the dashboard editor
 * re-hydrates. Accepts every spelling the bot's parser accepts. Returns null
 * when unparseable, zero, or longer than Discord's 28-day timeout maximum.
 */
export function parseTimeoutDuration(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = DURATION_RE.exec(raw.trim());
  if (!m) return null;
  const amount = Number(m[1] ?? "");
  const unit = (m[2] ?? "").toLowerCase().charAt(0);
  const perUnit = unit === "m" ? 1 : unit === "h" ? 60 : 1440;
  if (!Number.isInteger(amount) || amount < 1) return null;
  if (amount * perUnit > LIMITS.timeoutMaxMinutes) return null;
  return `${amount}${unit}`;
}

function validateList(raw: unknown, path: string, err: Err): string | null {
  let items: unknown[];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === "string") items = raw.split(",");
  else {
    err(path, "must be a list of words (array of strings or a comma-separated string)");
    return null;
  }
  const fromArray = Array.isArray(raw);
  const cleaned: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      err(path, "list items must be strings");
      return null;
    }
    const trimmed = item.trim();
    if (trimmed === "") {
      if (fromArray) {
        err(path, "list items must not be empty (an empty item matches everything)");
        return null;
      }
      continue;
    }
    if (fromArray && trimmed.includes(",")) {
      err(path, "list items must not contain commas");
      return null;
    }
    if (trimmed.length > LIMITS.listItemMax) {
      err(path, `list items must be ${LIMITS.listItemMax} characters or fewer`);
      return null;
    }
    cleaned.push(trimmed);
  }
  if (cleaned.length === 0 || cleaned.length > LIMITS.listItemsMax) {
    err(path, `list must contain 1 to ${LIMITS.listItemsMax} items`);
    return null;
  }
  return cleaned.join(",");
}

function validateValue(
  raw: unknown,
  type: FieldType,
  operator: string,
  path: string,
  ctx: GuildContext,
  err: Err,
): string | number | boolean | null {
  if (operator === "has_role" || operator === "not_has_role") {
    if (typeof raw !== "string" || !ctx.roles.some((r) => r.id === raw)) {
      err(path, "must be the ID of a role from the provided list");
      return null;
    }
    return raw;
  }
  switch (type) {
    case "number": {
      const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
      if (typeof n !== "number" || !Number.isFinite(n)) {
        err(path, "must be a finite number");
        return null;
      }
      return n;
    }
    case "boolean": {
      const b = raw === "true" ? true : raw === "false" ? false : raw;
      if (typeof b !== "boolean") {
        err(path, "must be true or false");
        return null;
      }
      return b;
    }
    case "string": {
      if (operator === "in_list" || operator === "not_in_list") {
        return validateList(raw, path, err);
      }
      if (typeof raw !== "string" || raw.trim() === "") {
        err(path, "must be a non-empty string");
        return null;
      }
      if (raw.length > LIMITS.valueMax) {
        err(path, `must be ${LIMITS.valueMax} characters or fewer`);
        return null;
      }
      if (operator === "matches_regex") {
        const normalized = normalizeRegex(raw);
        const problem = checkRegexSafety(normalized);
        if (problem) {
          err(path, problem);
          return null;
        }
        return normalized;
      }
      return raw;
    }
    default:
      err(path, "is not supported for this field");
      return null;
  }
}

function validateCondition(
  node: unknown,
  path: string,
  trigger: AutomodTrigger | null,
  ctx: GuildContext,
  err: Err,
): DraftCondition | null {
  if (!isRecord(node)) {
    err(path, "must be an object");
    return null;
  }
  const field = node.field;
  const spec =
    typeof field === "string" && has(AUTOMOD_FIELDS, field) ? AUTOMOD_FIELDS[field] : undefined;
  if (typeof field !== "string" || !spec) {
    err(`${path}.field`, `unknown field ${JSON.stringify(field)}`);
    return null;
  }
  if (trigger && !spec.triggers.includes(trigger)) {
    err(`${path}.field`, `"${field}" is not available for trigger "${trigger}"`);
  }
  const allowed = OPERATORS_BY_TYPE[spec.type];
  const operator = node.operator;
  if (typeof operator !== "string" || !allowed.includes(operator)) {
    err(
      `${path}.operator`,
      `${JSON.stringify(operator)} is not valid for ${spec.type} field "${field}" (use one of: ${allowed.join(", ")})`,
    );
    return null;
  }
  const value = validateValue(node.value, spec.type, operator, `${path}.value`, ctx, err);

  let flags: string[] | undefined;
  if (node.flags !== undefined) {
    if (!Array.isArray(node.flags) || node.flags.some((f) => f !== "case_insensitive")) {
      err(`${path}.flags`, 'may only contain "case_insensitive"');
    } else if (node.flags.length > 0) {
      flags = ["case_insensitive"];
    }
  }
  if (node.negate !== undefined && typeof node.negate !== "boolean") {
    err(`${path}.negate`, "must be a boolean");
  }
  if (value === null) return null;
  return {
    type: "condition",
    field,
    operator,
    value,
    ...(flags ? { flags } : {}),
    ...(node.negate === true ? { negate: true } : {}),
  };
}

function validateGroup(
  node: unknown,
  path: string,
  depth: number,
  trigger: AutomodTrigger | null,
  ctx: GuildContext,
  err: Err,
): DraftConditionGroup | null {
  if (!isRecord(node)) {
    err(path, "must be an object");
    return null;
  }
  if (node.operator !== "AND" && node.operator !== "OR") {
    err(`${path}.operator`, 'must be "AND" or "OR"');
  }
  if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
    err(`${path}.conditions`, "must be a non-empty array");
    return null;
  }
  if (node.conditions.length > LIMITS.maxConditionsPerGroup) {
    err(`${path}.conditions`, `at most ${LIMITS.maxConditionsPerGroup} conditions per group`);
  }
  const children: (DraftCondition | DraftConditionGroup)[] = [];
  node.conditions.forEach((child: unknown, i: number) => {
    const childPath = `${path}.conditions[${i}]`;
    if (isRecord(child) && Array.isArray(child.conditions)) {
      if (depth >= LIMITS.maxDepth) {
        err(childPath, `groups may be nested at most ${LIMITS.maxDepth} levels deep`);
        return;
      }
      const g = validateGroup(child, childPath, depth + 1, trigger, ctx, err);
      if (g) children.push(g);
    } else {
      const c = validateCondition(child, childPath, trigger, ctx, err);
      if (c) children.push(c);
    }
  });
  if (node.negate !== undefined && typeof node.negate !== "boolean") {
    err(`${path}.negate`, "must be a boolean");
  }
  return {
    operator: node.operator === "OR" ? "OR" : "AND",
    conditions: children,
    ...(node.negate === true ? { negate: true } : {}),
  };
}

function validateParam(
  kind: ActionParamKind,
  raw: unknown,
  path: string,
  ctx: GuildContext,
  err: Err,
): string | number | undefined {
  switch (kind) {
    case "text": {
      if (typeof raw !== "string" || raw.trim() === "" || raw.length > LIMITS.textMax) {
        err(path, `must be a non-empty string of at most ${LIMITS.textMax} characters`);
        return undefined;
      }
      return raw.trim();
    }
    case "url": {
      let ok = false;
      if (typeof raw === "string" && raw.length <= LIMITS.urlMax) {
        try {
          const u = new URL(raw);
          ok = u.protocol === "http:" || u.protocol === "https:";
        } catch {
          ok = false;
        }
      }
      if (!ok || typeof raw !== "string") {
        err(path, "must be an http(s) URL");
        return undefined;
      }
      return raw;
    }
    case "days": {
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > LIMITS.daysMax) {
        err(path, `must be an integer from 0 to ${LIMITS.daysMax}`);
        return undefined;
      }
      return raw;
    }
    case "duration": {
      const normalized = parseTimeoutDuration(raw);
      if (!normalized) {
        err(path, 'must look like "10m", "2h" or "1d" and be at most 28 days');
        return undefined;
      }
      return normalized;
    }
    case "role": {
      if (typeof raw !== "string" || !ctx.roles.some((r) => r.id === raw)) {
        err(path, "must be the ID of a role from the provided list");
        return undefined;
      }
      return raw;
    }
    case "channel": {
      if (typeof raw !== "string" || !ctx.channels.some((c) => c.id === raw)) {
        err(path, "must be the ID of a channel from the provided list");
        return undefined;
      }
      return raw;
    }
    case "emoji": {
      if (typeof raw !== "string" || raw.trim() === "" || raw.length > LIMITS.emojiMax) {
        err(path, `must be a non-empty string of at most ${LIMITS.emojiMax} characters`);
        return undefined;
      }
      return raw.trim();
    }
    default:
      return undefined;
  }
}

function validateActions(
  raw: unknown,
  trigger: AutomodTrigger | null,
  ctx: GuildContext,
  err: Err,
): DraftAction[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    err("actions", "must be a non-empty array");
    return [];
  }
  if (raw.length > LIMITS.maxActions) {
    err("actions", `at most ${LIMITS.maxActions} actions`);
  }
  const out: DraftAction[] = [];
  raw.slice(0, LIMITS.maxActions).forEach((node: unknown, i: number) => {
    const path = `actions[${i}]`;
    if (!isRecord(node)) {
      err(path, "must be an object");
      return;
    }
    const type = node.type;
    const spec =
      typeof type === "string" && has(AUTOMOD_ACTIONS, type) ? AUTOMOD_ACTIONS[type] : undefined;
    if (typeof type !== "string" || !spec) {
      err(`${path}.type`, `unknown action ${JSON.stringify(type)}`);
      return;
    }
    const messageTrigger = trigger !== null && MESSAGE_TRIGGERS.includes(trigger);
    const liveMessage = trigger !== null && LIVE_MESSAGE_TRIGGERS.includes(trigger);
    if (spec.needsMessage && trigger && !liveMessage) {
      err(
        `${path}.type`,
        `"${type}" needs a message that still exists, but trigger "${trigger}" has none`,
      );
    }
    const rawParams = node.params === undefined ? {} : node.params;
    if (!isRecord(rawParams)) {
      err(`${path}.params`, "must be an object");
      return;
    }
    for (const key of Object.keys(rawParams)) {
      if (!has(spec.params, key)) {
        err(`${path}.params.${key}`, `is not a parameter of "${type}"`);
      }
    }
    const params: Record<string, string | number> = {};
    for (const [key, paramSpec] of Object.entries(spec.params)) {
      const value = rawParams[key];
      if (value === undefined || value === null || value === "") {
        if (paramSpec.required) err(`${path}.params.${key}`, "is required");
        continue;
      }
      const checked = validateParam(paramSpec.kind, value, `${path}.params.${key}`, ctx, err);
      if (checked !== undefined) params[key] = checked;
    }
    if (
      type === "send_channel_message" &&
      params.channel_id === undefined &&
      trigger &&
      !messageTrigger
    ) {
      err(`${path}.params.channel_id`, `is required because trigger "${trigger}" has no channel`);
    }
    let delaySeconds: number | undefined;
    if (node.delaySeconds !== undefined) {
      const d = node.delaySeconds;
      if (typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > LIMITS.delayMax) {
        err(`${path}.delaySeconds`, `must be an integer from 0 to ${LIMITS.delayMax}`);
      } else if (d > 0) {
        delaySeconds = d;
      }
    }
    out.push({
      type,
      ...(Object.keys(params).length > 0 ? { params } : {}),
      ...(delaySeconds ? { delaySeconds } : {}),
    });
  });
  return out;
}

function validateIdList(
  raw: unknown,
  path: string,
  known: ReadonlyArray<{ id: string }>,
  kind: string,
  err: Err,
): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    err(path, "must be an array of IDs");
    return [];
  }
  if (raw.length > LIMITS.exemptMax) err(path, `at most ${LIMITS.exemptMax} entries`);
  const out: string[] = [];
  raw.forEach((id: unknown, i: number) => {
    if (typeof id !== "string" || !known.some((k) => k.id === id)) {
      err(`${path}[${i}]`, `${JSON.stringify(id)} is not a ${kind} ID from the provided list`);
    } else if (!out.includes(id)) {
      out.push(id);
    }
  });
  return out;
}

function validateIntInRange(raw: unknown, path: string, max: number, err: Err): number {
  if (raw === undefined) return 0;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > max) {
    err(path, `must be an integer from 0 to ${max}`);
    return 0;
  }
  return raw;
}

/**
 * Validate a model-produced rule draft against the automod catalog and the
 * guild's real roles/channels. Never throws; returns every problem found (up
 * to LIMITS.errorsMax) so they can be fed back to the model in a repair call.
 */
export function validateRuleDraft(input: unknown, ctx: GuildContext): ValidationResult {
  if (!isRecord(input)) return { ok: false, errors: ["Reply must be a JSON object."] };

  const errors: string[] = [];
  const err: Err = (path, message) => {
    errors.push(`${path}: ${message}`);
  };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) err("name", "is required");
  else if (name.length > LIMITS.nameMax) err("name", `must be ${LIMITS.nameMax} characters or fewer`);

  const trigger: AutomodTrigger | null = isTrigger(input.trigger) ? input.trigger : null;
  if (!trigger) err("trigger", `must be one of ${AUTOMOD_TRIGGERS.join(", ")}`);

  const conditions = validateGroup(input.conditions, "conditions", 1, trigger, ctx, err);
  const actions = validateActions(input.actions, trigger, ctx, err);
  const exemptRoles = validateIdList(input.exempt_roles, "exempt_roles", ctx.roles, "role", err);
  const exemptChannels = validateIdList(input.exempt_channels, "exempt_channels", ctx.channels, "channel", err);
  const cooldown = validateIntInRange(input.cooldown, "cooldown", LIMITS.cooldownMax, err);
  const priority = validateIntInRange(input.priority, "priority", LIMITS.priorityMax, err);

  if (errors.length > 0 || !trigger || !conditions) {
    return { ok: false, errors: errors.slice(0, LIMITS.errorsMax) };
  }

  const warnings: string[] = [];
  if (actions.some((a) => a.type === "kick_user")) {
    warnings.push("This rule will automatically kick members. Review it carefully.");
  }
  if (actions.some((a) => a.type === "ban_user")) {
    warnings.push("This rule will automatically ban members. Review it carefully.");
  }

  const notes = Array.isArray(input.notes)
    ? input.notes
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.trim().slice(0, LIMITS.noteMax))
        .filter((n) => n.length > 0)
        .slice(0, LIMITS.notesMax)
    : [];

  return {
    ok: true,
    rule: {
      name,
      trigger,
      conditions,
      actions,
      exempt_roles: exemptRoles,
      exempt_channels: exemptChannels,
      cooldown,
      priority,
    },
    warnings,
    notes,
  };
}
