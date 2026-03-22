// Keep this style module compact to satisfy the repo style budget.
import { style, styleVariants } from "@vanilla-extract/css";
const gapScale = {
  xs: "var(--spacing-2)",
  sm: "var(--spacing-3)",
  md: "var(--spacing-4)",
  lg: "var(--spacing-6)",
  xl: "var(--spacing-8)",
} as const;
const paddingScale = {
  sm: "var(--spacing-3)",
  md: "var(--spacing-4)",
  lg: "var(--spacing-6)",
} as const;
export const stackPattern = style({ display: "grid", minWidth: 0 });
export const stackGapPattern = styleVariants(gapScale, (gap) => ({ gap }));
export const inlinePattern = style({ display: "flex", alignItems: "center", minWidth: 0 });
export const inlineGapPattern = styleVariants(gapScale, (gap) => ({ gap }));
export const clusterPattern = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  minWidth: 0,
});
export const clusterGapPattern = styleVariants(gapScale, (gap) => ({
  columnGap: gap,
  rowGap: "calc(var(--spacing-2) + 1px)",
}));
export const surfacePattern = styleVariants({
  base: {
    background: "var(--color-surface-0)",
    border: "1px solid color-mix(in srgb, var(--color-border) 68%, transparent)",
    boxShadow: "none",
  },
  muted: {
    background: "var(--color-surface-1)",
    border: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)",
  },
  elevated: {
    background: "var(--color-surface-elevated)",
    border: "1px solid color-mix(in srgb, var(--color-border) 62%, transparent)",
    boxShadow: "var(--shadow-sm)",
  },
  overlay: {
    background: "color-mix(in srgb, var(--color-surface-elevated) 96%, transparent)",
    border: "1px solid color-mix(in srgb, var(--color-border) 56%, transparent)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(var(--glass-blur-sm))",
    WebkitBackdropFilter: "blur(var(--glass-blur-sm))",
  },
  interactive: {
    background: "var(--color-surface-1)",
    border: "1px solid color-mix(in srgb, var(--color-border) 56%, transparent)",
    boxShadow: "none",
    transition:
      "background-color var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
    selectors: {
      "&:hover": {
        background: "var(--color-surface-hover)",
        borderColor: "color-mix(in srgb, var(--color-border-strong) 44%, transparent)",
        boxShadow: "var(--shadow-xs)",
      },
    },
  },
  command: {
    background: "color-mix(in srgb, var(--color-surface-2) 88%, var(--color-surface-0))",
    border: "1px solid color-mix(in srgb, var(--color-border) 48%, transparent)",
    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--color-surface-elevated) 48%, transparent)",
  },
});
export const surfacePaddingPattern = styleVariants(paddingScale, (padding) => ({ padding }));
export const panelPattern = style({
  background: "var(--color-surface-elevated)",
  border: "1px solid color-mix(in srgb, var(--color-border) 58%, transparent)",
  borderRadius: "var(--radius-xl)",
  boxShadow: "var(--shadow-sm)",
});
export const toolbarPattern = style({
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-3)",
  minHeight: "44px",
  paddingInline: "var(--spacing-4)",
  paddingBlock: "var(--spacing-2)",
  background: "color-mix(in srgb, var(--color-surface-1) 88%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)",
  borderRadius: "var(--radius-xl)",
});
export const fieldPattern = style({ display: "grid", gap: "var(--spacing-2)", minWidth: 0 });
export const titlebarPattern = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--spacing-3)",
  minHeight: "var(--shell-header-control-size)",
  paddingInline: "var(--spacing-4)",
  paddingBlock: "var(--spacing-2)",
});
export const emptyStatePattern = style({
  display: "grid",
  justifyItems: "start",
  gap: "var(--spacing-3)",
  padding: "var(--spacing-6)",
  borderRadius: "var(--radius-2xl)",
  background: "var(--color-surface-0)",
  border: "1px solid color-mix(in srgb, var(--color-border) 52%, transparent)",
});
