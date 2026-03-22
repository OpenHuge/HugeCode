import { style, styleVariants } from "@vanilla-extract/css";
import { componentSizes, spacing } from "../tokens";
import { focusRingStyles, typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars, semanticThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const field = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  minWidth: 0,
  border: `1px solid ${dsVar("--ds-input-border", componentThemeVars.input.border)}`,
  borderRadius: dsVar("--ds-input-radius", componentThemeVars.input.radius),
  background: dsVar("--ds-input-surface", componentThemeVars.input.background),
  boxShadow: "0 1px 2px color-mix(in srgb, var(--color-border) 18%, transparent)",
  transition:
    "border-color var(--duration-normal, 200ms) ease, background-color var(--duration-normal, 200ms) ease, box-shadow var(--duration-fast, 120ms) ease",
  selectors: {
    "&:hover:not(:focus-within)": {
      borderColor: dsVar("--ds-border-strong", semanticThemeVars.color.border.strong),
      background: `color-mix(in srgb, ${dsVar("--ds-input-surface", componentThemeVars.input.background)} 92%, ${semanticThemeVars.color.bg.hover} 8%)`,
    },
    "&:focus-within": {
      borderColor: dsVar("--ds-border-accent", semanticThemeVars.color.border.focus),
      boxShadow:
        "0 0 0 1px color-mix(in srgb, var(--color-ring) 42%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-ring) 18%, transparent)",
    },
  },
});

export const fieldInvalid = style({
  borderColor: dsVar("--ds-state-error-border", semanticThemeVars.color.state.danger),
  boxShadow:
    "0 0 0 1px color-mix(in srgb, var(--color-destructive) 46%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-destructive) 14%, transparent)",
});

export const fieldDisabled = style({
  opacity: 0.72,
  cursor: "not-allowed",
});

export const fieldReadonly = style({
  background: `color-mix(in srgb, ${dsVar("--ds-input-surface", componentThemeVars.input.background)} 88%, ${semanticThemeVars.color.bg.inset} 12%)`,
  borderColor: `color-mix(in srgb, ${dsVar("--ds-input-border", componentThemeVars.input.border)} 74%, transparent)`,
});

export const control = style([
  focusRingStyles.input,
  typographyStyles.ui,
  {
    flex: 1,
    minWidth: 0,
    background: "transparent",
    border: 0,
    color: dsVar("--ds-input-text", componentThemeVars.input.text),
    fontFamily: "inherit",
    lineHeight: "var(--line-height-145)",
    outline: "none",
    selectors: {
      "&::placeholder": {
        color: dsVar("--ds-input-placeholder", componentThemeVars.input.placeholder),
      },
      "&:disabled": {
        cursor: "not-allowed",
      },
      "&:read-only": {
        cursor: "default",
      },
    },
  },
]);

export const size = styleVariants({
  sm: {
    minHeight: componentSizes.input.sm.minHeight,
    paddingInline: "11px",
    fontSize: componentSizes.input.sm.fontSize,
  },
  md: {
    minHeight: "40px",
    paddingInline: "12px",
    fontSize: componentSizes.input.md.fontSize,
  },
  lg: {
    minHeight: "48px",
    paddingInline: "13px",
    fontSize: componentSizes.input.lg.fontSize,
  },
});

export const affix = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: dsVar("--ds-text-secondary", semanticThemeVars.color.text.secondary),
  flexShrink: 0,
});
