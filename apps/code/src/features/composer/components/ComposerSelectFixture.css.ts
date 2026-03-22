import { style } from "@vanilla-extract/css";

export const shell = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "radial-gradient(circle at top, color-mix(in srgb, var(--ds-surface-hover) 82%, transparent), transparent 52%), var(--ds-background)",
  color: "var(--ds-text-strong)",
});

export const frame = style({
  width: "min(1120px, 100%)",
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
  fontSize: "clamp(1.6rem, 2vw, 2.2rem)",
  lineHeight: "var(--line-height-105)",
  letterSpacing: "-0.02em",
});

export const subtitle = style({
  margin: 0,
  maxWidth: "720px",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-150)",
});

export const panel = style({
  display: "grid",
  gap: "16px",
  padding: "18px",
  borderRadius: "20px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface) 94%, transparent)",
  boxShadow: "0 18px 48px color-mix(in srgb, black 8%, transparent)",
});

export const toolbar = style({
  display: "grid",
  gap: "10px",
});

export const controlsRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
});

export const accessWrap = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "var(--composer-meta-control-height)",
  minWidth: 0,
  background: "transparent",
  color: "var(--ds-text-muted)",
});

export const accessGroupRail = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-raised) 90%, transparent), color-mix(in srgb, var(--ds-surface-floating) 72%, transparent))",
  boxShadow:
    "inset 0 1px 0 color-mix(in srgb, white 16%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 8%, transparent)",
  overflow: "hidden",
});

export const accessGroupLead = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "28px",
  padding: "0 12px",
  fontSize: "var(--font-size-meta)",
  fontWeight: 500,
  color: "var(--ds-text-muted)",
  whiteSpace: "nowrap",
});

export const accessGroupDivider = style({
  width: "1px",
  alignSelf: "stretch",
  background: "color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
});

export const accessGroupTail = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "28px",
  padding: "0 12px",
  fontSize: "var(--font-size-meta)",
  fontWeight: 500,
  color: "var(--ds-text-muted)",
  whiteSpace: "nowrap",
});

export const notes = style({
  display: "grid",
  gap: "6px",
  margin: 0,
  paddingLeft: "18px",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-145)",
});
