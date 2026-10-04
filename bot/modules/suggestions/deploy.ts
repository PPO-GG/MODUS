import type { SuggestionMessagePayload } from "./embed";

export interface PanelStored {
  panelChannelId: string | null;
  panelMessageId: string | null;
}

export interface PanelDeployDeps {
  /** Posts a new panel message in the target channel; returns its id. */
  post(payload: SuggestionMessagePayload): Promise<string>;
  /** Edits the panel message in the target channel; "missing" when it no longer exists. Other failures throw. */
  edit(messageId: string, payload: SuggestionMessagePayload): Promise<"ok" | "missing">;
}

export type PanelDeployResult = {
  action: "posted" | "updated" | "reposted";
  messageId: string;
};

/**
 * Posts the panel, or edits the stored one in place when it lives in the same
 * channel. A vanished stored message is replaced; any OTHER edit error
 * propagates so a transient failure never leaves a duplicate panel behind.
 */
export async function deployPanel(
  deps: PanelDeployDeps,
  input: { channelId: string; payload: SuggestionMessagePayload; stored: PanelStored },
): Promise<PanelDeployResult> {
  const { channelId, payload, stored } = input;
  if (stored.panelChannelId === channelId && stored.panelMessageId) {
    if ((await deps.edit(stored.panelMessageId, payload)) === "ok") {
      return { action: "updated", messageId: stored.panelMessageId };
    }
    return { action: "reposted", messageId: await deps.post(payload) };
  }
  return { action: "posted", messageId: await deps.post(payload) };
}
