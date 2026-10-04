import { SUGGESTION_PANEL_DEFAULTS, SuggestionsSettingsSchema, type SuggestionsSettingsType } from "../../lib/schemas";

export interface ParsedSuggestionsSettings {
  settings: SuggestionsSettingsType;
  /** A channel is set and the settings are valid. */
  configured: boolean;
  /** The stored settings failed validation (defaults are returned instead). */
  invalid: boolean;
}

const DEFAULTS: SuggestionsSettingsType = {
  channelId: null,
  staffRoleIds: [],
  createThread: true,
  closeVotingOnDecision: true,
  panelTitle: SUGGESTION_PANEL_DEFAULTS.title,
  panelBlurb: SUGGESTION_PANEL_DEFAULTS.blurb,
  panelButtonLabel: SUGGESTION_PANEL_DEFAULTS.buttonLabel,
  panelChannelId: null,
  panelMessageId: null,
};

export function parseSuggestionsSettings(raw: unknown): ParsedSuggestionsSettings {
  const parsed = SuggestionsSettingsSchema.safeParse(raw ?? {});
  if (!parsed.success) return { settings: { ...DEFAULTS }, configured: false, invalid: true };
  return {
    settings: parsed.data,
    configured: parsed.data.channelId !== null,
    invalid: false,
  };
}
