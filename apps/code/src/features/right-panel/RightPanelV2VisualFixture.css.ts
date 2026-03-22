import { style } from "@vanilla-extract/css";

export const shell = style({
  minHeight: "100vh",
  padding: "28px",
  background:
    "radial-gradient(circle at top left, color-mix(in srgb, var(--ds-brand-primary) 10%, transparent), transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-canvas) 98%, transparent), color-mix(in srgb, var(--ds-surface-base) 96%, transparent))",
});

export const frame = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 372px",
  gap: "20px",
  maxWidth: "1440px",
  margin: "0 auto",
  "@media": {
    "(max-width: 1100px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const hero = style({
  display: "grid",
  gap: "14px",
  padding: "24px",
  borderRadius: "24px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-panel) 94%, transparent), color-mix(in srgb, var(--ds-surface-card) 86%, transparent))",
  boxShadow:
    "0 24px 60px color-mix(in srgb, var(--ds-color-black) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent)",
});

export const eyebrow = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-micro)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ds-text-muted)",
});

export const titleRow = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
});

export const chipRow = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
});

export const subtitle = style({
  maxWidth: "72ch",
});

export const workspaceSurface = style({
  minHeight: "780px",
  borderRadius: "24px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 95%, transparent), color-mix(in srgb, var(--ds-surface-panel) 90%, transparent))",
  padding: "22px",
  display: "grid",
  gap: "18px",
});

export const workspaceHeader = style({
  display: "grid",
  gap: "6px",
});

export const workspaceBody = style({
  display: "grid",
  gap: "14px",
  alignContent: "start",
});

export const workspaceCard = style({
  padding: "16px 18px",
  borderRadius: "18px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 92%, transparent), color-mix(in srgb, var(--ds-surface-muted) 70%, transparent))",
});

export const rightRail = style({
  minHeight: "780px",
});
