import { describe, expect, it, vi } from "vitest";
import { deployPanel } from "./deploy";
import { buildPanelMessage } from "./panel";

const payload = buildPanelMessage({ panelTitle: "S", panelBlurb: "B", panelButtonLabel: "L" });
const none = { panelChannelId: null, panelMessageId: null };

function makeDeps(over: Record<string, unknown> = {}) {
  return {
    post: vi.fn(async () => "new-msg"),
    edit: vi.fn(async () => "ok" as "ok" | "missing"),
    ...over,
  };
}

describe("deployPanel", () => {
  it("posts a new panel when nothing is stored", async () => {
    const deps = makeDeps();
    const result = await deployPanel(deps, { channelId: "c1", payload, stored: none });
    expect(result).toEqual({ action: "posted", messageId: "new-msg" });
    expect(deps.post).toHaveBeenCalledWith(payload);
    expect(deps.edit).not.toHaveBeenCalled();
  });

  it("edits the stored message in place when it is in the same channel", async () => {
    const deps = makeDeps();
    const result = await deployPanel(deps, {
      channelId: "c1",
      payload,
      stored: { panelChannelId: "c1", panelMessageId: "old-msg" },
    });
    expect(result).toEqual({ action: "updated", messageId: "old-msg" });
    expect(deps.edit).toHaveBeenCalledWith("old-msg", payload);
    expect(deps.post).not.toHaveBeenCalled();
  });

  it("posts a new panel when the stored message no longer exists", async () => {
    const deps = makeDeps({ edit: vi.fn(async () => "missing" as const) });
    const result = await deployPanel(deps, {
      channelId: "c1",
      payload,
      stored: { panelChannelId: "c1", panelMessageId: "gone" },
    });
    expect(result).toEqual({ action: "reposted", messageId: "new-msg" });
    expect(deps.post).toHaveBeenCalledTimes(1);
  });

  it("posts (never edits) when the stored panel is in another channel", async () => {
    const deps = makeDeps();
    const result = await deployPanel(deps, {
      channelId: "c2",
      payload,
      stored: { panelChannelId: "c1", panelMessageId: "old-msg" },
    });
    expect(result).toEqual({ action: "posted", messageId: "new-msg" });
    expect(deps.edit).not.toHaveBeenCalled();
  });

  it("posts when only one of the two stored ids is present", async () => {
    const deps = makeDeps();
    await deployPanel(deps, { channelId: "c1", payload, stored: { panelChannelId: "c1", panelMessageId: null } });
    expect(deps.edit).not.toHaveBeenCalled();
    expect(deps.post).toHaveBeenCalledTimes(1);
  });

  it("lets an edit failure other than 'missing' propagate without posting a duplicate", async () => {
    const deps = makeDeps({
      edit: vi.fn(async () => {
        throw new Error("Missing Access");
      }),
    });
    await expect(
      deployPanel(deps, {
        channelId: "c1",
        payload,
        stored: { panelChannelId: "c1", panelMessageId: "old-msg" },
      }),
    ).rejects.toThrow("Missing Access");
    expect(deps.post).not.toHaveBeenCalled();
  });
});
