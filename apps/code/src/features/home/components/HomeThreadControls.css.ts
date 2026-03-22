import {
  focusRingValues,
  overlayValues,
  statusChipValues,
  typographyValues,
} from "@ku0/design-system";
import { globalStyle, style } from "@vanilla-extract/css";

export const leading = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "0",
  borderRadius: "0",
  background: "none",
  border: "none",
  boxShadow: "none",
  backdropFilter: "none",
});

export const workspaceSelect = style({
  vars: {
    "--ds-select-radius": "999px",
    "--ds-select-min-height": "28px",
    "--ds-select-padding-x": "10px",
    "--ds-select-trigger-border": "1px solid transparent",
    "--ds-select-trigger-bg": "color-mix(in srgb, var(--ds-surface-item) 88%, transparent)",
    "--ds-select-trigger-gloss": "none",
    "--ds-select-trigger-color": "var(--ds-text-muted)",
    "--ds-select-trigger-shadow": "none",
    "--ds-select-trigger-backdrop": "none",
    "--ds-select-trigger-hover-border":
      "color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
    "--ds-select-trigger-hover-bg":
      "color-mix(in srgb, var(--ds-surface-hover) 74%, var(--ds-surface-item))",
    "--ds-select-trigger-hover-color": "var(--ds-text-stronger)",
    "--ds-select-trigger-hover-shadow": "none",
    "--ds-select-trigger-open-border":
      "color-mix(in srgb, var(--ds-border-subtle) 40%, transparent)",
    "--ds-select-trigger-open-bg":
      "color-mix(in srgb, var(--ds-surface-hover) 78%, var(--ds-surface-item))",
    "--ds-select-trigger-open-color": "var(--ds-text-stronger)",
    "--ds-select-trigger-open-shadow": "none",
  },
  width: "auto",
  minWidth: "240px",
  maxWidth: "min(320px, 42vw)",
  "@media": {
    "(max-width: 640px)": {
      minWidth: "190px",
      maxWidth: "min(260px, 72vw)",
    },
  },
});

export const workspaceSelectTrigger = style({
  minHeight: "28px",
  borderRadius: "999px",
  fontSize: typographyValues.micro.fontSize,
  fontWeight: "600",
  letterSpacing: "0.01em",
  padding: "0 10px",
  selectors: {
    "&:hover:not(:disabled), &:focus-visible, &.is-open": {
      transform: "none",
    },
    "&:focus-visible": {
      outline: focusRingValues.input,
      outlineOffset: "1px",
    },
  },
});

globalStyle(`${workspaceSelectTrigger} [data-ui-select-trigger-caret="true"]`, {
  width: "14px",
  height: "14px",
  opacity: "0.76",
});

export const workspaceSelectMenu = style({
  vars: {
    "--ds-select-menu-max-width": "min(440px, 92vw)",
    "--ds-select-menu-padding": "6px",
    "--ds-select-menu-radius": "16px",
    "--ds-select-menu-border": overlayValues.menuBorder,
    "--ds-select-menu-bg": overlayValues.menuSurface,
    "--ds-select-menu-gloss": "none",
    "--ds-select-menu-shadow": overlayValues.menuShadow,
    "--ds-select-menu-backdrop": overlayValues.menuBackdrop,
    "--ds-select-option-min-height": "38px",
    "--ds-select-option-padding": "0 12px",
    "--ds-select-option-radius": "10px",
    "--ds-select-option-hover-shadow": "none",
    "--ds-select-option-selected-shadow": "none",
  },
  display: "grid",
  gap: "4px",
  borderRadius: "16px",
});

globalStyle(`${workspaceSelectMenu} [data-ui-select-option-check="true"]`, {
  color: "var(--ds-text-stronger)",
});

export const workspaceSelectOption = style({
  minHeight: "38px",
  padding: "0 12px",
  borderRadius: "12px",
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  color: "var(--ds-text-muted)",
  selectors: {
    "&:hover:not(:disabled), &:focus-visible": {
      color: "var(--ds-text-strong)",
    },
    "&.is-selected": {
      color: "var(--ds-text-stronger)",
    },
  },
});
