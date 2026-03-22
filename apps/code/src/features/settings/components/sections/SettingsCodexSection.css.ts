import { style, styleVariants } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";
import {
  settingsSelectMenu,
  settingsSelectOption,
  settingsSelectRoot,
  settingsSelectTrigger,
} from "../SettingsSelect.css";

export const doctor = style({
  marginTop: "8px",
  padding: "12px 14px",
  borderRadius: "var(--ds-radius-md)",
  border: "1px solid var(--ds-border-muted)",
  background: "var(--ds-surface-card-base)",
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: "var(--ds-text-muted)",
});

export const doctorState = styleVariants({
  ok: {
    borderColor: "color-mix(in srgb, var(--status-success) 42%, var(--ds-border-muted))",
    color: "var(--ds-text-strong)",
  },
  error: {
    borderColor: "color-mix(in srgb, var(--status-error) 45%, var(--ds-border-muted))",
    color: "var(--ds-text-strong)",
  },
});

export const doctorTitle = style({
  fontWeight: "600",
  marginBottom: "6px",
});

export const doctorBody = style({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

export const doctorPath = style({
  wordBreak: "break-all",
  overflowWrap: "anywhere",
});

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

export const selectRoot = style([
  settingsSelectRoot,
  {
    minWidth: 0,
    width: "100%",
  },
]);

export const selectTrigger = style([settingsSelectTrigger]);

export const selectMenu = style([settingsSelectMenu]);

export const selectOption = style([settingsSelectOption]);

export const textareaField = style({
  vars: {
    "--ds-textarea-radius": "var(--ds-radius-md)",
    "--ds-textarea-border": "color-mix(in srgb, var(--ds-border-muted) 78%, transparent)",
    "--ds-textarea-surface": "var(--ds-surface-card-base)",
    "--ds-textarea-text": "var(--ds-text-strong)",
    "--ds-textarea-placeholder": "var(--ds-text-faint)",
  },
  width: "100%",
});

export const textarea = style({
  minHeight: "150px",
  resize: "vertical",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-chrome)",
  lineHeight: typographyValues.content.lineHeight,
});

export const controlRow = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
});

export const overrideList = style({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});

export const overrideActions = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "8px",
  minWidth: "280px",
});

export const overrideField = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
});
