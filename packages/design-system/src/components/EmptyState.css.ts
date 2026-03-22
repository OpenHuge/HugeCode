import { style } from "@vanilla-extract/css";
import { emptyStatePattern } from "../patterns.css";
import { typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars } from "../themeSemantics";
import { spacing } from "../tokens";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style([
  emptyStatePattern,
  {
    justifyItems: "start",
    gap: componentThemeVars.emptyState.gap,
  },
]);

export const iconWrap = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: componentThemeVars.emptyState.iconSize,
  height: componentThemeVars.emptyState.iconSize,
  borderRadius: "var(--radius-2xl)",
  background: dsVar("--ds-empty-state-icon-bg", componentThemeVars.emptyState.iconSurface),
  color: dsVar("--ds-empty-state-icon-fg", componentThemeVars.emptyState.iconForeground),
});

export const copy = style({
  display: "grid",
  gap: spacing[1.5],
  minWidth: 0,
});

export const eyebrow = style([
  typographyStyles.micro,
  {
    color: dsVar("--ds-empty-state-eyebrow", componentThemeVars.emptyState.eyebrow),
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
]);

export const title = style([
  typographyStyles.meta,
  {
    color: dsVar("--ds-empty-state-title", componentThemeVars.emptyState.title),
    fontWeight: 700,
  },
]);

export const description = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-empty-state-description", componentThemeVars.emptyState.description),
    lineHeight: "var(--line-height-150)",
    maxWidth: "44ch",
  },
]);

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: componentThemeVars.emptyState.actionsGap,
  flexWrap: "wrap",
});
