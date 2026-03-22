import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "32px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-app) 92%, var(--ds-color-white) 8%), color-mix(in srgb, var(--ds-surface-canvas) 94%, var(--ds-color-white) 6%))",
  display: "grid",
  placeItems: "center",
});

export const frame = style({
  width: "min(960px, 100%)",
  display: "grid",
  gap: "20px",
  padding: "24px",
  borderRadius: "24px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 96%, var(--ds-color-white) 4%), color-mix(in srgb, var(--ds-surface-elevated) 94%, transparent))",
  boxShadow: "0 24px 48px -32px color-mix(in srgb, var(--ds-shadow-color) 28%, transparent)",
});

export const header = style({
  display: "grid",
  gap: "8px",
});

export const eyebrow = style({
  fontSize: "var(--font-size-micro)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

export const title = style({
  margin: 0,
  fontSize: "clamp(1.5rem, 2vw, 2rem)",
  lineHeight: "var(--line-height-110)",
  color: "var(--ds-text-strong)",
});

export const subtitle = style({
  margin: 0,
  maxWidth: "64ch",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
});

export const grid = style({
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
});

export const card = style({
  display: "grid",
  gap: "12px",
  padding: "18px",
  borderRadius: "20px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-surface-card-base) 4%), color-mix(in srgb, var(--ds-surface-control) 18%, transparent))",
});

export const cardTitle = style({
  margin: 0,
  fontSize: "var(--font-size-label)",
  color: "var(--ds-text-strong)",
});

export const cardNote = style({
  margin: 0,
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  lineHeight: "var(--line-height-150)",
});

export const actionHarness = style({
  display: "grid",
  gap: "10px",
});

export const actionSurface = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  minHeight: "56px",
  padding: "14px 16px",
  borderRadius: "16px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-app) 90%, var(--ds-color-white) 10%), color-mix(in srgb, var(--ds-surface-control) 20%, transparent))",
});

export const actionStatus = style({
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const actionCaption = style({
  margin: 0,
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  lineHeight: "var(--line-height-150)",
});
