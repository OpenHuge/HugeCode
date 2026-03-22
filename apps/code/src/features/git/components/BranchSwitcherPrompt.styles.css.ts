import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import * as branchPickerStyles from "./BranchPicker.styles.css";

export const modal = style({});
export const modalCard = style({
  "@layer": {
    [layers.features]: {
      width: "min(480px, calc(100vw - 48px))",
      maxHeight: "calc(100vh - 120px)",
      borderRadius: "12px",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow:
        "var(--ds-elevation-2), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
    },
  },
});
export const input = style({
  "@layer": {
    [layers.features]: {
      border: "none",
      borderBottom: "1px solid var(--ds-border-subtle)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 56%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "14px 16px",
      fontSize: "var(--font-size-label)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:focus-visible": {
      outline: "2px solid var(--ds-focus-ring)",
      outlineOffset: "1px",
      borderBottomColor: "color-mix(in srgb, var(--ds-border-subtle) 78%, var(--ds-focus-ring))",
      background: "color-mix(in srgb, var(--ds-surface-card) 62%, var(--ds-surface-muted))",
      boxShadow:
        "0 0 0 1px color-mix(in srgb, var(--ds-focus-ring) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--ds-border-subtle) 50%, transparent)",
    },
    "&::placeholder": {
      color: "var(--ds-text-faint)",
    },
  },
});

export const modeRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "8px",
      padding: "12px 16px 0",
    },
  },
});

export const modeButton = style({
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-subtle)",
      background: "transparent",
      color: "var(--ds-text-muted)",
      borderRadius: "999px",
      padding: "6px 12px",
      fontSize: "var(--font-size-chrome)",
      fontWeight: 600,
    },
  },
});

export const modeButtonActive = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-muted) 82%, transparent)",
      color: "var(--ds-text-strong)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
    },
  },
});

export const helper = style({
  "@layer": {
    [layers.features]: {
      padding: "8px 16px 12px",
      color: "var(--ds-text-faint)",
      fontSize: "var(--font-size-fine)",
    },
  },
});
export const list = style([
  branchPickerStyles.listBase,
  {
    "@layer": {
      [layers.features]: {
        flex: "1",
        maxHeight: "320px",
      },
    },
  },
]);

export const empty = style([
  branchPickerStyles.emptyBase,
  {
    "@layer": {
      [layers.features]: {
        padding: "16px",
        color: "var(--ds-text-faint)",
        fontSize: "var(--font-size-chrome)",
      },
    },
  },
]);

export const item = style([
  branchPickerStyles.itemBase,
  {
    "@layer": {
      [layers.features]: {
        borderRadius: "6px",
      },
    },
    selectors: {
      "&:hover": {
        background: "color-mix(in srgb, var(--ds-surface-muted) 72%, transparent)",
        borderColor: "color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 12%, transparent)",
      },
    },
  },
]);

export const itemSelected = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-muted) 80%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 18%, transparent)",
    },
  },
});

export const itemName = branchPickerStyles.itemName;

export const itemMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "6px",
      marginLeft: "8px",
      flexShrink: "0",
    },
  },
});

export const itemCurrent = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 82%, transparent)",
      padding: "2px 6px",
      borderRadius: "4px",
    },
  },
});

export const itemWorktree = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "color-mix(in srgb, var(--ds-brand-secondary) 62%, var(--ds-text-strong))",
      background: "color-mix(in srgb, var(--ds-brand-secondary) 8%, transparent)",
      padding: "2px 6px",
      borderRadius: "4px",
    },
  },
});
