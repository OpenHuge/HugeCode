import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-canvas, var(--color-background)) 92%, transparent), var(--ds-surface-canvas, var(--color-background)))",
  color: "var(--color-foreground)",
});
