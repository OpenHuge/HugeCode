// Keep this style module compact to satisfy the repo style budget.
import { style, styleVariants } from "@vanilla-extract/css";
import {
  compactOption,
  flatMenu,
  flatTriggerChromeVars,
  multilineOptionLabel,
} from "./ComposerSelectMenu.css";
export const planControl = style({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  minHeight: "var(--composer-meta-control-height)",
  gap: "6px",
  padding: "3px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "500",
  letterSpacing: "0.01em",
  cursor: "pointer",
  transition:
    "background var(--duration-normal) var(--ease-smooth), color var(--duration-normal) var(--ease-smooth), border-color var(--duration-normal) var(--ease-smooth)",
  selectors: {
    "&:hover": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 92%, transparent)",
      color: "var(--ds-text-strong)",
    },
    "&.is-active": {
      borderColor: "transparent",
      background: "color-mix(in srgb, var(--ds-surface-active) 92%, transparent)",
      color: "var(--color-primary)",
    },
  },
});
export const planControlIcon = style({ width: "14px", height: "14px", flexShrink: 0 });
export const modeGroup = style({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  minHeight: "var(--composer-meta-control-height)",
  gap: "2px",
  padding: "2px",
  borderRadius: "12px",
  border: "1px solid transparent",
  background: "transparent",
});
export const modeButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  flexShrink: 0,
  height: "var(--composer-meta-control-height)",
  minHeight: "var(--composer-meta-control-height)",
  padding: "0 12px",
  borderRadius: "9px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  fontWeight: 500,
  letterSpacing: "0.01em",
  lineHeight: "var(--line-height-display)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background var(--duration-normal) var(--ease-smooth), color var(--duration-normal) var(--ease-smooth), border-color var(--duration-normal) var(--ease-smooth), opacity var(--duration-normal) var(--ease-smooth)",
  selectors: {
    "&:hover:not(:disabled)": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)",
      color: "var(--ds-text-strong)",
    },
    "&:focus-visible": {
      outline: "none",
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)",
      color: "var(--ds-text-strong)",
    },
    '&[aria-pressed="true"], &.is-active': {
      color: "var(--ds-text-stronger)",
      borderColor: "transparent",
      boxShadow: "none",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "default",
    },
  },
  "@media": {
    "(max-width: 768px)": {
      height: "24px",
      minHeight: "24px",
      padding: "0 8px",
      gap: "4px",
      fontSize: "var(--font-size-micro)",
    },
  },
});
export const modeButtonIcon = style({
  width: "14px",
  height: "14px",
  flexShrink: 0,
  opacity: 0.78,
  "@media": {
    "(max-width: 768px)": {
      width: "12px",
      height: "12px",
    },
  },
});
export const modeButtonLabel = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
});
export const selectWrap = style({
  vars: flatTriggerChromeVars,
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 1,
  minHeight: "var(--composer-meta-control-height)",
  gap: "4px",
  padding: "1px 7px 1px 7px",
  borderRadius: "8px",
  background: "transparent",
  border: "1px solid transparent",
  boxShadow: "none",
  overflow: "hidden",
  width: "max-content",
  cursor: "pointer",
  color: "var(--ds-text-muted)",
  transition:
    "color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover, &:focus-within": {
      borderColor: "transparent",
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)",
      color: "var(--ds-text-strong)",
    },
    "&:has([data-ui-select-trigger][data-state='open'])": {
      borderColor: "transparent",
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)",
      boxShadow: "none",
      color: "var(--ds-text-stronger)",
    },
    "&:has([data-ui-select-trigger]:disabled)": {
      opacity: "var(--ds-state-disabled-opacity, 0.58)",
      cursor: "default",
    },
  },
  "@media": {
    "(max-width: 1400px)": { gap: "0" },
    "(max-width: 480px)": { gap: "0", flexShrink: 0 },
  },
});
export const selectWrapBlock = style({
  width: "100%",
  minHeight: "auto",
  padding: "0",
  borderRadius: "0",
});
export const selectWrapAccounts = style({
  alignItems: "center",
  maxWidth: "240px",
  flexShrink: 1,
  minWidth: "0",
});
export const selectCaption = style({ display: "none" });
export const icon = style({
  display: "inline-flex",
  width: "14px",
  height: "14px",
  color: "var(--ds-text-muted)",
  flexShrink: 0,
  pointerEvents: "none",
  opacity: 0.82,
  transition:
    "color var(--duration-fast) var(--ease-smooth), opacity var(--duration-fast) var(--ease-smooth),\n  transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    [`${selectWrap}:hover &, ${selectWrap}:focus-within &`]: {
      color: "var(--ds-text-strong)",
      opacity: 0.94,
    },
    [`${selectWrap}:has([data-ui-select-trigger][data-state='open']) &`]: {
      color: "var(--ds-text-stronger)",
      opacity: 1,
      transform: "translateY(0)",
    },
  },
  "@media": {
    "(max-width: 1400px)": { display: "none" },
    "(max-width: 480px)": { display: "none" },
  },
});
export const iconModel = style({ width: "14px", height: "14px" });
export const iconEffort = style({});
export const iconGraphic = style({ width: "14px", height: "14px" });
export const iconGraphicModel = style({ width: "14px", height: "14px" });
export const selectControl = style({
  minWidth: 0,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
});
export const selectControlBlock = style({
  width: "100%",
  flexShrink: 1,
});
export const selectControlWidth = styleVariants({
  provider: {
    width: "auto",
    maxWidth: "92px",
    "@media": { "(max-width: 820px)": { width: "auto", maxWidth: "88px" } },
  },
  model: { width: "auto", maxWidth: "105px" },
  accounts: { width: "auto", maxWidth: "128px" },
  effort: {
    width: "auto",
    maxWidth: "89px",
    "@media": { "(max-width: 820px)": { width: "auto", maxWidth: "85px" } },
  },
  approval: {
    width: "auto",
    maxWidth: "min(136px, 34vw)",
    "@media": { "(max-width: 820px)": { width: "auto", maxWidth: "min(132px, 38vw)" } },
  },
  autoDrive: {
    width: "auto",
    maxWidth: "72px",
    "@media": { "(max-width: 820px)": { width: "auto", maxWidth: "72px" } },
  },
  execution: {
    width: "auto",
    maxWidth: "min(185px, 44vw)",
    "@media": { "(max-width: 820px)": { width: "auto", maxWidth: "min(169px, 46vw)" } },
  },
});
export const selectTrigger = style({
  vars: flatTriggerChromeVars,
  width: "100%",
  justifyContent: "space-between",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  minHeight: "24px",
  padding: "0 2px 0 0",
  border: "none",
  background: "transparent",
  boxShadow: "none",
  borderRadius: "0",
  color: "inherit",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  letterSpacing: "0.01em",
  lineHeight: "var(--line-height-chrome)",
  transition:
    "color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:focus-visible": {
      borderColor: "transparent",
      background: "transparent",
      boxShadow: "none",
      outline: "none",
      color: "var(--ds-text-strong)",
    },
    "&:hover:not(:disabled)": {
      borderColor: "transparent",
      background: "transparent",
      boxShadow: "none",
      color: "var(--ds-text-strong)",
    },
    "&.is-open": {
      color: "var(--ds-text-stronger)",
      borderColor: "transparent",
      background: "transparent",
    },
  },
});
export const selectTriggerBlock = style({
  width: "100%",
  minHeight: "34px",
  paddingInline: "10px",
});
export const selectMenu = style([
  flatMenu,
  {
    minWidth: "140px",
  },
]);
export const selectMenuWidth = styleVariants({
  approval: [
    multilineOptionLabel,
    {
      minWidth: "156px",
      maxWidth: "min(220px, 90vw)",
    },
  ],
  execution: [
    multilineOptionLabel,
    {
      minWidth: "188px",
      maxWidth: "min(260px, 92vw)",
    },
  ],
});
export const selectMenuAccounts = style({ minWidth: "240px", maxWidth: "min(360px, 92vw)" });
export const selectOption = style([compactOption]);
export const overflowWrap = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
});
export const overflowButton = style({
  width: "30px",
  height: "30px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 76%, transparent)",
  color: "var(--ds-text-strong)",
  selectors: {
    "&:hover:not(:disabled)": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 90%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
    },
  },
});
export const overflowMenu = style({
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  zIndex: 30,
  width: "min(320px, calc(100vw - 32px))",
  display: "grid",
  gap: "10px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "var(--ds-surface-card-base)",
  boxShadow: "none",
});
export const overflowSection = style({
  display: "grid",
  gap: "6px",
});
export const overflowSectionLabel = style({
  fontSize: "var(--font-size-micro)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--ds-text-muted)",
});
export const overflowContext = style({
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 66%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
});
export const overflowContextLabel = style({
  fontSize: "var(--font-size-micro)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--ds-text-muted)",
});
export const overflowContextValue = style({
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-chrome)",
  color: "var(--ds-text-strong)",
});

export const autoDriveHeaderBadge = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 9px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 72%, transparent)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
  fontWeight: 600,
  letterSpacing: "0.02em",
});

export const autoDriveFields = style({
  display: "grid",
  gap: "10px",
});

export const autoDriveSection = style({
  display: "grid",
  gap: "10px",
  padding: "11px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 68%, transparent)",
});

export const autoDriveDropdownRow = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
  alignItems: "start",
  "@media": {
    "(max-width: 1080px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDrivePresetGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
  "@media": {
    "(max-width: 960px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDrivePresetButton = style({
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  textAlign: "left",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 78%, transparent)",
  color: "var(--ds-text-strong)",
  cursor: "pointer",
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover:not(:disabled)": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 88%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
    },
    '&[aria-pressed="true"], &.is-active': {
      background: "color-mix(in srgb, var(--ds-surface) 96%, transparent)",
      borderColor: "color-mix(in srgb, var(--color-primary) 30%, var(--ds-border-subtle))",
      color: "var(--ds-text-stronger)",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "default",
    },
  },
});

export const autoDrivePresetLabel = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
});

export const autoDrivePresetDetail = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-muted)",
});

export const autoDriveHeroCard = style({
  display: "grid",
  gap: "8px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 74%, transparent)",
});

export const autoDriveHeroEyebrow = style({
  fontSize: "var(--font-size-micro)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-primary)",
  fontWeight: 700,
});

export const autoDriveHeroTitle = style({
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-title-lg)",
  color: "var(--ds-text-stronger)",
  letterSpacing: "-0.01em",
});

export const autoDriveHeroCopy = style({
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-muted)",
});

export const autoDriveHeroMeta = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

export const autoDriveHeroMetaItem = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-surface) 88%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
});

export const autoDriveProgressCard = style({
  display: "grid",
  gap: "8px",
  padding: "11px 12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-command) 72%, transparent)",
});

export const autoDriveProgressHeader = style({
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  alignItems: "center",
});

export const autoDriveProgressValue = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 700,
  color: "var(--ds-text-stronger)",
});

export const autoDriveGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  "@media": {
    "(max-width: 1080px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "(max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDriveMissionGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  "@media": {
    "(max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDriveField = style({
  display: "grid",
  gap: "5px",
});

export const autoDriveFieldHint = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-chrome)",
  color: "var(--ds-text-muted)",
});

export const autoDriveLabel = style({
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

export const autoDriveTextarea = style({
  width: "100%",
  minHeight: "60px",
  resize: "vertical",
  borderRadius: "10px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface) 98%, transparent)",
  color: "var(--ds-text-strong)",
  padding: "9px 10px",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-content)",
  selectors: {
    "&:focus": {
      outline: "2px solid color-mix(in srgb, var(--color-primary) 24%, transparent)",
      outlineOffset: "2px",
      borderColor: "color-mix(in srgb, var(--color-primary) 52%, var(--ds-border-subtle))",
    },
  },
});

export const autoDriveInput = style({
  width: "100%",
  minHeight: "34px",
  borderRadius: "10px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface) 98%, transparent)",
  color: "var(--ds-text-strong)",
  padding: "6px 10px",
  fontSize: "var(--font-size-fine)",
  selectors: {
    "&:focus": {
      outline: "2px solid color-mix(in srgb, var(--color-primary) 24%, transparent)",
      outlineOffset: "2px",
      borderColor: "color-mix(in srgb, var(--color-primary) 52%, var(--ds-border-subtle))",
    },
  },
});

export const autoDriveRiskGroup = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
  "@media": {
    "(max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDriveCheck = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-command) 72%, transparent)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
});

export const autoDriveActions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  justifyContent: "flex-end",
  alignItems: "center",
  "@media": {
    "(max-width: 920px)": {
      justifyContent: "flex-start",
    },
  },
});

export const autoDriveAction = style({
  minHeight: "30px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface) 98%, transparent)",
  color: "var(--ds-text-strong)",
  cursor: "pointer",
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover:not(:disabled)": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 92%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
    },
    "&:disabled": {
      opacity: 0.45,
      cursor: "default",
    },
  },
});

export const autoDriveActionTone = styleVariants({
  primary: {
    background: "color-mix(in srgb, var(--color-primary) 14%, var(--ds-surface) 92%)",
    borderColor: "color-mix(in srgb, var(--color-primary) 32%, var(--ds-border-subtle))",
    color: "var(--ds-text-stronger)",
    selectors: {
      "&:hover:not(:disabled)": {
        background: "color-mix(in srgb, var(--color-primary) 18%, var(--ds-surface) 90%)",
        borderColor: "color-mix(in srgb, var(--color-primary) 42%, var(--ds-border-subtle))",
      },
    },
  },
  danger: {
    borderColor: "color-mix(in srgb, var(--color-status-error) 28%, var(--ds-border-subtle))",
    selectors: {
      "&:hover:not(:disabled)": {
        background: "color-mix(in srgb, var(--color-status-error) 10%, var(--ds-surface-hover))",
        borderColor: "color-mix(in srgb, var(--color-status-error) 42%, var(--ds-border-subtle))",
      },
    },
  },
});

export const autoDriveStatusChip = style({
  padding: "4px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-surface-hover) 74%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
});

export const autoDriveMetricLabel = style({
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

export const autoDriveMetricValue = style({
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-strong)",
  lineHeight: "var(--line-height-chrome)",
});

export const autoDriveAlert = style({
  display: "grid",
  gap: "6px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--color-status-warning) 38%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--color-status-warning) 8%, var(--ds-surface) 92%)",
});

export const autoDriveAlertLabel = style({
  fontSize: "var(--font-size-micro)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "color-mix(in srgb, var(--color-status-warning) 78%, var(--ds-text-muted))",
  fontWeight: 700,
});

export const autoDriveAlertValue = style({
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-stronger)",
});

export const autoDriveNotice = style({
  display: "grid",
  gap: "8px",
  padding: "11px 12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
});

export const autoDriveNoticeTone = styleVariants({
  critical: {
    background: "color-mix(in srgb, var(--color-status-error) 8%, var(--ds-surface) 94%)",
    borderColor: "color-mix(in srgb, var(--color-status-error) 34%, var(--ds-border-subtle))",
  },
  caution: {
    background: "color-mix(in srgb, var(--color-status-warning) 8%, var(--ds-surface) 94%)",
    borderColor: "color-mix(in srgb, var(--color-status-warning) 34%, var(--ds-border-subtle))",
  },
  success: {
    background: "color-mix(in srgb, var(--color-status-success) 8%, var(--ds-surface) 94%)",
    borderColor: "color-mix(in srgb, var(--color-status-success) 34%, var(--ds-border-subtle))",
  },
});

export const autoDriveNoticeTitle = style({
  fontSize: "var(--font-size-micro)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
  color: "var(--ds-text-strong)",
});

export const autoDriveNoticeBody = style({
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-stronger)",
});

export const autoDriveNoticeList = style({
  margin: 0,
  paddingLeft: "18px",
  display: "grid",
  gap: "6px",
  color: "var(--ds-text-stronger)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-content)",
});

export const autoDriveDeepGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  "@media": {
    "(max-width: 960px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDriveDeepCard = style({
  display: "grid",
  gap: "8px",
  padding: "11px 12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-command) 70%, transparent)",
});

export const autoDriveDeepCardTitle = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 700,
  color: "var(--ds-text-stronger)",
  letterSpacing: "-0.01em",
});

export const autoDriveDeepCardMeta = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-muted)",
});

export const autoDriveDisclosure = style({
  display: "grid",
  gap: "10px",
  padding: "11px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-command) 62%, transparent)",
});

export const autoDriveDisclosureSummary = style({
  listStyle: "none",
  cursor: "pointer",
  display: "grid",
  gap: "4px",
  minHeight: "38px",
  alignContent: "center",
  selectors: {
    "&::-webkit-details-marker": {
      display: "none",
    },
    "&::marker": {
      content: '""',
    },
  },
});

export const autoDriveDisclosureTitle = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 700,
  color: "var(--ds-text-stronger)",
});

export const autoDriveDisclosureMeta = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-chrome)",
  color: "var(--ds-text-muted)",
});

export const autoDriveDisclosureBody = style({
  display: "grid",
  gap: "12px",
});

export const autoDriveTimelineList = style({
  display: "grid",
  gap: "10px",
  margin: 0,
  padding: 0,
  listStyle: "none",
});

export const autoDriveTimelineItem = style({
  display: "grid",
  gridTemplateColumns: "12px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "flex-start",
});

export const autoDriveTimelineItemState = styleVariants({
  completed: {},
  active: {},
  remaining: {},
});

export const autoDriveTimelineMarker = style({
  width: "10px",
  height: "10px",
  marginTop: "6px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  selectors: {
    [`${autoDriveTimelineItemState.completed} &`]: {
      background: "color-mix(in srgb, var(--color-status-success) 72%, var(--ds-surface-hover))",
    },
    [`${autoDriveTimelineItemState.active} &`]: {
      background: "color-mix(in srgb, var(--color-primary) 78%, var(--ds-surface-hover))",
      borderColor: "color-mix(in srgb, var(--color-primary) 34%, transparent)",
    },
  },
});

export const autoDriveTimelineBody = style({
  display: "grid",
  gap: "4px",
});

export const autoDriveTimelineTitle = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const autoDriveTimelineDetail = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-muted)",
});

export const autoDriveActivityList = style({
  display: "grid",
  gap: "10px",
  margin: 0,
  padding: 0,
  listStyle: "none",
});

export const autoDriveActivityItem = style({
  display: "grid",
  gap: "6px",
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface) 96%, transparent)",
});

export const autoDriveActivityHeader = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
});

export const autoDriveActivityKind = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "22px",
  padding: "0 8px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--color-primary) 24%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--color-primary) 8%, var(--ds-surface) 92%)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
  fontWeight: 600,
  lineHeight: "var(--line-height-display)",
});

export const autoDriveActivityTitle = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const autoDriveActivityDetail = style({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-content)",
  color: "var(--ds-text-muted)",
});

export const autoDriveActivityMeta = style({
  fontSize: "var(--font-size-tiny)",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "var(--ds-text-subtle)",
});

export const autoDriveDeepStack = style({
  display: "grid",
  gap: "10px",
});

export const autoDriveMetricCompact = style({
  display: "grid",
  gap: "6px",
});

export const autoDriveTagList = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
});

export const autoDriveTag = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 9px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface) 96%, transparent)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-fine)",
});

export const autoDriveTagTone = styleVariants({
  ready: {
    background: "color-mix(in srgb, var(--color-status-success) 10%, var(--ds-surface) 92%)",
    borderColor: "color-mix(in srgb, var(--color-status-success) 28%, var(--ds-border-subtle))",
  },
  pending: {
    background: "color-mix(in srgb, var(--color-status-warning) 10%, var(--ds-surface) 92%)",
    borderColor: "color-mix(in srgb, var(--color-status-warning) 28%, var(--ds-border-subtle))",
  },
});

export const autoDriveTraceGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  "@media": {
    "(max-width: 960px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const autoDriveTraceCard = style({
  display: "grid",
  gap: "6px",
  padding: "11px 12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-command) 68%, transparent)",
});

export const autoDriveTraceTitle = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 700,
  color: "var(--ds-text-stronger)",
});
