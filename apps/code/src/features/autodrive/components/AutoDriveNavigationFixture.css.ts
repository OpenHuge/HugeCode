import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface) 96%, transparent), color-mix(in srgb, var(--ds-surface-hover) 92%, transparent))",
});

export const shell = style({
  maxWidth: "1280px",
  margin: "0 auto",
  display: "grid",
  gap: "16px",
});

export const headerPanel = style({
  display: "grid",
});

export const header = style({
  display: "grid",
  gap: "6px",
});

export const headerMetaRow = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-start",
  gap: "8px",
  marginTop: "10px",
});

export const title = style({
  margin: 0,
  fontSize: "var(--font-size-display)",
  fontWeight: "600",
  color: "var(--ds-text-stronger)",
});

export const subtitle = style({
  margin: 0,
  color: "var(--ds-text-muted)",
  maxWidth: "72ch",
});

export const ledgerPanel = style({
  display: "grid",
  gap: "10px",
});

export const ledgerList = style({
  display: "grid",
  gap: "8px",
});

export const ledgerItem = style({
  display: "grid",
  gap: "4px",
});

export const ledgerPath = style({
  margin: 0,
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
});

export const ledgerEmpty = style({
  display: "grid",
});

export const ledgerEmptyText = style({
  margin: 0,
});

export const ledgerPreview = style({
  margin: 0,
  whiteSpace: "pre-wrap",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
  fontFamily: "var(--code-font-family)",
});
