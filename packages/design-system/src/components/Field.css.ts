import { style } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "grid",
  gap: componentThemeVars.field.gap,
  minWidth: 0,
});

export const label = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-field-label", componentThemeVars.field.label),
    fontWeight: 600,
  },
]);

export const messages = style({
  display: "grid",
  gap: componentThemeVars.field.messageGap,
  minWidth: 0,
});

export const description = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-field-description", componentThemeVars.field.description),
  },
]);

export const errorMessage = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-field-error", componentThemeVars.field.error),
  },
]);
