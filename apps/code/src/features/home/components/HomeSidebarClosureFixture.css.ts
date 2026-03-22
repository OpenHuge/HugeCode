import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-canvas, var(--color-background)) 96%, transparent), var(--ds-surface-canvas, var(--color-background)))",
  color: "var(--color-foreground)",
});

export const shell = style({
  display: "grid",
  gap: "16px",
  maxWidth: "1480px",
  margin: "0 auto",
});

export const split = style({
  vars: {
    "--ds-split-panel-columns": "minmax(300px, 340px) minmax(0, 1fr)",
  },
  alignItems: "stretch",
});

export const pane = style({
  minWidth: 0,
  minHeight: "920px",
  borderRadius: "20px",
  overflow: "hidden",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-panel) 98%, transparent), color-mix(in srgb, var(--ds-surface-canvas) 96%, transparent))",
});

export const homePane = style({
  padding: "10px",
});
