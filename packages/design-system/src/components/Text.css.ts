import { style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { fontWeight } from "../tokens";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  minWidth: 0,
});

export const size = typographyStyles;

export const tone = styleVariants({
  default: { color: "inherit" },
  strong: {
    color: dsVar("--ds-text-strong", componentThemeVars.text.tone.strong),
  },
  muted: {
    color: dsVar("--ds-text-muted", componentThemeVars.text.tone.muted),
  },
  faint: {
    color: dsVar("--ds-text-faint", componentThemeVars.text.tone.faint),
  },
  accent: {
    color: dsVar("--ds-text-accent", componentThemeVars.text.tone.accent),
  },
  success: {
    color: dsVar("--ds-text-success", componentThemeVars.text.tone.success),
  },
  warning: {
    color: dsVar("--ds-text-warning", componentThemeVars.text.tone.warning),
  },
  danger: {
    color: dsVar("--ds-text-danger", componentThemeVars.text.tone.danger),
  },
});

export const weight = styleVariants({
  normal: { fontWeight: fontWeight.normal },
  medium: { fontWeight: fontWeight.medium },
  semibold: { fontWeight: fontWeight.semibold },
  bold: { fontWeight: fontWeight.bold },
});

export const transform = styleVariants({
  none: {},
  uppercase: { textTransform: "uppercase", letterSpacing: "0.04em" },
  capitalize: { textTransform: "capitalize" },
});

export const monospace = style({
  fontFamily: "var(--code-font-family)",
  letterSpacing: 0,
});

export const truncate = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
