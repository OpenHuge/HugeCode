import { style } from "@vanilla-extract/css";
import { focusRingStyles, motionStyles, typographyStyles } from "../semanticPrimitives.css";
import { componentThemeVars } from "../themeSemantics";
import { spacing } from "../tokens";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const surface = style([
  motionStyles.enter,
  {
    display: "grid",
    gap: spacing[1],
    minWidth: "12rem",
    maxWidth: "min(26rem, calc(100vw - 24px))",
    padding: spacing[2],
    borderRadius: dsVar("--ds-popover-radius", componentThemeVars.popover.radius),
    border: `1px solid ${dsVar("--ds-popover-border", componentThemeVars.popover.border)}`,
    background: dsVar(
      "--ds-popover-surface",
      "color-mix(in srgb, var(--ds-surface-popover, var(--ds-popover-bg, var(--color-panel-elevated))) 90%, color-mix(in srgb, var(--ds-surface-card-base, white) 10%, transparent))"
    ),
    backgroundImage: dsVar("--ds-popover-surface-gloss", "none"),
    boxShadow: dsVar(
      "--ds-popover-shadow",
      "0 12px 24px -18px color-mix(in srgb, var(--ds-shadow-color, black) 22%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color, black) 10%, transparent)"
    ),
    backdropFilter: dsVar("--ds-popover-backdrop", "blur(10px) saturate(1.04)"),
    WebkitBackdropFilter: dsVar("--ds-popover-backdrop", "blur(10px) saturate(1.04)"),
    opacity: 1,
    transform: "translateY(0) scale(1)",
    transformOrigin: "top center",
    transition: dsVar("--ds-popover-enter-transition", componentThemeVars.popover.enterTransition),
    selectors: {
      '&[data-overlay-state="open"]': {
        "@starting-style": {
          opacity: 0,
          transform: dsVar("--ds-popover-enter-offset", componentThemeVars.popover.enterOffset),
        },
      },
    },
  },
]);

export const menuItem = style([
  typographyStyles.label,
  focusRingStyles.button,
  {
    width: "100%",
    minHeight: dsVar("--ds-popover-item-hit-area", componentThemeVars.popover.itemHitArea),
    display: "inline-flex",
    alignItems: "center",
    gap: dsVar("--ds-popover-item-gap", spacing[3]),
    paddingBlock: dsVar("--ds-popover-item-padding-block", spacing[1]),
    paddingInline: dsVar("--ds-popover-item-padding-inline", spacing[3]),
    borderRadius: dsVar("--ds-popover-item-radius", "10px"),
    border: "1px solid transparent",
    background: "transparent",
    color: dsVar("--ds-popover-item-text", componentThemeVars.popover.itemText),
    fontSize: dsVar("--ds-popover-item-font-size", "var(--font-size-fine)"),
    fontWeight: dsVar("--ds-popover-item-font-weight", "500"),
    textAlign: "left",
    cursor: "pointer",
    transition:
      "background-color var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    selectors: {
      "&:not(:disabled):hover": {
        background: dsVar(
          "--ds-popover-item-hover",
          "color-mix(in srgb, var(--ds-surface-hover, var(--color-panel)) 82%, transparent)"
        ),
        borderColor: dsVar(
          "--ds-popover-item-hover-border",
          "color-mix(in srgb, var(--ds-popover-border, var(--color-border-default)) 76%, transparent)"
        ),
        color: dsVar("--ds-popover-item-text-active", componentThemeVars.popover.itemTextActive),
      },
      "&:disabled": {
        opacity: dsVar("--ds-state-disabled-opacity", "0.56"),
        cursor: "not-allowed",
      },
    },
  },
]);

export const menuItemActive = style({
  background: dsVar(
    "--ds-popover-item-active",
    "color-mix(in srgb, var(--ds-surface-active, var(--color-panel)) 72%, color-mix(in srgb, var(--ds-surface-item, white) 28%, transparent))"
  ),
  borderColor: dsVar(
    "--ds-popover-item-active-border",
    "color-mix(in srgb, var(--ds-border-accent-soft, var(--ds-popover-border, var(--color-border-default))) 74%, transparent)"
  ),
  color: dsVar("--ds-popover-item-text-active", componentThemeVars.popover.itemTextActive),
});

export const menuItemIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: dsVar("--ds-popover-item-icon-size", "16px"),
  height: dsVar("--ds-popover-item-icon-size", "16px"),
  flexShrink: 0,
  color: dsVar("--ds-popover-item-icon-color", "currentColor"),
});

export const menuItemLabel = style({
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
