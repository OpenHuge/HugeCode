import { style } from "@vanilla-extract/css";

export const panel = style({
  display: "grid",
  gap: "10px",
  padding: "12px 12px 10px",
  borderBottom: "1px solid color-mix(in srgb, var(--color-border) 58%, transparent)",
  background: "var(--color-surface-0)",
});

export const header = style({
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
  background: "color-mix(in srgb, var(--color-surface-2) 84%, transparent)",
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
  background: "color-mix(in srgb, var(--status-warning) 18%, transparent)",
  color: "color-mix(in srgb, var(--status-warning) 78%, white)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
});

export const title = style({
  fontSize: "clamp(1.05rem, 0.98rem + 0.28vw, 1.3rem)",
  lineHeight: "var(--line-height-135)",
  fontWeight: 650,
  color: "var(--color-fg-primary)",
  letterSpacing: "-0.02em",
});

export const helper = style({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-145)",
  color: "var(--color-fg-secondary)",
});

export const detailGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
});

export const detailCard = style({
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--color-surface-0) 96%, transparent)",
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

export const footerNote = style({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-145)",
  color: "var(--color-fg-secondary)",
});
