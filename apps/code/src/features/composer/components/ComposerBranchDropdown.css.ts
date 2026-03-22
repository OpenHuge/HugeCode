import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import * as branchPickerStyles from "../../git/components/BranchPicker.styles.css";

export const menu = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      right: 0,
      width: "min(360px, calc(100vw - 32px))",
      maxHeight: "min(420px, calc(100vh - 180px))",
      borderRadius: "12px",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: 60,
      boxShadow: "var(--ds-elevation-2)",
    },
  },
});

export const modeRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "6px",
      padding: "10px 10px 0",
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
      padding: "5px 10px",
      fontSize: "var(--font-size-fine)",
      fontWeight: 600,
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:hover": {
      color: "var(--ds-text-strong)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--ds-focus-ring)",
      outlineOffset: "1px",
    },
  },
});

export const modeButtonActive = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-muted) 82%, transparent)",
      color: "var(--ds-text-strong)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
    },
  },
});

export const helper = style({
  "@layer": {
    [layers.features]: {
      padding: "8px 10px 10px",
      color: "var(--ds-text-faint)",
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-140)",
    },
  },
});

export const input = style({
  "@layer": {
    [layers.features]: {
      border: "none",
      borderTop: "1px solid color-mix(in srgb, var(--ds-border-subtle) 52%, transparent)",
      borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 52%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 58%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "12px 14px",
      fontSize: "var(--font-size-label)",
    },
  },
  selectors: {
    "&:focus-visible": {
      outline: "2px solid var(--ds-focus-ring)",
      outlineOffset: "-2px",
    },
    "&::placeholder": {
      color: "var(--ds-text-faint)",
    },
  },
});

export const list = style([
  branchPickerStyles.listBase,
  {
    "@layer": {
      [layers.features]: {
        flex: 1,
        maxHeight: "280px",
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
        fontSize: "var(--font-size-fine)",
      },
    },
  },
]);

export const item = style([
  branchPickerStyles.itemBase,
  {
    "@layer": {
      [layers.features]: {
        borderRadius: "8px",
      },
    },
    selectors: {
      "&:hover": {
        background: "color-mix(in srgb, var(--ds-surface-muted) 76%, transparent)",
        borderColor: "color-mix(in srgb, var(--ds-border-subtle) 64%, transparent)",
      },
    },
  },
]);

export const itemSelected = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-muted) 82%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
    },
  },
});

export const itemCurrent = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-muted) 86%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
    },
  },
});

export const itemName = branchPickerStyles.itemName;

export const itemMeta = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      gap: "6px",
      marginLeft: "8px",
      flexShrink: 0,
    },
  },
});

export const itemMetaChip = style({
  "@layer": {
    [layers.features]: {
      padding: "2px 6px",
      borderRadius: "999px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 84%, transparent)",
    },
  },
});
