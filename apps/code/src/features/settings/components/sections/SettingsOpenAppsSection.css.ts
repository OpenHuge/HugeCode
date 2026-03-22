import { globalStyle, style, styleVariants } from "@vanilla-extract/css";
import { elevationValues, motionValues, typographyValues } from "@ku0/design-system";
import {
  settingsSelectMenu,
  settingsSelectOption,
  settingsSelectTrigger,
} from "../SettingsSelect.css";

export const openApps = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const row = style({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px",
  borderRadius: "var(--ds-radius-md)",
  border: "1px solid var(--ds-border-muted)",
  background: "var(--ds-surface-card-base)",
  flexWrap: "wrap",
  boxShadow: elevationValues.none,
  transition: motionValues.interactive,
  selectors: {
    "&:hover": {
      borderColor: "color-mix(in srgb, var(--ds-border-strong) 68%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 84%, var(--ds-surface-card-base))",
      boxShadow: elevationValues.card,
    },
  },
});

export const rowState = styleVariants({
  complete: {},
  incomplete: {
    borderColor: "color-mix(in srgb, var(--status-error) 45%, var(--ds-border-muted))",
  },
});

export const iconWrap = style({
  flex: "0 0 auto",
  width: "20px",
  height: "20px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});

export const icon = style({
  width: "19px",
  height: "19px",
  display: "block",
  flexShrink: 0,
});

export const fields = style({
  flex: "1",
  minWidth: "0",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
});

export const field = style({
  minWidth: "0",
  display: "inline-flex",
  alignItems: "center",
});

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  marginLeft: "auto",
  flex: "0 0 auto",
});

export const status = style({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
});

export const controlSurface = style({
  vars: {
    "--ds-input-radius": "var(--ds-radius-md)",
    "--ds-input-border": "color-mix(in srgb, var(--ds-border-muted) 78%, transparent)",
    "--ds-input-surface": "var(--ds-surface-control)",
    "--ds-input-text": "var(--ds-text-strong)",
    "--ds-input-placeholder": "var(--ds-text-faint)",
  },
  minWidth: "0",
  boxShadow: "none",
});

export const selectTrigger = style([settingsSelectTrigger]);

export const selectMenu = style([settingsSelectMenu]);

export const selectOption = style([settingsSelectOption]);

export const defaultOption = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: "var(--ds-text-muted)",
});

globalStyle(`${defaultOption} input`, {
  accentColor: "var(--ds-border-accent)",
});

export const order = style({
  display: "inline-flex",
  gap: "4px",
});

export const inputWidth = styleVariants({
  label: {
    width: "140px",
  },
  appName: {
    width: "220px",
    maxWidth: "240px",
  },
  command: {
    width: "200px",
    maxWidth: "220px",
  },
  args: {
    flex: "1",
    minWidth: "140px",
  },
});

export const kind = style({
  width: "96px",
  minWidth: "96px",
  vars: {
    "--ds-select-trigger-width": "100%",
  },
});

export const footer = style({
  marginTop: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});
