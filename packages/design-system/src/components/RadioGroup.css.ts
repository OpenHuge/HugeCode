import { style, styleVariants } from "@vanilla-extract/css";
import { focusRingValues } from "../semanticPrimitives";
import { typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars } from "../themeSemantics";
import { borderRadius, spacing, transitionDuration } from "../tokens";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const group = style({
  display: "grid",
  gap: componentThemeVars.radioGroup.gap,
  minWidth: 0,
});

export const groupHorizontal = style({
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(0, 1fr)",
});

export const option = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: componentThemeVars.radioGroup.optionGap,
  minWidth: 0,
  cursor: "pointer",
});

export const optionDisabled = style({
  cursor: "not-allowed",
  opacity: 0.68,
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

export const control = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: componentThemeVars.radioGroup.optionSize,
  height: componentThemeVars.radioGroup.optionSize,
  borderRadius: borderRadius.full,
  background: dsVar("--ds-radio-control-bg", componentThemeVars.radioGroup.controlBackground),
  boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-control-border", componentThemeVars.radioGroup.border)}`,
  transition: [
    `background ${transitionDuration.fast} ease`,
    `box-shadow ${transitionDuration.fast} ease`,
  ].join(", "),
  selectors: {
    [`${option}[data-checked="true"] &`]: {
      boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-control-border-checked", componentThemeVars.radioGroup.borderChecked)}`,
    },
    [`${option}[data-invalid="true"] &`]: {
      boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-control-border-invalid", componentThemeVars.radioGroup.borderInvalid)}`,
    },
  },
});

export const dot = style({
  width: spacing[2],
  height: spacing[2],
  borderRadius: borderRadius.full,
  background: "transparent",
  transform: "scale(0.5)",
  transition: [
    `transform ${transitionDuration.fast} ease`,
    `background ${transitionDuration.fast} ease`,
  ].join(", "),
  selectors: {
    [`${option}[data-checked="true"] &`]: {
      background: dsVar("--ds-radio-dot", componentThemeVars.radioGroup.dot),
      transform: "scale(1)",
    },
  },
});

export const content = style({
  minWidth: 0,
  display: "grid",
  gap: spacing[1],
});

export const labelText = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-radio-label", componentThemeVars.radioGroup.label),
    fontWeight: 600,
  },
]);

export const description = style([
  typographyStyles.fine,
  {
    color: dsVar("--ds-radio-description", componentThemeVars.radioGroup.description),
  },
]);

export const leading = style([
  typographyStyles.fine,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: spacing[5],
    height: spacing[5],
    borderRadius: borderRadius.full,
    color: dsVar("--ds-radio-leading-fg", componentThemeVars.radioGroup.leadingForeground),
    background: dsVar("--ds-radio-leading-bg", componentThemeVars.radioGroup.leadingBackground),
    fontWeight: 600,
  },
]);

export const trailingIndicator = style([
  typographyStyles.fine,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: spacing[5],
    height: spacing[5],
    borderRadius: borderRadius.full,
    color: "transparent",
    background: "transparent",
    boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-indicator-border", componentThemeVars.radioGroup.border)}`,
    transition: [
      `background ${transitionDuration.fast} ease`,
      `color ${transitionDuration.fast} ease`,
      `box-shadow ${transitionDuration.fast} ease`,
    ].join(", "),
    selectors: {
      [`${option}[data-checked="true"] &`]: {
        color: dsVar("--ds-radio-indicator-fg", componentThemeVars.radioGroup.indicatorForeground),
        background: dsVar("--ds-radio-indicator-bg", componentThemeVars.radioGroup.borderChecked),
        boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-indicator-bg", componentThemeVars.radioGroup.borderChecked)}`,
      },
    },
  },
]);

export const variantStyles = styleVariants({
  default: {},
  card: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: componentThemeVars.radioGroup.cardGap,
    padding: componentThemeVars.radioGroup.cardGap,
    borderRadius: componentThemeVars.radioGroup.cardRadius,
    background: dsVar("--ds-radio-card-bg", componentThemeVars.radioGroup.controlBackground),
    boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-card-border", componentThemeVars.radioGroup.border)}`,
    selectors: {
      "&:hover": {
        background: dsVar(
          "--ds-radio-card-bg-hover",
          componentThemeVars.radioGroup.leadingBackground
        ),
      },
      '&[data-checked="true"]': {
        background: dsVar(
          "--ds-radio-card-bg-selected",
          componentThemeVars.radioGroup.leadingBackground
        ),
        boxShadow: `inset 0 0 0 1px ${dsVar("--ds-radio-card-border-selected", componentThemeVars.radioGroup.borderChecked)}`,
      },
    },
  },
});
