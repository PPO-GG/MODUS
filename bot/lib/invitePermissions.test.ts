import { describe, expect, it } from "vitest";
import {
  INVITE_BASELINE_NAMES,
  INVITE_PERMISSION_NAMES,
  findMissingInvitePermissions,
  permissionLabel,
} from "./invitePermissions";
import {
  INVITE_BASELINE_NAMES as WEB_BASELINE,
  INVITE_PERMISSION_NAMES as WEB_ALL,
} from "../../web/shared/bot-invite";
import { PermissionFlagsBits } from "discord.js";

const memberWith = (granted: string[]): any => ({
  permissions: {
    has: (flag: bigint) =>
      granted.some(
        (n) => PermissionFlagsBits[n as keyof typeof PermissionFlagsBits] === flag,
      ),
  },
});

describe("invite permission lists", () => {
  it("match the web invite link exactly", () => {
    expect([...INVITE_BASELINE_NAMES]).toEqual(WEB_BASELINE);
    expect([...INVITE_PERMISSION_NAMES]).toEqual(WEB_ALL);
  });

  it("only name flags discord.js knows", () => {
    for (const name of INVITE_PERMISSION_NAMES) {
      expect(PermissionFlagsBits[name as keyof typeof PermissionFlagsBits]).toBeTypeOf("bigint");
    }
  });
});

describe("findMissingInvitePermissions", () => {
  it("reports nothing when everything is granted", () => {
    expect(findMissingInvitePermissions(memberWith([...INVITE_PERMISSION_NAMES]))).toEqual({
      baseline: [],
      other: [],
    });
  });

  it("splits missing baseline from module-specific permissions", () => {
    const granted = INVITE_PERMISSION_NAMES.filter(
      (n) => n !== "EmbedLinks" && n !== "BanMembers",
    );
    expect(findMissingInvitePermissions(memberWith([...granted]))).toEqual({
      baseline: ["Embed Links"],
      other: ["Ban Members"],
    });
  });

  it("reports everything for a bot with no permissions", () => {
    const missing = findMissingInvitePermissions(memberWith([]));
    expect(missing.baseline).toHaveLength(INVITE_BASELINE_NAMES.length);
    expect(missing.baseline.length + missing.other.length).toBe(INVITE_PERMISSION_NAMES.length);
  });
});

describe("permissionLabel", () => {
  it("spaces camel case", () => {
    expect(permissionLabel("ViewChannel")).toBe("View Channel");
    expect(permissionLabel("Speak")).toBe("Speak");
  });
});
