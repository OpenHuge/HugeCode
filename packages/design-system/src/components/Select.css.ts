import { globalKeyframes } from "@vanilla-extract/css";
import {
  focusRingValues,
  motionValues,
  overlayValues,
  statusChipValues,
  typographyValues,
} from "../semanticPrimitives";
import { componentThemeVars } from "../themeSemantics";
import { applyGlobalStyle } from "../styleUtils";

const selectMenuDefaults = {
  maxWidth: "min(420px, 94vw)",
  padding: componentThemeVars.select.menuPadding,
  radius: componentThemeVars.select.menuRadius,
  border: overlayValues.menuBorder,
  bg: overlayValues.menuSurface,
  gloss: "none",
  shadow:
    "0 12px 24px -18px color-mix(in srgb, var(--ds-shadow-color, black) 22%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color, black) 10%, transparent)",
  backdrop: "blur(10px) saturate(1.04)",
} as const;

const selectOptionDefaults = {
  minHeight: componentThemeVars.select.optionMinHeight,
  padding: statusChipValues.optionPadding,
  radius: componentThemeVars.select.optionRadius,
  hoverBg: "color-mix(in srgb, var(--ds-surface-hover) 88%, transparent)",
  hoverBorder: "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
  hoverShadow: "none",
  selectedBg: "color-mix(in srgb, var(--ds-surface-active) 56%, var(--ds-surface-item))",
  selectedBorder: "color-mix(in srgb, var(--ds-border-accent-soft) 74%, transparent)",
  selectedShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
  labelWhiteSpace: "nowrap",
  labelOverflow: "hidden",
  labelTextOverflow: "ellipsis",
  labelWordBreak: "normal",
} as const;

globalKeyframes("ds-select-menu-enter-down", {
  from: {
    opacity: "0",
    transform: "translateY(-3px) scale(0.985)",
  },
  to: {
    opacity: "1",
    transform: "translateY(0) scale(1)",
  },
});

globalKeyframes("ds-select-menu-enter-up", {
  from: {
    opacity: "0",
    transform: "translateY(3px) scale(0.985)",
  },
  to: {
    opacity: "1",
    transform: "translateY(0) scale(1)",
  },
});

applyGlobalStyle(".ds-select", {
  vars: {
    "--ds-select-radius": componentThemeVars.select.radius,
    "--ds-select-min-height": componentThemeVars.select.triggerHeight,
    "--ds-select-padding-x": componentThemeVars.select.paddingX,
    "--ds-select-trigger-gap": componentThemeVars.select.triggerGap,
    "--ds-select-trigger-width": "100%",
    "--ds-select-caret-size": componentThemeVars.select.caretSize,
    "--ds-select-trigger-leading-gap": "8px",
    "--ds-select-option-leading-gap": "8px",
    "--ds-select-trigger-border":
      "1px solid color-mix(in srgb, var(--ds-border-subtle, rgba(124, 134, 154, 0.44)) 86%, transparent)",
    "--ds-select-trigger-bg":
      "color-mix(in srgb, var(--ds-surface-control, rgba(28, 32, 40, 0.72)) 68%, color-mix(in srgb, var(--ds-surface, rgba(18, 20, 26, 0.9)) 32%, transparent))",
    "--ds-select-trigger-gloss":
      "linear-gradient(180deg, color-mix(in srgb, white 16%, transparent), color-mix(in srgb, white 4%, transparent) 38%, transparent 100%)",
    "--ds-select-trigger-color": "var(--ds-text-muted)",
    "--ds-select-trigger-shadow":
      "0 14px 28px -22px color-mix(in srgb, var(--ds-shadow-color, rgba(0, 0, 0, 0.82)) 42%, transparent), inset 0 1px 0 color-mix(in srgb, white 18%, transparent)",
    "--ds-select-trigger-backdrop": "blur(16px) saturate(1.14)",
    "--ds-select-trigger-hover-border":
      "color-mix(in srgb, var(--ds-border-strong, rgba(158, 172, 196, 0.62)) 70%, transparent)",
    "--ds-select-trigger-hover-bg":
      "color-mix(in srgb, var(--ds-surface-control-hover, rgba(34, 38, 47, 0.8)) 74%, color-mix(in srgb, var(--ds-surface, rgba(18, 20, 26, 0.9)) 26%, transparent))",
    "--ds-select-trigger-hover-color": "var(--ds-text-stronger)",
    "--ds-select-trigger-hover-shadow":
      "0 18px 32px -22px color-mix(in srgb, var(--ds-shadow-color, rgba(0, 0, 0, 0.84)) 46%, transparent), inset 0 1px 0 color-mix(in srgb, white 22%, transparent)",
    "--ds-select-trigger-open-border":
      "color-mix(in srgb, var(--ds-border-accent-soft, rgba(132, 160, 220, 0.64)) 72%, transparent)",
    "--ds-select-trigger-open-bg":
      "color-mix(in srgb, var(--ds-surface-card, rgba(34, 38, 46, 0.84)) 78%, color-mix(in srgb, var(--ds-surface-card-base, rgba(20, 22, 28, 0.92)) 22%, transparent))",
    "--ds-select-trigger-open-color": "var(--ds-text-strong)",
    "--ds-select-trigger-open-shadow":
      "0 18px 34px -22px color-mix(in srgb, var(--ds-shadow-color, rgba(0, 0, 0, 0.86)) 48%, transparent), inset 0 1px 0 color-mix(in srgb, white 22%, transparent)",
    "--ds-select-menu-max-width": selectMenuDefaults.maxWidth,
    "--ds-select-menu-padding": selectMenuDefaults.padding,
    "--ds-select-menu-radius": selectMenuDefaults.radius,
    "--ds-select-menu-border": selectMenuDefaults.border,
    "--ds-select-menu-bg": selectMenuDefaults.bg,
    "--ds-select-menu-gloss": selectMenuDefaults.gloss,
    "--ds-select-menu-shadow": selectMenuDefaults.shadow,
    "--ds-select-menu-backdrop": selectMenuDefaults.backdrop,
    "--ds-select-option-min-height": selectOptionDefaults.minHeight,
    "--ds-select-option-padding": selectOptionDefaults.padding,
    "--ds-select-option-radius": selectOptionDefaults.radius,
    "--ds-select-option-hover-bg": selectOptionDefaults.hoverBg,
    "--ds-select-option-hover-border": selectOptionDefaults.hoverBorder,
    "--ds-select-option-hover-shadow": selectOptionDefaults.hoverShadow,
    "--ds-select-option-selected-bg": selectOptionDefaults.selectedBg,
    "--ds-select-option-selected-border": selectOptionDefaults.selectedBorder,
    "--ds-select-option-selected-shadow": selectOptionDefaults.selectedShadow,
    "--ds-select-option-label-white-space": selectOptionDefaults.labelWhiteSpace,
    "--ds-select-option-label-overflow": selectOptionDefaults.labelOverflow,
    "--ds-select-option-label-text-overflow": selectOptionDefaults.labelTextOverflow,
    "--ds-select-option-label-word-break": selectOptionDefaults.labelWordBreak,
  },
  position: "relative",
  display: "inline-flex",
  minWidth: "0",
  width: "100%",
});

applyGlobalStyle(".ds-select[data-trigger-density='compact']", {
  vars: {
    "--ds-select-radius": componentThemeVars.select.compactRadius,
    "--ds-select-min-height": componentThemeVars.select.compactTriggerHeight,
    "--ds-select-padding-x": componentThemeVars.select.compactPaddingX,
    "--ds-select-trigger-gap": componentThemeVars.select.compactTriggerGap,
    "--ds-select-trigger-width": "auto",
    "--ds-select-caret-size": componentThemeVars.select.compactCaretSize,
  },
  width: "auto",
  maxWidth: "100%",
});

applyGlobalStyle(".ds-select-trigger", {
  width: "var(--ds-select-trigger-width)",
  border: "var(--ds-select-trigger-border)",
  background: "var(--ds-select-trigger-bg)",
  backgroundImage: "var(--ds-select-trigger-gloss)",
  borderRadius: "var(--ds-select-radius)",
  color: "var(--ds-select-trigger-color)",
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  fontWeight: "560",
  letterSpacing: "0.01em",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ds-select-trigger-gap)",
  minWidth: "0",
  minHeight: "var(--ds-select-min-height)",
  padding: "5px var(--ds-select-padding-x)",
  overflow: "hidden",
  cursor: "pointer",
  boxShadow: "var(--ds-select-trigger-shadow)",
  backdropFilter: "var(--ds-select-trigger-backdrop)",
  WebkitBackdropFilter: "var(--ds-select-trigger-backdrop)",
  transition: motionValues.interactive,
});

applyGlobalStyle(".ds-select-trigger:disabled", {
  opacity: "var(--ds-state-disabled-opacity, 0.58)",
  color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
  borderColor: "var(--ds-state-disabled-border, var(--ds-border-subtle))",
  background: "var(--ds-state-disabled-bg, var(--ds-surface-control-disabled))",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 14%, transparent)",
  cursor: "not-allowed",
});

applyGlobalStyle(".ds-select-trigger:focus-visible", {
  outline: focusRingValues.input,
  outlineOffset: "1px",
  color: "var(--ds-text-strong)",
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 78%, var(--ds-surface-control))",
  boxShadow:
    "0 0 0 1px color-mix(in srgb, var(--ds-border-accent-soft) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 20%, transparent)",
});

applyGlobalStyle(".ds-select-trigger:hover:not(:disabled)", {
  borderColor: "var(--ds-select-trigger-hover-border)",
  background: "var(--ds-select-trigger-hover-bg)",
  color: "var(--ds-select-trigger-hover-color)",
  boxShadow: "var(--ds-select-trigger-hover-shadow)",
});

applyGlobalStyle(".ds-select-trigger.is-open", {
  borderColor: "var(--ds-select-trigger-open-border)",
  background: "var(--ds-select-trigger-open-bg)",
  color: "var(--ds-select-trigger-open-color)",
  boxShadow: "var(--ds-select-trigger-open-shadow)",
});

applyGlobalStyle('.ds-select-trigger[aria-invalid="true"]', {
  borderColor: "color-mix(in srgb, var(--color-destructive) 76%, transparent)",
  boxShadow:
    "0 0 0 1px color-mix(in srgb, var(--color-destructive) 46%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-destructive) 14%, transparent)",
});

applyGlobalStyle(".ds-select-trigger-label", {
  minWidth: "0",
  flex: "1",
  textAlign: "left",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

applyGlobalStyle(".ds-select-trigger-leading", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  marginRight: "var(--ds-select-trigger-leading-gap)",
  color: "currentColor",
});

applyGlobalStyle(".ds-select-trigger-caret", {
  width: "var(--ds-select-caret-size)",
  height: "var(--ds-select-caret-size)",
  marginLeft: "auto",
  flexShrink: "0",
  opacity: "0.78",
  transition:
    "transform var(--duration-fast) var(--ease-smooth), opacity var(--duration-fast) var(--ease-smooth)",
});

applyGlobalStyle(".ds-select[data-trigger-density='compact'] .ds-select-trigger", {
  width: "auto",
  maxWidth: "100%",
  paddingTop: "4px",
  paddingBottom: "4px",
});

applyGlobalStyle(".ds-select-trigger.is-open .ds-select-trigger-caret", {
  opacity: "1",
  transform: "rotate(180deg)",
});

applyGlobalStyle(".ds-select-menu", {
  position: "fixed",
  top: "0",
  left: "0",
  zIndex: "30",
  transformOrigin: "top left",
  minWidth: "120px",
  maxWidth: `var(--ds-select-menu-max-width, ${selectMenuDefaults.maxWidth})`,
  maxHeight: componentThemeVars.select.menuMaxHeight,
  overflow: "auto",
  padding: `var(--ds-select-menu-padding, ${selectMenuDefaults.padding})`,
  borderRadius: `var(--ds-select-menu-radius, ${selectMenuDefaults.radius})`,
  border: `var(--ds-select-menu-border, ${selectMenuDefaults.border})`,
  background: `var(--ds-select-menu-bg, ${selectMenuDefaults.bg})`,
  backgroundImage: `var(--ds-select-menu-gloss, ${selectMenuDefaults.gloss})`,
  boxShadow: `var(--ds-select-menu-shadow, ${selectMenuDefaults.shadow})`,
  backdropFilter: `var(--ds-select-menu-backdrop, ${selectMenuDefaults.backdrop})`,
  WebkitBackdropFilter: `var(--ds-select-menu-backdrop, ${selectMenuDefaults.backdrop})`,
  scrollbarWidth: "thin",
  animation:
    "ds-select-menu-enter-down var(--ds-motion-fast, 180ms) var(--ds-motion-ease-standard, cubic-bezier(0.2, 0, 0, 1))",
});

applyGlobalStyle(".ds-select-menu.is-up", {
  transformOrigin: "bottom left",
  animation:
    "ds-select-menu-enter-up var(--ds-motion-fast, 180ms) var(--ds-motion-ease-standard, cubic-bezier(0.2, 0, 0, 1))",
});

applyGlobalStyle('.ds-select-menu[data-placement="down"]', {
  transformOrigin: "top left",
});

applyGlobalStyle(".ds-select-menu::-webkit-scrollbar", {
  width: "8px",
  height: "8px",
});

applyGlobalStyle(".ds-select-menu::-webkit-scrollbar-track", {
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-surface-item) 86%, transparent)",
});

applyGlobalStyle(".ds-select-menu::-webkit-scrollbar-thumb", {
  borderRadius: "999px",
  border: "2px solid transparent",
  backgroundClip: "padding-box",
  backgroundColor:
    "color-mix(in srgb, var(--ds-border-stronger) 72%, var(--ds-surface-control-hover))",
});

applyGlobalStyle(".ds-select-menu::-webkit-scrollbar-thumb:hover", {
  backgroundColor:
    "color-mix(in srgb, var(--ds-border-accent-soft) 52%, var(--ds-surface-control-hover))",
});

applyGlobalStyle(".ds-select-option", {
  width: "100%",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-text-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: componentThemeVars.select.optionGap,
  minHeight: `var(--ds-select-option-min-height, ${selectOptionDefaults.minHeight})`,
  padding: `var(--ds-select-option-padding, ${selectOptionDefaults.padding})`,
  borderRadius: `var(--ds-select-option-radius, ${selectOptionDefaults.radius})`,
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  fontWeight: "560",
  textAlign: "left",
  cursor: "pointer",
  transition: motionValues.interactive,
});

applyGlobalStyle(
  ".ds-select-menu, .ds-select-option, .ds-select-trigger, .ds-select-trigger-caret",
  {
    "@media": {
      "(prefers-reduced-motion: reduce)": {
        animation: "none",
        transition: "none",
      },
    },
  }
);

applyGlobalStyle(".ds-select-option:disabled", {
  opacity: "var(--ds-state-disabled-opacity, 0.58)",
  color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
  borderColor: "transparent",
  background: "transparent",
  boxShadow: "none",
  cursor: "not-allowed",
});

applyGlobalStyle(
  ".ds-select-option:hover:not(:disabled), .ds-select-option:focus-visible, .ds-select-option.is-selected",
  {
    background: `var(--ds-select-option-hover-bg, ${selectOptionDefaults.hoverBg})`,
    borderColor: `var(--ds-select-option-hover-border, ${selectOptionDefaults.hoverBorder})`,
    color: "var(--ds-text-stronger)",
    transform: "none",
    boxShadow: `var(--ds-select-option-hover-shadow, ${selectOptionDefaults.hoverShadow})`,
  }
);

applyGlobalStyle(".ds-select-option:focus-visible", {
  outline: "none",
  boxShadow: "0 0 0 1px color-mix(in srgb, var(--ds-border-accent-soft) 40%, transparent)",
});

applyGlobalStyle(".ds-select-option.is-selected", {
  background: `var(--ds-select-option-selected-bg, ${selectOptionDefaults.selectedBg})`,
  borderColor: `var(--ds-select-option-selected-border, ${selectOptionDefaults.selectedBorder})`,
  color: "var(--ds-text-strong)",
  boxShadow: `var(--ds-select-option-selected-shadow, ${selectOptionDefaults.selectedShadow})`,
});

applyGlobalStyle(".ds-select-option-label", {
  minWidth: "0",
  flex: "1",
  overflow: `var(--ds-select-option-label-overflow, ${selectOptionDefaults.labelOverflow})`,
  textOverflow: `var(--ds-select-option-label-text-overflow, ${selectOptionDefaults.labelTextOverflow})`,
  whiteSpace: `var(--ds-select-option-label-white-space, ${selectOptionDefaults.labelWhiteSpace})`,
  wordBreak: `var(--ds-select-option-label-word-break, ${selectOptionDefaults.labelWordBreak})`,
});

applyGlobalStyle(".ds-select-option-body", {
  minWidth: "0",
  flex: "1",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--ds-select-option-leading-gap)",
});

applyGlobalStyle(".ds-select-option-leading", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  color: "currentColor",
});

applyGlobalStyle(".ds-select-option-check", {
  minWidth: "12px",
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
  opacity: "0",
  transform: "scale(0.82)",
  transition:
    "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
});

applyGlobalStyle(".ds-select-option.is-selected .ds-select-option-check", {
  opacity: "1",
  transform: "scale(1)",
});

applyGlobalStyle(".ds-select-empty", {
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-meta)",
  padding: "6px 8px",
});

applyGlobalStyle(".ds-select-menu", {
  "@media": {
    "(max-width: 640px)": {
      maxWidth: "min(320px, 94vw)",
      padding: "4px",
      borderRadius: "10px",
    },
  },
});

applyGlobalStyle(".ds-select-option", {
  "@media": {
    "(max-width: 640px)": {
      minHeight: "30px",
      padding: "5px 8px",
      fontSize: "var(--font-size-micro)",
    },
  },
});
