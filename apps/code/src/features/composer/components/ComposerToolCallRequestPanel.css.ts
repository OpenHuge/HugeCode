import { style } from "@vanilla-extract/css";
import * as sharedStyles from "./ComposerResolverPanel.css";

export const panel = sharedStyles.panel;
export const header = sharedStyles.headerRow;
export const badge = sharedStyles.badge;
export const pill = sharedStyles.pill;
export const title = sharedStyles.title;
export const helper = sharedStyles.helper;

export const detailGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
});

export const detailCard = style({
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--color-surface-1) 72%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 62%, transparent)",
});

export const detailLabel = style({
  fontSize: "var(--font-size-meta)",
  color: "var(--color-fg-secondary)",
  fontWeight: 600,
});

export const detailValue = style({
  fontSize: "var(--font-size-content)",
  color: "var(--color-fg-primary)",
  fontWeight: 600,
  minWidth: 0,
  wordBreak: "break-word",
});

export const codeValue = style({
  fontFamily: "var(--font-family-mono)",
  fontSize: "var(--font-size-meta)",
});

export const argsPreview = style({
  margin: 0,
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--color-border) 72%, transparent)",
  background: "color-mix(in srgb, var(--color-surface-1) 72%, transparent)",
  color: "var(--color-fg-primary)",
  fontFamily: "var(--font-family-mono)",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
  whiteSpace: "pre-wrap",
  overflowX: "auto",
});

export const textarea = style([sharedStyles.textarea, { minHeight: "96px" }]);

export const checkboxRow = style({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "flex-start",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--color-surface-1) 72%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 62%, transparent)",
});

export const checkbox = style({
  marginTop: "2px",
});

export const checkboxTitle = style({
  fontSize: "var(--font-size-content)",
  fontWeight: 600,
  color: "var(--color-fg-primary)",
});
