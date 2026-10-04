/**
 * Pure builder for the "New suggestion" panel message. Mirrored (as a locally
 * duplicated copy, per this repo's convention) by
 * web/server/api/suggestions/_panel.ts; the parity test
 * web/server/utils/suggestions-panel-parity.test.ts fails if the two drift:
 * change both files together.
 */
import { truncate, type SuggestionMessagePayload } from "./embed";

export const PANEL_CUSTOM_ID = "suggestions:new";
export const PANEL_COLOR = 0x57f287;

export interface PanelTexts {
  panelTitle: string;
  panelBlurb: string;
  panelButtonLabel: string;
}

// Numeric constants instead of discord.js enums so the web copy is identical.
const ACTION_ROW = 1;
const BUTTON = 2;
const PRIMARY = 1;

const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4000;
const MAX_LABEL = 80;

export function buildPanelMessage(texts: PanelTexts): SuggestionMessagePayload {
  return {
    embeds: [
      {
        title: truncate(texts.panelTitle, MAX_TITLE),
        description: truncate(texts.panelBlurb, MAX_DESCRIPTION),
        color: PANEL_COLOR,
      },
    ],
    components: [
      {
        type: ACTION_ROW,
        components: [
          {
            type: BUTTON,
            style: PRIMARY,
            custom_id: PANEL_CUSTOM_ID,
            label: truncate(texts.panelButtonLabel, MAX_LABEL),
          },
        ],
      },
    ] as unknown as SuggestionMessagePayload["components"],
  };
}
