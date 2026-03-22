import { style, styleVariants } from "@vanilla-extract/css";
import { borderRadius, spacing } from "../tokens";
import { focusRingStyles, typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "grid",
  gap: spacing[3],
  minWidth: 0,
});

export const list = styleVariants({
  horizontal: {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    minWidth: 0,
    padding: spacing[1],
    borderRadius: dsVar("--ds-radius-pill", borderRadius.full),
    background: dsVar("--ds-surface-control", componentThemeVars.tabs.listSurface),
    border: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", componentThemeVars.tabs.listBorder)} 72%, transparent)`,
  },
  vertical: {
    display: "grid",
    gap: spacing[1],
    minWidth: 0,
  },
});

export const trigger = style([
  typographyStyles.fine,
  focusRingStyles.button,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    minWidth: 0,
    minHeight: componentThemeVars.tabs.triggerMinHeight,
    paddingInline: spacing[3],
    border: "1px solid transparent",
    borderRadius: dsVar("--ds-radius-pill", borderRadius.full),
    background: "transparent",
    color: dsVar("--ds-text-subtle", componentThemeVars.tabs.triggerText),
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    transition:
      "background-color var(--duration-fast, 120ms) ease, border-color var(--duration-fast, 120ms) ease, color var(--duration-fast, 120ms) ease",
    selectors: {
      "&:hover:not(:disabled)": {
        color: componentThemeVars.tabs.triggerTextHover,
        background: dsVar(
          "--ds-surface-control-hover",
          componentThemeVars.tabs.triggerSurfaceHover
        ),
      },
      "&:disabled": {
        opacity: 0.56,
        cursor: "not-allowed",
      },
    },
  },
]);

export const triggerSelected = style({
  color: componentThemeVars.tabs.triggerTextActive,
  background: dsVar("--ds-surface-elevated", componentThemeVars.tabs.triggerSelectedSurface),
  borderColor: `color-mix(in srgb, ${dsVar("--ds-border-subtle", componentThemeVars.tabs.triggerSelectedBorder)} 56%, transparent)`,
  boxShadow: componentThemeVars.tabs.triggerSelectedShadow,
});

export const content = style({
  minWidth: 0,
});
