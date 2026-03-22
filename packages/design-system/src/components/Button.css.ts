import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import {
  borderRadius,
  componentSizes,
  semanticColors,
  spacing,
  transitionDuration,
} from "../tokens";
import { focusRingStyles, typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

const spinnerRotation = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const baseSize = {
  sm: {
    minHeight: dsVar("--ds-button-height-sm", componentThemeVars.button.height.sm),
    paddingInline: componentSizes.button.sm.paddingInline,
    fontSize: dsVar("--ds-button-font-sm", componentThemeVars.button.fontSize.sm),
  },
  md: {
    minHeight: dsVar("--ds-button-height-md", componentThemeVars.button.height.md),
    paddingInline: componentSizes.button.md.paddingInline,
    fontSize: dsVar("--ds-button-font-md", componentThemeVars.button.fontSize.md),
  },
  lg: {
    minHeight: dsVar("--ds-button-height-lg", componentThemeVars.button.height.lg),
    paddingInline: componentSizes.button.lg.paddingInline,
    fontSize: dsVar("--ds-button-font-lg", componentThemeVars.button.fontSize.lg),
  },
  icon: {
    minHeight: componentThemeVars.button.height.sm,
    paddingInline: "0",
    fontSize: componentThemeVars.button.fontSize.sm,
  },
  iconSm: {
    minHeight: "23px",
    paddingInline: "8px",
    fontSize: componentThemeVars.button.fontSize.sm,
  },
} as const;

export const root = style([
  typographyStyles.label,
  focusRingStyles.button,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: dsVar("--ds-button-gap-md", componentThemeVars.button.gap.md),
    minWidth: 0,
    border: "1px solid transparent",
    borderRadius: dsVar("--ds-radius-button", componentThemeVars.button.radius),
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    lineHeight: "var(--line-height-100)",
    position: "relative",
    textDecoration: "none",
    transition: `background-color ${transitionDuration.normal} ease, color ${transitionDuration.normal} ease, border-color ${transitionDuration.normal} ease, box-shadow ${transitionDuration.fast} ease`,
    userSelect: "none",
    whiteSpace: "nowrap",
    selectors: {
      "&:disabled": {
        cursor: "not-allowed",
        opacity: dsVar("--ds-state-disabled-opacity", "0.56"),
      },
    },
  },
]);

export const fullWidth = style({
  width: "100%",
});

export const variant = styleVariants({
  primary: {
    background: dsVar("--ds-button-bg-primary", componentThemeVars.button.background.primary),
    color: dsVar("--ds-button-fg-primary", componentThemeVars.button.foreground.primary),
    borderColor: "color-mix(in srgb, var(--color-primary) 68%, black 32%)",
    boxShadow: "0 8px 18px -14px color-mix(in srgb, var(--color-primary) 42%, transparent)",
    selectors: {
      "&:hover:not(:disabled)": {
        background:
          "color-mix(in srgb, var(--ds-button-bg-primary, var(--color-primary)) 90%, white 10%)",
      },
    },
  },
  secondary: {
    background: dsVar("--ds-button-bg-secondary", componentThemeVars.button.background.secondary),
    color: dsVar("--ds-button-fg-secondary", componentThemeVars.button.foreground.secondary),
    borderColor: dsVar("--ds-button-border-secondary", componentThemeVars.button.border.secondary),
    boxShadow: "0 1px 2px color-mix(in srgb, var(--color-border) 18%, transparent)",
    selectors: {
      "&:hover:not(:disabled)": {
        background: dsVar("--ds-surface-control-hover", semanticColors.accent),
      },
    },
  },
  subtle: {
    background: dsVar("--ds-surface-control", componentThemeVars.button.background.secondary),
    color: dsVar("--ds-text-secondary", semanticColors.mutedForeground),
    borderColor: "color-mix(in srgb, var(--color-border) 52%, transparent)",
    selectors: {
      "&:hover:not(:disabled)": {
        color: semanticColors.foreground,
        background: dsVar("--ds-surface-control-hover", semanticColors.accent),
      },
    },
  },
  ghost: {
    background: componentThemeVars.button.background.ghost,
    color: dsVar("--ds-button-fg-ghost", componentThemeVars.button.foreground.ghost),
    selectors: {
      "&:hover:not(:disabled)": {
        color: semanticColors.foreground,
        background: dsVar(
          "--ds-surface-hover",
          "color-mix(in srgb, var(--color-foreground) 8%, transparent)"
        ),
      },
    },
  },
  dangerGhost: {
    background: componentThemeVars.button.background.ghost,
    color: dsVar("--ds-button-bg-danger", componentThemeVars.button.background.danger),
    selectors: {
      "&:hover:not(:disabled)": {
        background: "color-mix(in srgb, var(--color-destructive) 12%, transparent)",
      },
    },
  },
  danger: {
    background: dsVar("--ds-button-bg-danger", componentThemeVars.button.background.danger),
    color: dsVar("--ds-button-fg-danger", componentThemeVars.button.foreground.danger),
    borderColor: "color-mix(in srgb, var(--color-destructive) 62%, black 38%)",
    boxShadow: "0 10px 22px -16px color-mix(in srgb, var(--color-destructive) 42%, transparent)",
    selectors: {
      "&:hover:not(:disabled)": {
        background:
          "color-mix(in srgb, var(--ds-button-bg-danger, var(--color-destructive)) 88%, white 12%)",
      },
    },
  },
});

export const size = styleVariants(baseSize, (entry, sizeName) => ({
  minHeight: entry.minHeight,
  minWidth: sizeName === "icon" ? entry.minHeight : undefined,
  paddingInline: entry.paddingInline,
  fontSize: entry.fontSize,
}));

export const iconOnly = style({
  gap: "0",
  borderRadius: dsVar("--ds-button-icon-radius", componentThemeVars.button.iconRadius),
});

export const content = style({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[2],
});

export const icon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

export const spinner = style({
  width: "0.95rem",
  height: "0.95rem",
  borderRadius: borderRadius.full,
  border: "2px solid currentColor",
  borderTopColor: "transparent",
  animation: `${spinnerRotation} 0.9s linear infinite`,
});
