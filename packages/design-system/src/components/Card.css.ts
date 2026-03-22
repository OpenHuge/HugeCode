import { style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { borderRadius, boxShadow, semanticColors, spacing } from "../tokens";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "grid",
  minWidth: 0,
  borderRadius: dsVar("--ds-radius-card", borderRadius.xl),
  border: `1px solid ${dsVar("--ds-card-border", componentThemeVars.card.border)}`,
  background: dsVar("--ds-card-surface", componentThemeVars.card.surface),
  color: semanticColors.foreground,
  boxShadow: "none",
  transition:
    "background-color var(--duration-normal, 200ms) ease, border-color var(--duration-normal, 200ms) ease, box-shadow var(--duration-normal, 200ms) ease",
});

export const tone = styleVariants({
  default: {
    background: dsVar("--ds-card-surface", componentThemeVars.card.surface),
  },
  subtle: {
    background: dsVar("--ds-card-surface-muted", componentThemeVars.card.surfaceMuted),
    boxShadow: "none",
  },
  translucent: {
    background: dsVar("--ds-card-surface-translucent", "var(--glass-bg)"),
    borderColor: dsVar("--ds-border-glass", "var(--glass-border)"),
    boxShadow: "var(--shadow-glass-panel, 0 8px 16px -14px rgba(0, 0, 0, 0.28))",
    backdropFilter: "var(--glass-backdrop, blur(12px))",
    WebkitBackdropFilter: "var(--glass-backdrop, blur(12px))",
  },
  ghost: {
    background: "transparent",
    borderColor: "transparent",
    boxShadow: "none",
  },
});

export const padding = styleVariants({
  none: { padding: 0 },
  sm: { padding: dsVar("--ds-card-padding-sm", componentThemeVars.card.padding.sm) },
  md: { padding: dsVar("--ds-card-padding-md", componentThemeVars.card.padding.md) },
  lg: { padding: dsVar("--ds-card-padding-lg", componentThemeVars.card.padding.lg) },
});

export const interactive = style({
  cursor: "pointer",
  selectors: {
    "&:hover": {
      borderColor: "color-mix(in srgb, var(--color-border) 72%, transparent)",
      boxShadow: dsVar("--ds-shadow-xs", boxShadow.xs),
    },
  },
});

export const selected = style({
  borderColor: dsVar("--ds-border-accent", semanticColors.ring),
  boxShadow:
    "0 0 0 1px color-mix(in srgb, var(--color-ring) 42%, transparent), 0 10px 24px -20px color-mix(in srgb, var(--color-ring) 30%, transparent)",
});

export const section = style({
  display: "grid",
  gap: spacing[2],
  minWidth: 0,
});

export const header = style([
  section,
  {
    paddingBottom: spacing[3],
    borderBottom: `1px solid color-mix(in srgb, ${dsVar("--ds-card-border", componentThemeVars.card.border)} 68%, transparent)`,
  },
]);

export const body = style([section]);

export const footer = style([
  section,
  {
    paddingTop: spacing[3],
    borderTop: `1px solid color-mix(in srgb, ${dsVar("--ds-card-border", componentThemeVars.card.border)} 68%, transparent)`,
  },
]);

export const title = style([
  typographyStyles.label,
  {
    color: semanticColors.foreground,
    fontWeight: 600,
  },
]);

export const description = style([
  typographyStyles.fine,
  {
    color: semanticColors.mutedForeground,
  },
]);
