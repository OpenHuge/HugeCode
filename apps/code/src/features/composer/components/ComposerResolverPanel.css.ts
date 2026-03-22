import { style } from "@vanilla-extract/css";

export const panel = style({
  display: "grid",
  gap: "12px",
  minWidth: 0,
  padding: "14px 16px 12px",
  borderBottom: "1px solid color-mix(in srgb, var(--color-border) 64%, transparent)",
  background: "var(--color-surface-0)",
  boxShadow: "none",
});

export const headerStack = style({
  display: "grid",
  gap: "8px",
  minWidth: 0,
});

export const headerRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
});

export const badge = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  borderRadius: "999px",
  padding: "0 10px",
  border: "1px solid color-mix(in srgb, var(--color-border) 62%, transparent)",
  background: "color-mix(in srgb, var(--color-surface-2) 82%, transparent)",
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  letterSpacing: "0.02em",
});

export const pill = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  borderRadius: "999px",
  padding: "0 10px",
  background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-0))",
  color: "color-mix(in srgb, var(--color-primary) 72%, white)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
});

export const metaLabel = style({
  fontSize: "var(--font-size-meta)",
  color: "var(--color-fg-secondary)",
  fontWeight: 600,
});

export const title = style({
  minWidth: 0,
  fontSize: "clamp(1.05rem, 0.98rem + 0.28vw, 1.3rem)",
  lineHeight: "var(--line-height-135)",
  fontWeight: 650,
  color: "var(--color-fg-primary)",
  letterSpacing: "-0.02em",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
});

export const helper = style({
  minWidth: 0,
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-155)",
  color: "var(--color-fg-secondary)",
  overflowWrap: "anywhere",
});

export const textarea = style({
  width: "100%",
  resize: "vertical",
  borderRadius: "16px",
  border: "1px solid color-mix(in srgb, var(--color-border) 72%, transparent)",
  background: "color-mix(in srgb, var(--color-surface-0) 94%, transparent)",
  color: "var(--color-fg-primary)",
  padding: "12px 14px",
  font: "inherit",
  lineHeight: "var(--line-height-150)",
  boxSizing: "border-box",
  selectors: {
    "&::placeholder": {
      color: "var(--color-fg-tertiary)",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--color-primary) 62%, transparent)",
      outlineOffset: "2px",
      borderColor: "color-mix(in srgb, var(--color-primary) 54%, var(--color-border))",
    },
  },
});

export const footerNote = style({
  minWidth: 0,
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-140)",
  color: "var(--color-fg-tertiary)",
  overflowWrap: "anywhere",
  paddingTop: "2px",
});
