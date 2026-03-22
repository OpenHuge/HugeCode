import { style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { focusRingStyles, typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const control = style([
  typographyStyles.label,
  focusRingStyles.input,
  {
    width: "100%",
    minWidth: 0,
    resize: "vertical",
    border: `1px solid ${dsVar("--ds-textarea-border", componentThemeVars.textarea.border)}`,
    borderRadius: dsVar("--ds-textarea-radius", componentThemeVars.textarea.radius),
    background: dsVar("--ds-textarea-surface", componentThemeVars.textarea.background),
    color: dsVar("--ds-textarea-text", componentThemeVars.textarea.text),
    fontFamily: "inherit",
    outline: "none",
    boxShadow: "0 1px 2px color-mix(in srgb, var(--color-border) 18%, transparent)",
    transition:
      "border-color var(--duration-normal, 200ms) ease, background-color var(--duration-normal, 200ms) ease, box-shadow var(--duration-fast, 120ms) ease",
    selectors: {
      "&::placeholder": {
        color: dsVar("--ds-textarea-placeholder", componentThemeVars.textarea.placeholder),
      },
      "&:focus-visible": {
        borderColor: dsVar("--ds-textarea-focus", componentThemeVars.textarea.focusRing),
        boxShadow:
          "0 0 0 1px color-mix(in srgb, var(--color-ring) 42%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-ring) 18%, transparent)",
      },
      "&:disabled": {
        cursor: "not-allowed",
        opacity: 0.72,
      },
    },
  },
]);

export const invalid = style({
  borderColor: dsVar("--ds-textarea-error", componentThemeVars.textarea.error),
  boxShadow:
    "0 0 0 1px color-mix(in srgb, var(--color-destructive) 46%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-destructive) 14%, transparent)",
});

export const size = styleVariants({
  sm: {
    minHeight: componentThemeVars.textarea.size.sm.minHeight,
    paddingInline: componentThemeVars.textarea.size.sm.paddingInline,
    paddingBlock: componentThemeVars.textarea.size.sm.paddingBlock,
    fontSize: componentThemeVars.textarea.size.sm.fontSize,
  },
  md: {
    minHeight: componentThemeVars.textarea.size.md.minHeight,
    paddingInline: componentThemeVars.textarea.size.md.paddingInline,
    paddingBlock: componentThemeVars.textarea.size.md.paddingBlock,
    fontSize: componentThemeVars.textarea.size.md.fontSize,
  },
  lg: {
    minHeight: componentThemeVars.textarea.size.lg.minHeight,
    paddingInline: componentThemeVars.textarea.size.lg.paddingInline,
    paddingBlock: componentThemeVars.textarea.size.lg.paddingBlock,
    fontSize: componentThemeVars.textarea.size.lg.fontSize,
  },
});
