import { style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style([
  typographyStyles.fine,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: dsVar("--ds-badge-gap", componentThemeVars.badge.gap),
    width: "fit-content",
    border: `1px solid color-mix(in srgb, ${dsVar("--ds-badge-border", componentThemeVars.badge.border)} 68%, transparent)`,
    whiteSpace: "nowrap",
  },
]);

export const size = styleVariants({
  sm: {
    minHeight: dsVar("--ds-badge-height-sm", componentThemeVars.badge.height.sm),
    paddingInline: dsVar("--ds-badge-padding-inline-sm", componentThemeVars.badge.paddingInline.sm),
    fontSize: dsVar("--ds-badge-font-sm", componentThemeVars.badge.fontSize.sm),
  },
  md: {
    minHeight: dsVar("--ds-badge-height-md", componentThemeVars.badge.height.md),
    paddingInline: dsVar("--ds-badge-padding-inline-md", componentThemeVars.badge.paddingInline.md),
    fontSize: dsVar("--ds-badge-font-md", componentThemeVars.badge.fontSize.md),
  },
  lg: {
    minHeight: dsVar("--ds-badge-height-lg", componentThemeVars.badge.height.lg),
    paddingInline: dsVar("--ds-badge-padding-inline-lg", componentThemeVars.badge.paddingInline.lg),
    fontSize: dsVar("--ds-badge-font-lg", componentThemeVars.badge.fontSize.lg),
    lineHeight: "var(--line-height-120)",
  },
});

export const shape = styleVariants({
  pill: {
    borderRadius: dsVar("--ds-badge-radius-pill", componentThemeVars.badge.radius.pill),
    fontWeight: 500,
  },
  chip: {
    borderRadius: dsVar("--ds-badge-radius-chip", componentThemeVars.badge.radius.chip),
    fontWeight: 400,
  },
});

export const tone = styleVariants({
  neutral: {
    background: dsVar("--ds-badge-bg-neutral", componentThemeVars.badge.background.neutral),
    color: dsVar("--ds-badge-fg-neutral", componentThemeVars.badge.foreground.neutral),
    borderColor: `color-mix(in srgb, ${dsVar("--ds-badge-border", componentThemeVars.badge.border)} 34%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${dsVar("--ds-badge-border", componentThemeVars.badge.border)} 12%, transparent)`,
  },
  accent: {
    background: dsVar("--ds-badge-bg-accent", componentThemeVars.badge.background.accent),
    color: dsVar("--ds-badge-fg-accent", componentThemeVars.badge.foreground.accent),
    borderColor: "color-mix(in srgb, var(--color-primary) 16%, transparent)",
  },
  success: {
    background: dsVar("--ds-badge-bg-success", componentThemeVars.badge.background.success),
    color: dsVar("--ds-badge-fg-success", componentThemeVars.badge.foreground.success),
    borderColor: "color-mix(in srgb, var(--color-success) 16%, transparent)",
  },
  warning: {
    background: dsVar("--ds-badge-bg-warning", componentThemeVars.badge.background.warning),
    color: dsVar("--ds-badge-fg-warning", componentThemeVars.badge.foreground.warning),
    borderColor: "color-mix(in srgb, var(--color-warning) 16%, transparent)",
  },
  danger: {
    background: dsVar("--ds-badge-bg-danger", componentThemeVars.badge.background.danger),
    color: dsVar("--ds-badge-fg-danger", componentThemeVars.badge.foreground.danger),
    borderColor: "color-mix(in srgb, var(--color-destructive) 16%, transparent)",
  },
});
