import { describe, expect, it } from "vitest";
import {
  getRecordingLimits,
  MAX_RECORDING_USERS,
} from "@modus/db/recording-limits";

describe("getRecordingLimits", () => {
  it("limits free guilds to 1 hour and 5 users", () => {
    expect(getRecordingLimits(false)).toEqual({
      maxDurationSeconds: 3600,
      maxUsers: 5,
    });
  });

  it("gives premium guilds 4 hours and the same 5-user cap", () => {
    expect(getRecordingLimits(true)).toEqual({
      maxDurationSeconds: 14400,
      maxUsers: MAX_RECORDING_USERS,
    });
  });
});
