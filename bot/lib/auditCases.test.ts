import { describe, expect, it } from "vitest";
import { AuditLogEvent } from "discord.js";
import { auditEntryToCase, type AuditEntryLike } from "./auditCases";

const BOT = "bot-id";
const at = Date.parse("2026-09-28T12:00:00Z");
const entry = (over: Partial<AuditEntryLike>): AuditEntryLike => ({
  action: AuditLogEvent.MemberBanAdd, targetId: "target", executorId: "mod",
  reason: "spam", createdTimestamp: at, changes: [], ...over,
});

describe("auditEntryToCase", () => {
  it("maps ban, unban and kick", () => {
    expect(auditEntryToCase(entry({}), BOT)).toEqual({
      action: "ban", targetId: "target", moderatorId: "mod", reason: "spam", durationMinutes: null, createdAt: new Date(at),
    });
    expect(auditEntryToCase(entry({ action: AuditLogEvent.MemberBanRemove }), BOT)?.action).toBe("unban");
    expect(auditEntryToCase(entry({ action: AuditLogEvent.MemberKick }), BOT)?.action).toBe("kick");
  });

  it("maps a timeout set with its duration in minutes", () => {
    const until = new Date(at + 10 * 60_000).toISOString();
    const r = auditEntryToCase(entry({
      action: AuditLogEvent.MemberUpdate,
      changes: [{ key: "communication_disabled_until", old: undefined, new: until }],
    }), BOT);
    expect(r?.action).toBe("timeout");
    expect(r?.durationMinutes).toBe(10);
  });

  it("maps a cleared timeout to untimeout", () => {
    const r = auditEntryToCase(entry({
      action: AuditLogEvent.MemberUpdate,
      changes: [{ key: "communication_disabled_until", old: new Date(at).toISOString(), new: undefined }],
    }), BOT);
    expect(r?.action).toBe("untimeout");
    expect(r?.durationMinutes).toBeNull();
  });

  it("ignores unrelated entries, member updates without a timeout change, missing targets, and the bot's own actions", () => {
    expect(auditEntryToCase(entry({ action: AuditLogEvent.ChannelCreate }), BOT)).toBeNull();
    expect(auditEntryToCase(entry({ action: AuditLogEvent.MemberUpdate, changes: [{ key: "nick", old: "a", new: "b" }] }), BOT)).toBeNull();
    expect(auditEntryToCase(entry({ targetId: null }), BOT)).toBeNull();
    expect(auditEntryToCase(entry({ executorId: BOT }), BOT)).toBeNull();
  });

  it("keeps an unknown moderator and reason as null", () => {
    const r = auditEntryToCase(entry({ executorId: null, reason: null }), BOT);
    expect(r?.moderatorId).toBeNull();
    expect(r?.reason).toBeNull();
  });
});
