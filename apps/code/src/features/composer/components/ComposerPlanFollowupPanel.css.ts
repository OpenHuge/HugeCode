import { style } from "@vanilla-extract/css";
import * as sharedStyles from "./ComposerResolverPanel.css";

export const panel = sharedStyles.panel;
export const progressRow = sharedStyles.headerRow;
export const progressBadge = sharedStyles.badge;
export const statusPill = sharedStyles.pill;
export const title = sharedStyles.title;
export const helper = sharedStyles.helper;

export const preview = style({
  minWidth: 0,
  display: "grid",
  gap: "8px",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
  color: "var(--color-fg-primary)",
  borderRadius: "14px",
  padding: "12px 14px",
  background: "color-mix(in srgb, var(--color-surface-0) 96%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 66%, transparent)",
});

export const previewLine = style({
  minWidth: 0,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
});

export const previewNote = style([
  previewLine,
  {
    paddingTop: "8px",
    borderTop: "1px solid color-mix(in srgb, var(--color-border) 54%, transparent)",
    color: "var(--color-fg-secondary)",
  },
]);

export const textarea = style([sharedStyles.textarea, { minHeight: "88px" }]);

export const footerNote = sharedStyles.footerNote;
