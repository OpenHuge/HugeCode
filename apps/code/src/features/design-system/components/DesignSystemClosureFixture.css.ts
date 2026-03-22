import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-canvas, var(--color-background)) 96%, transparent), var(--ds-surface-canvas, var(--color-background)))",
  color: "var(--color-foreground)",
});

export const stack = style({
  display: "grid",
  gap: "16px",
  maxWidth: "1200px",
  margin: "0 auto",
});

export const nav = style({
  display: "grid",
  gap: "8px",
});

export const detail = style({
  display: "grid",
  gap: "16px",
});

export const metaGrid = style({
  display: "grid",
  gap: "12px",
});

export const actionRow = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
});

export const overlayGrid = style({
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
});

export const popoverStack = style({
  display: "grid",
  gap: "8px",
});

export const panelPreview = style({
  display: "grid",
  gap: "8px",
});

export const workspaceChromeSample = style({
  display: "grid",
  gap: "10px",
});

export const workspaceChromeRow = style({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  minWidth: 0,
});

export const consumerStack = style({
  display: "grid",
  gap: "12px",
});

export const consumerSample = style({
  display: "grid",
  gap: "8px",
});
