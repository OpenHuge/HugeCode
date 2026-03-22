import { overlayValues } from "@ku0/design-system";

export const workspaceSelectChromeVars = {
  "--ds-select-radius": "999px",
  "--ds-select-min-height": "28px",
  "--ds-select-padding-x": "10px",
  "--ds-select-trigger-border": "1px solid transparent",
  "--ds-select-trigger-bg": "color-mix(in srgb, var(--ds-surface-item) 88%, transparent)",
  "--ds-select-trigger-gloss": "none",
  "--ds-select-trigger-color": "var(--ds-text-muted)",
  "--ds-select-trigger-shadow": "none",
  "--ds-select-trigger-backdrop": "none",
  "--ds-select-trigger-hover-border":
    "color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
  "--ds-select-trigger-hover-bg":
    "color-mix(in srgb, var(--ds-surface-hover) 74%, var(--ds-surface-item))",
  "--ds-select-trigger-hover-color": "var(--ds-text-stronger)",
  "--ds-select-trigger-hover-shadow": "none",
  "--ds-select-trigger-open-border": "color-mix(in srgb, var(--ds-border-subtle) 40%, transparent)",
  "--ds-select-trigger-open-bg":
    "color-mix(in srgb, var(--ds-surface-hover) 78%, var(--ds-surface-item))",
  "--ds-select-trigger-open-color": "var(--ds-text-stronger)",
  "--ds-select-trigger-open-shadow": "none",
} as const;

export const workspaceSelectMenuChromeVars = {
  "--ds-select-menu-max-width": "min(420px, 92vw)",
  "--ds-select-menu-padding": "6px",
  "--ds-select-menu-radius": "16px",
  "--ds-select-menu-border": overlayValues.menuBorder,
  "--ds-select-menu-bg": overlayValues.menuSurface,
  "--ds-select-menu-gloss": "none",
  "--ds-select-menu-shadow": overlayValues.menuShadow,
  "--ds-select-menu-backdrop": overlayValues.menuBackdrop,
  "--ds-select-option-min-height": "38px",
  "--ds-select-option-padding": "0 12px",
  "--ds-select-option-radius": "12px",
  "--ds-select-option-hover-shadow": "none",
  "--ds-select-option-selected-shadow": "none",
} as const;
