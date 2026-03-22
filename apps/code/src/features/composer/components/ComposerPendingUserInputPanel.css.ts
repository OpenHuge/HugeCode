import { style } from "@vanilla-extract/css";
import * as sharedStyles from "./ComposerResolverPanel.css";

export const panel = sharedStyles.panel;
export const panelHeader = sharedStyles.headerStack;
export const progressRow = sharedStyles.headerRow;
export const progressBadge = sharedStyles.badge;
export const sectionLabel = sharedStyles.metaLabel;
export const question = sharedStyles.title;
export const helper = sharedStyles.helper;

export const optionList = style({
  display: "grid",
  gap: "10px",
});

export const optionButton = style({
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
  background: "color-mix(in srgb, var(--color-surface-1) 84%, transparent)",
  color: "var(--color-fg-primary)",
  textAlign: "left",
  transition:
    "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover": {
      borderColor: "color-mix(in srgb, var(--color-border) 92%, var(--color-primary))",
      background: "color-mix(in srgb, var(--color-surface-2) 90%, transparent)",
      transform: "translateY(-1px)",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--color-primary) 68%, transparent)",
      outlineOffset: "2px",
    },
  },
});

export const optionButtonSelected = style({
  borderColor: "color-mix(in srgb, var(--color-primary) 62%, var(--color-border))",
  background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-0))",
});

export const optionIndex = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "9px",
  background: "color-mix(in srgb, var(--color-surface-2) 88%, transparent)",
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 700,
});

export const optionIndexSelected = style({
  background: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
  color: "color-mix(in srgb, var(--color-primary) 72%, white)",
});

export const optionText = style({
  display: "grid",
  gap: "2px",
  minWidth: 0,
});

export const optionLabel = style({
  fontSize: "var(--font-size-content)",
  lineHeight: "var(--line-height-135)",
  fontWeight: 620,
  color: "var(--color-fg-primary)",
});

export const optionDescription = style({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-145)",
  color: "var(--color-fg-secondary)",
});

export const optionCheck = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "22px",
  height: "22px",
  borderRadius: "999px",
  color: "var(--color-primary)",
});

export const footerNote = sharedStyles.footerNote;
