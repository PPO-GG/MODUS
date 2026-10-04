/**
 * Local copy of bot/modules/suggestions/panel.ts's builder. Duplicated rather
 * than shared — web/ cannot import from bot/, and this repo's convention (see
 * ./_embed.ts) is local helpers per feature. The parity test
 * server/utils/suggestions-panel-parity.test.ts fails if the two drift:
 * change both files together.
 */
export const PANEL_CUSTOM_ID = "suggestions:new";
export const PANEL_COLOR = 0x57f287;

export interface PanelTexts {
  panelTitle: string;
  panelBlurb: string;
  panelButtonLabel: string;
}

const ACTION_ROW = 1;
const BUTTON = 2;
const PRIMARY = 1;

const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4000;
const MAX_LABEL = 80;

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function buildPanelMessage(texts: PanelTexts): { embeds: unknown[]; components: unknown[] } {
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
    ],
  };
}
