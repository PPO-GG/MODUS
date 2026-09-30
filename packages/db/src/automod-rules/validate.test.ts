import { describe, expect, it } from "vitest";
import {
  parseTimeoutDuration,
  validateRuleDraft,
  type GuildContext,
  type ValidationResult,
} from "./validate";

const ctx: GuildContext = {
  roles: [
    { id: "111", name: "Moderator" },
    { id: "222", name: "Members" },
  ],
  channels: [
    { id: "333", name: "general" },
    { id: "444", name: "mod-log" },
  ],
};

const cond = (over: Record<string, unknown> = {}) => ({
  type: "condition",
  field: "message.content",
  operator: "contains",
  value: "x",
  ...over,
});
const group = (...conditions: unknown[]) => ({ operator: "AND", conditions });

const draft = (over: Record<string, unknown> = {}) => ({
  name: "Invite spam",
  trigger: "message_create",
  conditions: group(cond({ field: "message.links_count", operator: "greater_than", value: 2 })),
  actions: [{ type: "delete_message" }, { type: "timeout_user", params: { duration: "10m" } }],
  exempt_roles: ["111"],
  exempt_channels: [],
  cooldown: 30,
  priority: 1,
  notes: [],
  ...over,
});

function errorsOf(result: ValidationResult): string {
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors.join("\n");
}

function okOf(result: ValidationResult) {
  if (!result.ok) throw new Error(`expected validation to pass: ${result.errors.join("; ")}`);
  return result;
}

describe("validateRuleDraft: structure", () => {
  it("accepts a valid draft and returns the normalized rule", () => {
    const result = okOf(validateRuleDraft(draft(), ctx));
    expect(result.rule).toEqual({
      name: "Invite spam",
      trigger: "message_create",
      conditions: {
        operator: "AND",
        conditions: [
          { type: "condition", field: "message.links_count", operator: "greater_than", value: 2 },
        ],
      },
      actions: [{ type: "delete_message" }, { type: "timeout_user", params: { duration: "10m" } }],
      exempt_roles: ["111"],
      exempt_channels: [],
      cooldown: 30,
      priority: 1,
    });
    expect(result.warnings).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it("defaults exempt lists, cooldown and priority when omitted", () => {
    const { exempt_roles, exempt_channels, cooldown, priority, ...rest } = draft();
    void exempt_roles; void exempt_channels; void cooldown; void priority;
    const result = okOf(validateRuleDraft(rest, ctx));
    expect(result.rule).toMatchObject({ exempt_roles: [], exempt_channels: [], cooldown: 0, priority: 0 });
  });

  it("rejects non-object input", () => {
    expect(errorsOf(validateRuleDraft("nope", ctx))).toMatch(/JSON object/);
    expect(errorsOf(validateRuleDraft([], ctx))).toMatch(/JSON object/);
    expect(errorsOf(validateRuleDraft(null, ctx))).toMatch(/JSON object/);
  });

  it("rejects a missing or oversized name and an unknown trigger", () => {
    expect(errorsOf(validateRuleDraft(draft({ name: "  " }), ctx))).toMatch(/name: is required/);
    expect(errorsOf(validateRuleDraft(draft({ name: "x".repeat(101) }), ctx))).toMatch(/name: must be 100/);
    expect(errorsOf(validateRuleDraft(draft({ trigger: "voice_join" }), ctx))).toMatch(/trigger: must be one of/);
  });

  it("collects several errors at once and caps them at 20", () => {
    const many = group(...Array.from({ length: 25 }, () => cond({ field: "message.nope" })));
    const result = validateRuleDraft(draft({ conditions: many, name: "" }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(20);
  });
});

describe("validateRuleDraft: conditions", () => {
  it.each(["message.nope", "constructor", "__proto__", "toString"])(
    "rejects unknown field %s (including prototype keys)",
    (field) => {
      const result = validateRuleDraft(draft({ conditions: group(cond({ field })) }), ctx);
      expect(errorsOf(result)).toMatch(/unknown field/);
    },
  );

  it("rejects a field that the trigger cannot supply", () => {
    const result = validateRuleDraft(
      draft({ conditions: group(cond({ field: "reaction.emoji", operator: "equals", value: "x" })) }),
      ctx,
    );
    expect(errorsOf(result)).toMatch(/"reaction\.emoji" is not available for trigger "message_create"/);
  });

  it("rejects operators that do not fit the field type", () => {
    const numberContains = validateRuleDraft(
      draft({ conditions: group(cond({ field: "message.length", operator: "contains", value: "5" })) }),
      ctx,
    );
    expect(errorsOf(numberContains)).toMatch(/not valid for number field "message\.length"/);
    const stringGreater = validateRuleDraft(
      draft({ conditions: group(cond({ operator: "greater_than", value: 5 })) }),
      ctx,
    );
    expect(errorsOf(stringGreater)).toMatch(/not valid for string field "message\.content"/);
    const hasRoleOnString = validateRuleDraft(
      draft({ conditions: group(cond({ operator: "has_role", value: "111" })) }),
      ctx,
    );
    expect(errorsOf(hasRoleOnString)).toMatch(/not valid for string field/);
  });

  it("coerces numeric and boolean strings but rejects other types", () => {
    const result = okOf(
      validateRuleDraft(
        draft({
          conditions: group(
            cond({ field: "message.length", operator: "greater_than", value: "200" }),
            cond({ field: "message.is_all_caps", operator: "equals", value: "true" }),
          ),
        }),
        ctx,
      ),
    );
    expect(result.rule.conditions.conditions).toEqual([
      { type: "condition", field: "message.length", operator: "greater_than", value: 200 },
      { type: "condition", field: "message.is_all_caps", operator: "equals", value: true },
    ]);
    const bad = validateRuleDraft(
      draft({ conditions: group(cond({ field: "message.length", operator: "greater_than", value: "lots" })) }),
      ctx,
    );
    expect(errorsOf(bad)).toMatch(/must be a finite number/);
  });

  it("requires non-empty string values", () => {
    const result = validateRuleDraft(draft({ conditions: group(cond({ value: "   " })) }), ctx);
    expect(errorsOf(result)).toMatch(/must be a non-empty string/);
  });

  it("normalizes in_list values to a comma-separated string", () => {
    const fromArray = okOf(
      validateRuleDraft(
        draft({ conditions: group(cond({ operator: "in_list", value: ["foo", " bar "] })) }),
        ctx,
      ),
    );
    expect(fromArray.rule.conditions.conditions[0]).toMatchObject({ value: "foo,bar" });
    const fromString = okOf(
      validateRuleDraft(
        draft({ conditions: group(cond({ operator: "not_in_list", value: "foo, bar,," })) }),
        ctx,
      ),
    );
    expect(fromString.rule.conditions.conditions[0]).toMatchObject({ value: "foo,bar" });
  });

  it("rejects empty or comma-containing items in an in_list array", () => {
    expect(
      errorsOf(validateRuleDraft(draft({ conditions: group(cond({ operator: "in_list", value: ["a", ""] })) }), ctx)),
    ).toMatch(/must not be empty/);
    expect(
      errorsOf(validateRuleDraft(draft({ conditions: group(cond({ operator: "in_list", value: ["a,b"] })) }), ctx)),
    ).toMatch(/must not contain commas/);
  });

  it("rejects unsafe regexes", () => {
    const result = validateRuleDraft(
      draft({ conditions: group(cond({ operator: "matches_regex", value: "(a+)+$" })) }),
      ctx,
    );
    expect(errorsOf(result)).toMatch(/backtrack/);
  });

  it("rejects overlapping wildcard regexes that are too slow on long messages", () => {
    const result = validateRuleDraft(
      draft({ conditions: group(cond({ operator: "matches_regex", value: "a.*.*.*x" })) }),
      ctx,
    );
    expect(errorsOf(result)).toMatch(/too slow/);
  });

  it("accepts a run of leading wildcards as the equivalent plain pattern", () => {
    const result = okOf(
      validateRuleDraft(
        draft({ conditions: group(cond({ operator: "matches_regex", value: ".*.*.*x" })) }),
        ctx,
      ),
    );
    expect(result.rule.conditions.conditions[0]).toMatchObject({ value: "x" });
  });

  it("strips redundant leading and trailing .* from regexes before checking and saving", () => {
    const result = okOf(
      validateRuleDraft(
        draft({ conditions: group(cond({ operator: "matches_regex", value: ".*free.*nitro.*" })) }),
        ctx,
      ),
    );
    expect(result.rule.conditions.conditions[0]).toMatchObject({ value: "free.*nitro" });
  });

  it("requires has_role values to be roles from the guild", () => {
    const ok = okOf(
      validateRuleDraft(
        draft({ conditions: group(cond({ field: "user.role_ids", operator: "not_has_role", value: "111" })) }),
        ctx,
      ),
    );
    expect(ok.rule.conditions.conditions[0]).toMatchObject({ value: "111" });
    const bad = validateRuleDraft(
      draft({ conditions: group(cond({ field: "user.role_ids", operator: "has_role", value: "999" })) }),
      ctx,
    );
    expect(errorsOf(bad)).toMatch(/ID of a role from the provided list/);
  });

  it("allows three levels of groups and rejects a fourth", () => {
    okOf(validateRuleDraft(draft({ conditions: group(group(group(cond()))) }), ctx));
    expect(errorsOf(validateRuleDraft(draft({ conditions: group(group(group(group(cond())))) }), ctx))).toMatch(
      /nested at most 3 levels/,
    );
  });

  it("rejects empty groups, non-group roots and bad group operators", () => {
    expect(errorsOf(validateRuleDraft(draft({ conditions: group() }), ctx))).toMatch(/non-empty array/);
    expect(errorsOf(validateRuleDraft(draft({ conditions: cond() }), ctx))).toMatch(/must be "AND" or "OR"/);
    expect(
      errorsOf(validateRuleDraft(draft({ conditions: { operator: "XOR", conditions: [cond()] } }), ctx)),
    ).toMatch(/must be "AND" or "OR"/);
  });

  it("only allows the case_insensitive flag and keeps negate", () => {
    const ok = okOf(
      validateRuleDraft(
        draft({ conditions: group(cond({ flags: ["case_insensitive"], negate: true })) }),
        ctx,
      ),
    );
    expect(ok.rule.conditions.conditions[0]).toMatchObject({ flags: ["case_insensitive"], negate: true });
    expect(
      errorsOf(validateRuleDraft(draft({ conditions: group(cond({ flags: ["global"] })) }), ctx)),
    ).toMatch(/only contain "case_insensitive"/);
  });
});

describe("validateRuleDraft: actions", () => {
  it("requires between 1 and 5 actions of known types", () => {
    expect(errorsOf(validateRuleDraft(draft({ actions: [] }), ctx))).toMatch(/actions: must be a non-empty array/);
    const six = Array.from({ length: 6 }, () => ({ type: "delete_message" }));
    expect(errorsOf(validateRuleDraft(draft({ actions: six }), ctx))).toMatch(/at most 5 actions/);
    expect(errorsOf(validateRuleDraft(draft({ actions: [{ type: "nuke_server" }] }), ctx))).toMatch(
      /unknown action "nuke_server"/,
    );
  });

  it("rejects parameters an action does not take (the bot ignores reason)", () => {
    const result = validateRuleDraft(draft({ actions: [{ type: "kick_user", params: { reason: "spam" } }] }), ctx);
    expect(errorsOf(result)).toMatch(/actions\[0\]\.params\.reason: is not a parameter of "kick_user"/);
  });

  it("requires a timeout duration and normalizes accepted spellings", () => {
    expect(errorsOf(validateRuleDraft(draft({ actions: [{ type: "timeout_user" }] }), ctx))).toMatch(
      /actions\[0\]\.params\.duration: is required/,
    );
    const ok = okOf(
      validateRuleDraft(draft({ actions: [{ type: "timeout_user", params: { duration: "2 hours" } }] }), ctx),
    );
    expect(ok.rule.actions[0]).toEqual({ type: "timeout_user", params: { duration: "2h" } });
    for (const bad of ["29d", "0m", "soon", 600]) {
      const result = validateRuleDraft(draft({ actions: [{ type: "timeout_user", params: { duration: bad } }] }), ctx);
      expect(errorsOf(result)).toMatch(/duration/);
    }
  });

  it("validates ban delete_days, dm image_url and delaySeconds", () => {
    expect(
      errorsOf(validateRuleDraft(draft({ actions: [{ type: "ban_user", params: { delete_days: 8 } }] }), ctx)),
    ).toMatch(/delete_days/);
    expect(
      errorsOf(
        validateRuleDraft(
          draft({ actions: [{ type: "dm_user", params: { image_url: "javascript:alert(1)" } }] }),
          ctx,
        ),
      ),
    ).toMatch(/image_url/);
    expect(
      errorsOf(validateRuleDraft(draft({ actions: [{ type: "delete_message", delaySeconds: 301 }] }), ctx)),
    ).toMatch(/delaySeconds/);
    const ok = okOf(
      validateRuleDraft(draft({ actions: [{ type: "warn_user", delaySeconds: 5 }, { type: "delete_message", delaySeconds: 0 }] }), ctx),
    );
    expect(ok.rule.actions).toEqual([{ type: "warn_user", delaySeconds: 5 }, { type: "delete_message" }]);
  });

  it("requires role and channel params to exist in the guild", () => {
    expect(
      errorsOf(validateRuleDraft(draft({ actions: [{ type: "add_role", params: { role_id: "999" } }] }), ctx)),
    ).toMatch(/role_id/);
    expect(
      errorsOf(
        validateRuleDraft(
          draft({ actions: [{ type: "send_channel_message", params: { channel_id: "999", message: "hi" } }] }),
          ctx,
        ),
      ),
    ).toMatch(/channel_id/);
    expect(
      errorsOf(validateRuleDraft(draft({ actions: [{ type: "send_channel_message", params: { channel_id: "444" } }] }), ctx)),
    ).toMatch(/params\.message: is required/);
    okOf(
      validateRuleDraft(
        draft({
          actions: [
            { type: "add_role", params: { role_id: "222" } },
            { type: "send_channel_message", params: { channel_id: "444", message: "{user} was flagged" } },
          ],
        }),
        ctx,
      ),
    );
  });

  it("rejects message-only actions on triggers with no message", () => {
    const memberJoin = (actions: unknown[]) =>
      draft({ trigger: "member_join", conditions: group(cond({ field: "user.username" })), actions });
    for (const type of ["delete_message", "reply_to_message", "add_reaction"]) {
      const params = type === "reply_to_message" ? { message: "hi" } : type === "add_reaction" ? { emoji: "⚠️" } : undefined;
      const result = validateRuleDraft(memberJoin([{ type, ...(params ? { params } : {}) }]), ctx);
      expect(errorsOf(result)).toMatch(/needs a message that still exists, but trigger "member_join" has none/);
    }
  });

  it("rejects message-only actions on message_delete, where the message is already gone", () => {
    const onDelete = (actions: unknown[]) => draft({ trigger: "message_delete", actions });
    for (const type of ["delete_message", "reply_to_message", "add_reaction"]) {
      const params = type === "reply_to_message" ? { message: "hi" } : type === "add_reaction" ? { emoji: "⚠️" } : undefined;
      const result = validateRuleDraft(onDelete([{ type, ...(params ? { params } : {}) }]), ctx);
      expect(errorsOf(result)).toMatch(/needs a message that still exists, but trigger "message_delete" has none/);
    }
  });

  it("still allows logging and channel posts on message_delete (the channel is known)", () => {
    okOf(
      validateRuleDraft(
        draft({
          trigger: "message_delete",
          actions: [{ type: "log_to_modlog" }, { type: "send_channel_message", params: { message: "a message was deleted" } }],
        }),
        ctx,
      ),
    );
  });

  it("requires channel_id for send_channel_message on triggers with no channel", () => {
    const memberJoin = (params: Record<string, string>) =>
      draft({
        trigger: "member_join",
        conditions: group(cond({ field: "user.username" })),
        actions: [{ type: "send_channel_message", params }],
      });
    expect(errorsOf(validateRuleDraft(memberJoin({ message: "hi" }), ctx))).toMatch(
      /channel_id: is required because trigger "member_join"/,
    );
    okOf(validateRuleDraft(memberJoin({ message: "hi", channel_id: "333" }), ctx));
  });

  it("warns about kick and ban actions", () => {
    const result = okOf(validateRuleDraft(draft({ actions: [{ type: "kick_user" }, { type: "ban_user" }] }), ctx));
    expect(result.warnings.join(" ")).toMatch(/kick/);
    expect(result.warnings.join(" ")).toMatch(/ban/);
  });
});

describe("validateRuleDraft: limits, exemptions and notes", () => {
  it("requires exempt IDs to exist in the guild and de-duplicates them", () => {
    expect(errorsOf(validateRuleDraft(draft({ exempt_roles: ["999"] }), ctx))).toMatch(/exempt_roles\[0\]/);
    expect(errorsOf(validateRuleDraft(draft({ exempt_channels: ["111"] }), ctx))).toMatch(/exempt_channels\[0\]/);
    const ok = okOf(validateRuleDraft(draft({ exempt_roles: ["111", "111"], exempt_channels: ["444"] }), ctx));
    expect(ok.rule.exempt_roles).toEqual(["111"]);
    expect(ok.rule.exempt_channels).toEqual(["444"]);
  });

  it.each([
    ["cooldown", 3601],
    ["cooldown", -1],
    ["cooldown", 1.5],
    ["priority", 11],
    ["priority", "high"],
  ])("rejects %s = %s", (key, value) => {
    expect(errorsOf(validateRuleDraft(draft({ [key]: value }), ctx))).toMatch(new RegExp(`${key}: must be an integer`));
  });

  it("keeps only trimmed string notes, truncated and capped at 5", () => {
    const result = okOf(
      validateRuleDraft(
        draft({ notes: ["  role not found  ", 5, "x".repeat(400), "a", "b", "c", "d"] }),
        ctx,
      ),
    );
    expect(result.notes).toHaveLength(5);
    expect(result.notes[0]).toBe("role not found");
    expect(result.notes[1]).toHaveLength(300);
  });
});

describe("parseTimeoutDuration", () => {
  it.each([
    ["10m", "10m"],
    ["90 min", "90m"],
    ["2 hours", "2h"],
    ["1 day", "1d"],
    ["28d", "28d"],
    ["3 HRS", "3h"],
  ])("parses %s as %s", (input, expected) => {
    expect(parseTimeoutDuration(input)).toBe(expected);
  });

  it.each(["29d", "40321m", "0h", "", "soon", "10", "10s", 10, null])("rejects %s", (input) => {
    expect(parseTimeoutDuration(input)).toBeNull();
  });
});
