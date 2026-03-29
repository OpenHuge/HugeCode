import { style } from "@vanilla-extract/css";
import { flatMenu } from "./ComposerSelectMenu.css";
export const input = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
  minWidth: 0,
});
export const inputArea = style({
  position: "relative",
  width: "100%",
  minWidth: 0,
  vars: {
    "--composer-input-surface": "var(--ds-surface-card-base)",
    "--composer-input-surface-hover":
      "color-mix(in srgb, var(--ds-surface-control) 74%, var(--ds-surface-card-base))",
    "--composer-input-border": "color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
    "--composer-input-border-hover":
      "color-mix(in srgb, var(--ds-border-default) 72%, transparent)",
    "--composer-input-border-focus":
      "color-mix(in srgb, var(--ds-focus-ring) 52%, var(--ds-border-default))",
    "--composer-input-shadow-rest":
      "0 10px 24px -24px color-mix(in srgb, var(--ds-shadow-color) 20%, transparent)",
    "--composer-input-shadow-focus":
      "0 12px 28px -22px color-mix(in srgb, var(--ds-shadow-color) 22%, transparent), 0 0 0 1px color-mix(in srgb, var(--ds-focus-ring) 22%, transparent), 0 0 12px -4px color-mix(in srgb, var(--ds-focus-ring) 10%, transparent)",
  },
  borderRadius: "20px",
  border: "1px solid var(--composer-input-border)",
  borderTop: "none",
  background: "var(--composer-input-surface)",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  overflow: "hidden",
  boxShadow: "var(--composer-input-shadow-rest)",
  transition:
    "border-color var(--duration-normal) var(--ease-smooth), box-shadow var(--duration-normal) var(--ease-smooth), background var(--duration-normal) var(--ease-smooth)",
  selectors: {
    "&::before": {
      content: "none",
    },
    "&:hover": {
      background: "var(--composer-input-surface-hover)",
      borderColor: "var(--composer-input-border-hover)",
    },
    "&:focus-within": {
      borderColor: "var(--composer-input-border-focus)",
      boxShadow: "var(--composer-input-shadow-focus)",
    },
  },
});
export const inputAreaLaunchpad = style({
  backgroundColor: "color-mix(in srgb, var(--ds-surface-composer) 80%, transparent)",
  backgroundImage: "none",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 18%, transparent)",
  boxShadow: "none",
  backdropFilter: "none",
  selectors: {
    "&:hover": {
      backgroundColor:
        "color-mix(in srgb, var(--ds-surface-control-hover) 8%, var(--ds-surface-composer) 92%)",
      backgroundImage: "none",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 18%, transparent)",
      boxShadow: "none",
    },
    "&:focus-within": {
      backgroundColor:
        "color-mix(in srgb, var(--ds-surface-control-hover) 8%, var(--ds-surface-composer) 92%)",
      backgroundImage: "none",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 18%, transparent)",
      boxShadow: "none",
    },
  },
});
export const inputAreaDragOver = style({
  outline: "1px dashed var(--ds-border-muted)",
  outlineOffset: "6px",
});
export const inputAreaSuggestionsOpen = style({
  overflow: "visible",
});
export const header = style({
  display: "flex",
  alignItems: "stretch",
  minWidth: 0,
  padding: "7px 14px 0",
});
export const editorBody = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "10px 18px 8px",
  minWidth: 0,
});
export const draftField = style({
  position: "relative",
  minWidth: 0,
});
export const draftOverlay = style({
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
  zIndex: 1,
});
export const inlineSkillMask = style({
  vars: {
    "--composer-inline-skill-top": "0px",
    "--composer-inline-skill-left": "0px",
    "--composer-inline-skill-width": "0px",
    "--composer-inline-skill-height": "24px",
  },
  position: "absolute",
  top: "var(--composer-inline-skill-top)",
  left: "var(--composer-inline-skill-left)",
  width: "var(--composer-inline-skill-width)",
  height: "var(--composer-inline-skill-height)",
  background: "var(--composer-input-surface)",
  pointerEvents: "none",
});
export const inlineSkillChip = style({
  vars: {
    "--composer-inline-skill-top": "0px",
    "--composer-inline-skill-left": "0px",
    "--composer-inline-skill-width": "0px",
    "--composer-inline-skill-height": "24px",
  },
  position: "absolute",
  top: "var(--composer-inline-skill-top)",
  left: "var(--composer-inline-skill-left)",
  width: "var(--composer-inline-skill-width)",
  height: "var(--composer-inline-skill-height)",
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  maxWidth: "100%",
  padding: "0 8px 0 6px",
  borderRadius: "7px",
  border: "1px solid color-mix(in srgb, var(--ds-border-accent-soft) 68%, transparent)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--ds-text-accent) 18%, var(--ds-surface-composer) 82%), color-mix(in srgb, var(--ds-brand-primary) 20%, var(--ds-surface-control) 80%))",
  color: "color-mix(in srgb, var(--ds-text-accent) 78%, var(--ds-text-strong) 22%)",
  boxSizing: "border-box",
  overflow: "hidden",
  pointerEvents: "auto",
  appearance: "none",
  outline: "none",
  cursor: "default",
  textAlign: "left",
  font: "inherit",
  whiteSpace: "nowrap",
});
export const inlineSkillIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  borderRadius: "5px",
  background: "color-mix(in srgb, var(--ds-text-accent) 18%, transparent)",
  color: "inherit",
  flexShrink: 0,
});
export const inlineSkillLabel = style({
  minWidth: 0,
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-fine)",
  fontWeight: "620",
  letterSpacing: "-0.01em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
});
export const topContent = style({
  display: "grid",
  gap: "8px",
  margin: "-12px -14px 2px",
});
export const inputRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minWidth: 0,
  gap: "8px",
  padding: "0 14px 6px",
});
export const inputRowCompact = style({
  gap: "6px",
  padding: "0 12px 6px",
});
export const bottomBarLeft = style({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flex: 1,
  minWidth: 0,
  flexWrap: "wrap",
});
export const bottomBarLeftCompact = style({
  gap: "8px",
});
export const metaSlot = style({
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
  paddingTop: "0",
});
export const leadingActions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  flexShrink: 0,
});
export const actionsGroup = style({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
});
export const actionsGroupCompact = style({
  gap: "4px",
});
export const bottomContent = style({
  minWidth: 0,
});
export const mobileActionsPopover = style([
  flatMenu,
  {
    vars: {
      "--ds-popover-item-hit-area": "32px",
      "--ds-popover-item-gap": "10px",
      "--ds-popover-item-padding-block": "3px",
      "--ds-popover-item-padding-inline": "10px",
    },
    padding: "4px",
    gap: "4px",
  },
]);
export const menuSwitchRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ds-popover-item-gap, 10px)",
  width: "100%",
  minHeight: "var(--ds-popover-item-hit-area, 32px)",
  paddingBlock: "var(--ds-popover-item-padding-block, 3px)",
  paddingInline: "var(--ds-popover-item-padding-inline, 10px)",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-popover-item-text, var(--ds-text-primary))",
  transition:
    "background-color var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover": {
      background:
        "color-mix(in srgb, var(--ds-surface-hover, var(--color-panel)) 82%, transparent)",
      borderColor:
        "color-mix(in srgb, var(--ds-popover-border, var(--color-border-default)) 76%, transparent)",
      color: "var(--ds-popover-item-text-active, var(--ds-text-primary))",
    },
  },
});
export const menuSwitchCopy = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--ds-popover-item-gap, 10px)",
  minWidth: 0,
  flex: 1,
});
export const menuSwitchIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  color: "currentColor",
  flexShrink: 0,
});
export const menuSwitchLabel = style({
  minWidth: 0,
  fontSize: "var(--font-size-fine)",
  fontWeight: 500,
  lineHeight: "var(--line-height-fine)",
  color: "inherit",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const menuSwitchControl = style({
  flexShrink: 0,
  vars: {
    "--ds-switch-track-width": "32px",
    "--ds-switch-track-height": "18px",
    "--ds-switch-track":
      "color-mix(in srgb, var(--ds-text-faint) 16%, var(--ds-surface-inset, var(--ds-surface-card-base)))",
    "--ds-switch-track-checked":
      "color-mix(in srgb, var(--color-primary) 82%, var(--ds-surface-hover))",
    "--ds-switch-border": "color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
    "--ds-switch-border-checked": "color-mix(in srgb, var(--color-primary) 42%, transparent)",
    "--ds-switch-thumb": "color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-surface) 4%)",
    "--ds-switch-thumb-checked": "var(--ds-color-white)",
    "--ds-switch-thumb-border": "color-mix(in srgb, var(--ds-border-default) 84%, transparent)",
    "--ds-switch-thumb-border-checked":
      "color-mix(in srgb, var(--color-primary) 18%, var(--ds-color-white) 82%)",
    "--ds-switch-thumb-shadow": "color-mix(in srgb, var(--ds-shadow-color) 30%, transparent)",
  },
  selectors: {
    "&:hover": {
      vars: {
        "--ds-switch-track":
          "color-mix(in srgb, var(--ds-text-faint) 22%, var(--ds-surface-hover))",
        "--ds-switch-track-checked":
          "color-mix(in srgb, var(--color-primary) 88%, var(--ds-surface-hover))",
      },
    },
  },
});
export const textarea = style({
  vars: {
    "--ds-textarea-surface": "transparent",
    "--ds-textarea-border": "transparent",
    "--ds-textarea-focus": "transparent",
    "--ds-textarea-placeholder": "var(--ds-text-muted)",
  },
  maxHeight: "188px",
  width: "100%",
  flex: 1,
  resize: "none",
  borderRadius: 0,
  border: "1px solid transparent",
  background: "transparent",
  backgroundImage: "none",
  color: "var(--ds-text-primary)",
  padding: 0,
  fontSize: "var(--font-size-content)",
  lineHeight: "var(--line-height-content)",
  letterSpacing: "normal",
  overflowY: "hidden",
  caretColor: "var(--color-primary)",
  fontFamily: "var(--ui-font-family)",
  boxShadow: "none",
  selectors: {
    "&::placeholder": {
      color: "var(--ds-text-muted)",
      fontFamily: "var(--ui-font-family)",
    },
    "&:hover": {
      background: "transparent",
      backgroundImage: "none",
      borderColor: "transparent",
      boxShadow: "none",
    },
    "&:focus, &:focus-visible": {
      outline: "none",
      borderColor: "transparent",
      background: "transparent",
      backgroundImage: "none",
      boxShadow: "none",
    },
  },
});
export const textareaLaunchpad = style({
  vars: {
    "--ds-textarea-surface": "transparent",
    "--ds-textarea-border": "transparent",
    "--ds-textarea-focus": "transparent",
  },
  backgroundColor: "transparent",
  backgroundImage: "none",
  border: "none",
  boxShadow: "none",
  selectors: {
    "&:hover": {
      backgroundColor: "transparent",
      backgroundImage: "none",
      borderColor: "transparent",
      boxShadow: "none",
    },
    "&:focus, &:focus-visible": {
      backgroundColor: "transparent",
      backgroundImage: "none",
      borderColor: "transparent",
      boxShadow: "none",
    },
  },
});

export const quickTools = style({
  marginTop: "4px",
  paddingTop: 0,
  borderTop: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "7px",
  flexWrap: "wrap",
  maxHeight: "120px",
  opacity: 0,
  pointerEvents: "none",
  transform: "translateY(4px)",
  overflow: "hidden",
  transition:
    "max-height var(--duration-normal) var(--ease-smooth),\n  opacity var(--duration-fast) var(--ease-smooth),\n  transform var(--duration-fast) var(--ease-smooth),\n  border-color var(--duration-fast) var(--ease-smooth),\n  margin-top var(--duration-fast) var(--ease-smooth),\n  padding-top var(--duration-fast) var(--ease-smooth)",
});

export const quickToolsCollapsed = style({
  maxHeight: 0,
  opacity: 0,
  marginTop: 0,
  paddingTop: 0,
  borderTopColor: "transparent",
  transform: "translateY(-2px)",
  pointerEvents: "none",
});

export const quickToolsVisible = style({
  pointerEvents: "auto",
  opacity: 1,
  transform: "translateY(0)",
  display: "inline-flex",
  flexShrink: 0,
});

export const quickActions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  flexWrap: "wrap",
});

export const quickAction = style({
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-composer) 94%, transparent)",
  color: "var(--ds-text-muted)",
  height: "28px",
  borderRadius: "var(--radius-full, 9999px)",
  padding: "0 10px",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-meta)",
  cursor: "pointer",
  transition:
    "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover:not(:disabled), &:focus-visible": {
      borderColor: "var(--ds-border-default)",
      color: "var(--ds-text-primary)",
      background: "var(--ds-surface-control-hover)",
      outline: "none",
    },
    '&[aria-pressed="true"]': {
      borderColor: "var(--ds-border-accent-soft)",
      color: "var(--ds-text-primary)",
      background: "var(--ds-surface-selected)",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
  },
});

export const commandHint = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-faint)",
  letterSpacing: "0.02em",
});

export const commandHintItem = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
});

export const commandHintKey = style({
  border: "1px solid var(--ds-border-subtle)",
  background: "var(--color-surface-1)",
  color: "var(--ds-text-muted)",
  borderRadius: "var(--radius-sm, 6px)",
  minWidth: "14px",
  padding: "1px 4px",
  lineHeight: "var(--line-height-label)",
  fontSize: "var(--font-size-tiny)",
  fontFamily: "var(--code-font-family)",
  textTransform: "none",
});

export const runtimeHints = style({
  marginTop: "5px",
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "5px",
});

export const runtimeHint = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  minHeight: "19px",
  borderRadius: "var(--radius-full, 9999px)",
  border: "1px solid var(--ds-border-subtle)",
  background: "var(--ds-surface-composer)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-micro)",
  padding: "0 8px",
  letterSpacing: "0.01em",
});

export const runtimeHintKey = style({
  border: "1px solid var(--ds-border-subtle)",
  background: "var(--color-surface-1)",
  color: "var(--ds-text-muted)",
  borderRadius: "var(--radius-sm, 6px)",
  minWidth: "14px",
  padding: "1px 4px",
  lineHeight: "var(--line-height-label)",
  fontSize: "var(--font-size-tiny)",
  fontFamily: "var(--code-font-family)",
});

export const runtimeHintLive = style({
  borderColor: "var(--ds-border-strong)",
  color: "var(--ds-text-primary)",
  background: "var(--ds-surface-active)",
});

export const runtimeHintDot = style({
  width: "6px",
  height: "6px",
  borderRadius: "var(--radius-full, 9999px)",
  background: "var(--color-status-success)",
  boxShadow: "0 0 0 2px var(--ds-surface-composer)",
  animation: "composer-runtime-pulse 1.4s ease-in-out infinite",
});
export const action = style({
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-text-muted)",
  padding: 0,
  borderRadius: "var(--radius-full, 9999px)",
  fontSize: "var(--font-size-title)",
  cursor: "pointer",
  width: "34px",
  height: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition:
    "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover:not(:disabled)": {
      backgroundColor: "var(--ds-surface-control-hover)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
      color: "var(--ds-text-primary)",
    },
    "&.composer-action--mobile-menu": {
      display: "inline-flex",
    },
    "&.composer-action--mic.is-active": {
      backgroundColor: "var(--color-status-error)",
      color: "white",
    },
    "&.composer-action--queue": {
      color: "var(--ds-text-primary)",
      background: "var(--ds-surface-active)",
    },
    "&.is-send": {
      background: "color-mix(in srgb, var(--color-primary) 92%, white 8%)",
      color: "var(--color-fg-inverted)",
      width: "36px",
      height: "36px",
      transform: "scale(1)",
      opacity: 1,
      boxShadow: "none",
    },
    "&.is-send:hover:not(:disabled)": {
      opacity: 0.92,
      transform: "scale(1.02)",
    },
    "&.is-send:active:not(:disabled)": {
      transform: "scale(0.95)",
    },
    "&.is-send:disabled": {
      opacity: 1,
      background:
        "color-mix(in srgb, var(--ds-surface-control-disabled) 72%, var(--ds-surface-composer) 28%)",
      color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 38%, transparent)",
      boxShadow: "none",
      cursor: "not-allowed",
    },
    "&.is-stop": {
      width: "36px",
      height: "36px",
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-surface-popover) 4%)",
      borderColor: "color-mix(in srgb, var(--ds-border-strong) 22%, transparent)",
      boxShadow:
        "0 10px 24px -16px color-mix(in srgb, var(--ds-shadow-color) 30%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 12%, transparent)",
      opacity: 1,
    },
    "&.is-stop:hover:not(:disabled)": {
      background:
        "color-mix(in srgb, var(--ds-color-white) 92%, var(--ds-surface-control-hover) 8%)",
      borderColor: "color-mix(in srgb, var(--ds-border-strong) 28%, transparent)",
      color: "var(--ds-text-strong)",
      transform: "scale(1.02)",
    },
    "&.is-stop:active:not(:disabled)": {
      transform: "scale(0.95)",
    },
    "&.is-stop:disabled": {
      opacity: 1,
      background: "color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-surface-popover) 4%)",
      color: "var(--ds-text-strong)",
      borderColor: "color-mix(in srgb, var(--ds-border-strong) 22%, transparent)",
      boxShadow:
        "0 10px 24px -16px color-mix(in srgb, var(--ds-shadow-color) 30%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 12%, transparent)",
    },
  },
});

export const stopSquare = style({
  display: "block",
  width: "10px",
  height: "10px",
  borderRadius: "3px",
  background: "currentColor",
  flexShrink: 0,
});
