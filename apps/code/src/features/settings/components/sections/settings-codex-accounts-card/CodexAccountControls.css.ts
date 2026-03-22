import { style } from "@vanilla-extract/css";

export const inputField = style({
  vars: {
    "--ds-input-radius": "var(--apm-ctrl-radius)",
    "--ds-input-border": "var(--apm-border-soft)",
    "--ds-input-surface": "var(--apm-panel-muted)",
    "--ds-input-text": "var(--apm-text-primary)",
    "--ds-input-placeholder": "var(--apm-text-tertiary)",
  },
  flex: "1 1 auto",
  minWidth: 0,
});

export const inputFieldCompact = style({
  flex: "0 0 auto",
  width: "88px",
});

export const emptyField = style({
  display: "flex",
  alignItems: "center",
  minHeight: "38px",
  padding: "8px 12px",
  borderRadius: "var(--apm-ctrl-radius)",
  border: "1px solid var(--apm-border-soft)",
  background: "var(--apm-panel-muted)",
  color: "var(--apm-text-tertiary)",
  fontSize: "var(--font-size-chrome)",
});

export const selectRoot = style({
  vars: {
    "--ds-select-trigger-width": "100%",
  },
  minWidth: 0,
  width: "100%",
});

export const selectTrigger = style({
  vars: {
    "--ds-select-trigger-width": "100%",
    "--ds-select-trigger-border": "1px solid var(--apm-border-soft)",
    "--ds-select-trigger-bg": "var(--apm-panel-muted)",
    "--ds-select-trigger-gloss": "none",
    "--ds-select-trigger-color": "var(--apm-text-primary)",
    "--ds-select-trigger-shadow": "none",
    "--ds-select-trigger-backdrop": "none",
    "--ds-select-trigger-hover-border": "var(--apm-border-strong)",
    "--ds-select-trigger-hover-bg": "var(--apm-panel-bg)",
    "--ds-select-trigger-hover-color": "var(--apm-text-primary)",
    "--ds-select-trigger-hover-shadow": "none",
    "--ds-select-trigger-open-border":
      "color-mix(in srgb, var(--ds-brand-primary) 46%, var(--apm-border-soft))",
    "--ds-select-trigger-open-bg": "var(--apm-panel-bg)",
    "--ds-select-trigger-open-color": "var(--apm-text-primary)",
    "--ds-select-trigger-open-shadow": "none",
  },
  width: "100%",
});

export const selectMenu = style({
  vars: {
    "--ds-select-menu-bg":
      "color-mix(in srgb, var(--apm-panel-bg) 96%, var(--ds-surface-card-base))",
    "--ds-select-menu-border": "1px solid var(--apm-border-soft)",
    "--ds-select-menu-gloss": "none",
    "--ds-select-menu-shadow": "none",
    "--ds-select-menu-backdrop": "none",
  },
});

export const selectOption = style({
  minHeight: "30px",
  padding: "4px 8px",
  borderRadius: "10px",
  fontSize: "var(--font-size-meta)",
});

export const triggerButton = style({
  width: "100%",
  justifyContent: "space-between",
  gap: "8px",
});

export const triggerButtonLabel = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const triggerButtonIcon = style({
  opacity: "0.5",
  flexShrink: 0,
});

export const popoverWrapper = style({
  position: "fixed",
  top: "var(--apm-popover-top, 0px)",
  left: "var(--apm-popover-left, 0px)",
  width: "var(--apm-popover-width, 300px)",
  pointerEvents: "none",
  zIndex: "100",
});

export const popoverContent = style({
  padding: "var(--ds-space-2)",
  maxHeight: "300px",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  pointerEvents: "auto",
});
