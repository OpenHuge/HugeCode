import { style } from "@vanilla-extract/css";

export const shell = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "radial-gradient(circle at top, color-mix(in srgb, var(--ds-surface-hover) 82%, transparent), transparent 52%), var(--ds-background)",
  color: "var(--ds-text-strong)",
});

export const frame = style({
  width: "min(430px, 100%)",
  margin: "0 auto",
  display: "grid",
  gap: "18px",
});

export const header = style({
  display: "grid",
  gap: "8px",
});

export const eyebrow = style({
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});

export const title = style({
  margin: 0,
  fontSize: "clamp(1.5rem, 2vw, 2rem)",
  lineHeight: "var(--line-height-105)",
  letterSpacing: "-0.02em",
});

export const subtitle = style({
  margin: 0,
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-150)",
});

export const phoneShell = style({
  display: "grid",
  gap: "14px",
  minHeight: "420px",
  padding: "18px",
  borderRadius: "24px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface) 96%, transparent), color-mix(in srgb, var(--ds-surface-elevated) 94%, transparent))",
  boxShadow: "0 18px 48px color-mix(in srgb, black 10%, transparent)",
});

export const surface = style({
  display: "grid",
  gap: "10px",
  alignContent: "start",
  minHeight: "320px",
});

export const card = style({
  display: "grid",
  gap: "6px",
  padding: "16px",
  borderRadius: "18px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-elevated) 90%, transparent)",
});

export const cardTitle = style({
  margin: 0,
  fontSize: "var(--font-size-body)",
  fontWeight: 650,
});

export const cardCopy = style({
  margin: 0,
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-145)",
});
