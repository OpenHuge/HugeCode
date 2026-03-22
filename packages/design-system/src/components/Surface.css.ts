import { style, styleVariants } from "@vanilla-extract/css";
import { elevationValues, motionValues, overlayValues } from "../semanticPrimitives";
import { componentThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "grid",
  minWidth: 0,
  borderRadius: dsVar("--ds-surface-radius", componentThemeVars.surface.radius),
  border: `1px solid ${dsVar("--ds-surface-border", componentThemeVars.surface.border)}`,
  background: dsVar("--ds-surface-default", componentThemeVars.surface.surfaceDefault),
  color: "var(--color-foreground)",
  boxShadow: "none",
  transition: motionValues.interactive,
});

export const tone = styleVariants({
  default: {
    background: dsVar("--ds-surface-default", componentThemeVars.surface.surfaceDefault),
  },
  subtle: {
    background: dsVar("--ds-surface-muted", componentThemeVars.surface.surfaceSubtle),
  },
  elevated: {
    background: dsVar("--ds-surface-elevated", componentThemeVars.surface.surfaceElevated),
    boxShadow: dsVar("--ds-surface-shadow", componentThemeVars.surface.shadow),
  },
  translucent: {
    background: dsVar("--ds-surface-translucent", overlayValues.translucentSurface),
    borderColor: dsVar("--ds-border-glass", overlayValues.translucentBorderColor),
    boxShadow: dsVar("--ds-surface-shadow", overlayValues.translucentShadow),
    backdropFilter: dsVar("--ds-surface-backdrop", overlayValues.translucentBackdrop),
    WebkitBackdropFilter: dsVar("--ds-surface-backdrop", overlayValues.translucentBackdrop),
  },
  ghost: {
    background: "transparent",
    borderColor: "transparent",
    boxShadow: "none",
  },
});

export const padding = styleVariants({
  none: { padding: 0 },
  sm: { padding: componentThemeVars.surface.padding.sm },
  md: { padding: componentThemeVars.surface.padding.md },
  lg: { padding: componentThemeVars.surface.padding.lg },
});

export const depth = styleVariants({
  none: { boxShadow: elevationValues.none },
  card: { boxShadow: elevationValues.card },
  panel: { boxShadow: elevationValues.panel },
  floating: { boxShadow: elevationValues.floating },
  overlay: { boxShadow: elevationValues.overlay },
});

export const interactive = style({
  cursor: "pointer",
  selectors: {
    "&:hover": {
      boxShadow: dsVar("--ds-surface-shadow", componentThemeVars.surface.shadow),
      borderColor: "color-mix(in srgb, var(--color-border) 72%, transparent)",
    },
  },
});
