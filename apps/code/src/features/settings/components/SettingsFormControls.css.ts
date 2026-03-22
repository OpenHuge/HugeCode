import { style } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";
import {
  settingsSelectMenu,
  settingsSelectOption,
  settingsSelectRoot,
  settingsSelectTrigger,
} from "./SettingsSelect.css";

export const inputField = style({
  vars: {
    "--ds-input-radius": "var(--ds-radius-md)",
    "--ds-input-border": "color-mix(in srgb, var(--ds-border-muted) 78%, transparent)",
    "--ds-input-surface": "var(--ds-surface-control)",
    "--ds-input-text": "var(--ds-text-strong)",
    "--ds-input-placeholder": "var(--ds-text-faint)",
  },
  flex: 1,
  minWidth: 0,
  boxShadow: "none",
});

export const inputFieldCompact = style({
  flex: "1 1 0",
  minWidth: 0,
});

export const inputFieldNarrow = style({
  flex: "0 0 auto",
  width: "88px",
});

export const inputControlAlignEnd = style({
  textAlign: "right",
});

export const inputControlMonospace = style({
  fontFamily: "var(--code-font-family)",
  letterSpacing: "0.02em",
});

export const textareaField = style({
  vars: {
    "--ds-textarea-radius": "var(--ds-radius-md)",
    "--ds-textarea-border": "color-mix(in srgb, var(--ds-border-muted) 78%, transparent)",
    "--ds-textarea-surface": "var(--ds-surface-control)",
    "--ds-textarea-text": "var(--ds-text-strong)",
    "--ds-textarea-placeholder": "var(--ds-text-faint)",
  },
  minWidth: 0,
  width: "100%",
});

export const textareaCode = style({
  minHeight: "150px",
  resize: "vertical",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-chrome)",
  lineHeight: typographyValues.content.lineHeight,
});

export const selectRoot = style([
  settingsSelectRoot,
  {
    flex: "1 1 0",
    minWidth: 0,
    width: "100%",
  },
]);

export const selectTrigger = style([settingsSelectTrigger]);

export const selectMenu = style([settingsSelectMenu]);

export const selectOption = style([settingsSelectOption]);

export const rangeInput = style({
  width: "160px",
  accentColor: "var(--ds-border-accent)",
});
