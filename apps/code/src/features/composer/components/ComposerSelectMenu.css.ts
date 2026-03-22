import { overlayValues, statusChipValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";

export const flatTriggerChromeVars = {
  "--ds-select-trigger-backdrop": "none",
  "--ds-select-trigger-gloss": "none",
} as const;

export const flatTriggerChrome = style({
  vars: flatTriggerChromeVars,
});

export const flatMenu = style({
  padding: "4px",
  display: "grid",
  gap: "4px",
  vars: {
    "--ds-select-menu-bg": overlayValues.menuSurface,
    "--ds-select-menu-border": overlayValues.menuBorder,
    "--ds-select-menu-gloss": "none",
    "--ds-select-menu-shadow": overlayValues.menuShadow,
    "--ds-select-menu-backdrop": overlayValues.menuBackdrop,
    "--ds-select-option-hover-bg":
      "color-mix(in srgb, var(--ds-surface-control-hover) 82%, var(--ds-surface-control))",
    "--ds-select-option-hover-border":
      "color-mix(in srgb, var(--ds-border-strong) 64%, transparent)",
    "--ds-select-option-hover-shadow": "none",
    "--ds-select-option-selected-bg":
      "color-mix(in srgb, var(--ds-surface-card-base) 90%, var(--ds-surface-active) 10%)",
    "--ds-select-option-selected-border":
      "color-mix(in srgb, var(--ds-border-accent-soft) 70%, transparent)",
    "--ds-select-option-selected-shadow": "none",
  },
});

export const compactOption = style({
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  minHeight: statusChipValues.minHeight,
  padding: statusChipValues.optionPadding,
  borderRadius: "8px",
});

export const multilineOptionLabel = style({
  vars: {
    "--ds-select-option-label-white-space": "normal",
    "--ds-select-option-label-overflow": "visible",
    "--ds-select-option-label-text-overflow": "clip",
    "--ds-select-option-label-word-break": "break-word",
  },
});
