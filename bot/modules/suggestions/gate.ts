import type { SuggestionsSettingsType } from "../../lib/schemas";
import { parseSuggestionsSettings } from "./settings";

export type GateResult =
  | { ok: true; settings: SuggestionsSettingsType }
  | { ok: false; message: string };

/**
 * ModuleManager's component dispatch only checks GLOBAL enablement, so every
 * button/modal handler runs this first: per-guild enablement, then (when the
 * action posts to the suggestions channel) that a valid channel is configured.
 */
export async function resolveGuildSettings(
  deps: { isEnabled(): Promise<boolean>; loadSettings(): Promise<unknown> },
  opts: { requireChannel: boolean },
): Promise<GateResult> {
  if (!(await deps.isEnabled())) {
    return { ok: false, message: "Suggestions are disabled for this server." };
  }
  const { settings, configured } = parseSuggestionsSettings(await deps.loadSettings());
  if (opts.requireChannel && !configured) {
    return {
      ok: false,
      message: "Suggestions are not set up yet — ask an admin to choose a channel on the dashboard.",
    };
  }
  return { ok: true, settings };
}
