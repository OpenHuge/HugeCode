import { type StyleRule, style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import * as branchPickerStyles from "../../git/components/BranchPicker.styles.css";

const hoveredBranchStyles = {
  background: "color-mix(in srgb, var(--ds-surface-card) 80%, transparent)",
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 16%, transparent)",
} as const;
const selectedBranchStyles = {
  background: "color-mix(in srgb, var(--ds-surface-card) 86%, transparent)",
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 20%, transparent)",
} as const;

function feature(rule: StyleRule) {
  return style({ "@layer": { [layers.features]: rule } });
}

export const modalCard = feature({
  width: "min(560px, calc(100vw - 48px))",
  maxHeight: "calc(100vh - 64px)",
  overflow: "auto",
  borderRadius: "16px",
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow:
    "var(--ds-elevation-2), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
});
export const branch = feature({ display: "flex", flexDirection: "column", gap: "6px" });
export const branchList = style([
  branchPickerStyles.listBase,
  {
    "@layer": {
      [layers.features]: {
        border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
        borderRadius: "10px",
        background: "color-mix(in srgb, var(--ds-surface-muted) 92%, transparent)",
        maxHeight: "220px",
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 22%, transparent)",
      },
    },
  },
]);
export const branchEmpty = style([
  branchPickerStyles.emptyBase,
  {
    "@layer": {
      [layers.features]: {
        color: "var(--ds-text-faint)",
        fontSize: "var(--font-size-meta)",
      },
    },
  },
]);
export const branchItem = style([
  branchPickerStyles.itemBase,
  {
    "@layer": {
      [layers.features]: {
        borderRadius: "8px",
      },
    },
    selectors: {
      "&:hover": hoveredBranchStyles,
    },
  },
]);
export const branchItemSelected = feature(selectedBranchStyles);
export const branchItemName = branchPickerStyles.itemName;
export const checkboxRow = feature({
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-subtle)",
});
export const checkboxInput = feature({ marginTop: "2px" });
export const checkboxCode = feature({
  fontFamily: 'var(--code-font-family, Menlo, Monaco, "Courier New", monospace)',
  color: "var(--ds-text-strong)",
});
export const sectionTitle = feature({
  fontSize: "var(--font-size-chrome)",
  fontWeight: "600",
  color: "var(--ds-text-strong)",
});
export const hint = feature({ fontSize: "var(--font-size-meta)", color: "var(--ds-text-subtle)" });
