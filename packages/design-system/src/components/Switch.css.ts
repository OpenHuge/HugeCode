import { style } from "@vanilla-extract/css";
import { focusRingValues } from "../semanticPrimitives";
import { typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars } from "../themeSemantics";
import { borderRadius, spacing, transitionDuration } from "../tokens";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: componentThemeVars.switch.gap,
  minWidth: 0,
  cursor: "pointer",
});

export const disabled = style({
  cursor: "not-allowed",
  opacity: 0.68,
});

export const copy = style({
  minWidth: 0,
  display: "grid",
  gap: spacing[1],
});

export const labelText = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-switch-label", componentThemeVars.switch.label),
    fontWeight: 600,
  },
]);

export const control = style({
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  width: dsVar("--ds-switch-track-width", componentThemeVars.switch.trackWidth),
  height: dsVar("--ds-switch-track-height", componentThemeVars.switch.trackHeight),
  borderRadius: borderRadius.full,
  overflow: "hidden",
});

export const input = style({
  position: "absolute",
  inset: 0,
  margin: 0,
  opacity: 0,
  cursor: "inherit",
  selectors: {
    "&:focus-visible": {
      outline: focusRingValues.input,
      outlineOffset: "2px",
    },
  },
});

export const track = style({
  position: "relative",
  display: "inline-flex",
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  borderRadius: borderRadius.full,
  background: dsVar("--ds-switch-track", componentThemeVars.switch.track),
  boxShadow: `inset 0 0 0 1px ${dsVar("--ds-switch-border", componentThemeVars.switch.border)}`,
  transition: [
    `background ${transitionDuration.fast} ease`,
    `box-shadow ${transitionDuration.fast} ease`,
  ].join(", "),
  selectors: {
    [`${root}[data-checked="true"] &`]: {
      background: dsVar("--ds-switch-track-checked", componentThemeVars.switch.trackChecked),
      boxShadow: `inset 0 0 0 1px ${dsVar("--ds-switch-border-checked", componentThemeVars.switch.borderChecked)}`,
    },
    [`${root}[data-invalid="true"] &`]: {
      boxShadow: `inset 0 0 0 1px ${dsVar("--ds-switch-border-invalid", componentThemeVars.switch.borderInvalid)}`,
    },
  },
});

export const thumb = style({
  position: "absolute",
  top: spacing.px,
  left: spacing.px,
  width: `calc(${dsVar("--ds-switch-track-height", componentThemeVars.switch.trackHeight)} - 2px)`,
  height: `calc(${dsVar("--ds-switch-track-height", componentThemeVars.switch.trackHeight)} - 2px)`,
  borderRadius: borderRadius.full,
  background: dsVar("--ds-switch-thumb", componentThemeVars.switch.thumb),
  border: `1px solid ${dsVar("--ds-switch-thumb-border", "transparent")}`,
  boxShadow: `0 1px 2px ${dsVar("--ds-switch-thumb-shadow", componentThemeVars.switch.thumbShadow)}`,
  transform: "translateX(0)",
  transition: [
    `transform ${transitionDuration.fast} ease`,
    `background ${transitionDuration.fast} ease`,
    `border-color ${transitionDuration.fast} ease`,
  ].join(", "),
  selectors: {
    [`${root}[data-checked="true"] &`]: {
      transform: `translateX(calc(${dsVar("--ds-switch-track-width", componentThemeVars.switch.trackWidth)} - ${dsVar("--ds-switch-track-height", componentThemeVars.switch.trackHeight)}))`,
      background: dsVar("--ds-switch-thumb-checked", componentThemeVars.switch.thumbChecked),
      borderColor: dsVar("--ds-switch-thumb-border-checked", "transparent"),
    },
  },
});
