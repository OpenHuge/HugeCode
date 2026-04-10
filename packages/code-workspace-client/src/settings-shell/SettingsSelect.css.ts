import { overlayValues, statusChipValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";

export const settingsSelectRoot = style({
  vars: {
    "--ds-select-trigger-width": "100%",
  },
  minWidth: 0,
  width: "100%",
});

export const settingsSelectTrigger = style({
  vars: {
    "--ds-select-trigger-width": "100%",
    "--ds-select-trigger-border":
      "1px solid color-mix(in srgb, var(--ds-border-muted) 78%, transparent)",
    "--ds-select-trigger-bg": "var(--ds-surface-control)",
    "--ds-select-trigger-gloss": "none",
    "--ds-select-trigger-color": "var(--ds-text-strong)",
    "--ds-select-trigger-shadow": "none",
    "--ds-select-trigger-backdrop": "none",
    "--ds-select-trigger-hover-border":
      "color-mix(in srgb, var(--ds-border-strong) 64%, transparent)",
    "--ds-select-trigger-hover-bg":
      "color-mix(in srgb, var(--ds-surface-card-base) 84%, var(--ds-surface-control))",
    "--ds-select-trigger-hover-color": "var(--ds-text-stronger)",
    "--ds-select-trigger-hover-shadow": "none",
    "--ds-select-trigger-open-border": "var(--ds-border-accent)",
    "--ds-select-trigger-open-bg":
      "color-mix(in srgb, var(--ds-surface-card-base) 78%, var(--ds-surface-control))",
    "--ds-select-trigger-open-color": "var(--ds-text-stronger)",
    "--ds-select-trigger-open-shadow": "none",
  },
  width: "100%",
});

export const settingsSelectMenu = style({
  vars: {
    "--ds-select-menu-bg": overlayValues.menuSurface,
    "--ds-select-menu-border": overlayValues.menuBorder,
    "--ds-select-menu-gloss": "none",
    "--ds-select-menu-shadow": overlayValues.menuShadow,
    "--ds-select-menu-backdrop": overlayValues.menuBackdrop,
  },
});

export const settingsSelectOption = style({
  minHeight: statusChipValues.minHeight,
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  padding: statusChipValues.optionPadding,
  borderRadius: statusChipValues.radius,
});
