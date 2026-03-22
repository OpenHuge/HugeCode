import { style } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "inline-flex",
  alignItems: "flex-start",
  gap: dsVar("--ds-checkbox-gap", componentThemeVars.checkbox.gap),
  minWidth: 0,
  cursor: "pointer",
});

export const input = style({
  width: dsVar("--ds-checkbox-size", componentThemeVars.checkbox.size),
  height: dsVar("--ds-checkbox-size", componentThemeVars.checkbox.size),
  margin: 0,
  marginTop: dsVar("--ds-checkbox-top-offset", componentThemeVars.checkbox.topOffset),
  flexShrink: 0,
  accentColor: dsVar("--ds-checkbox-accent", componentThemeVars.checkbox.accent),
  selectors: {
    "&:focus-visible": {
      outline: `2px solid color-mix(in srgb, ${dsVar("--ds-checkbox-focus-ring", componentThemeVars.checkbox.focusRing)} 48%, transparent)`,
      outlineOffset: "2px",
    },
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.68,
    },
  },
});

export const inputInvalid = style({
  accentColor: dsVar("--ds-checkbox-error", componentThemeVars.checkbox.error),
});

export const copy = style({
  minWidth: 0,
  color: dsVar("--ds-checkbox-description", componentThemeVars.checkbox.description),
});

export const labelText = style([
  typographyStyles.fine,
  {
    display: "block",
    color: dsVar("--ds-checkbox-label", componentThemeVars.checkbox.label),
    fontWeight: 600,
  },
]);
