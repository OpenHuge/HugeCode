import { typographyValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const panelShell = style({
  "@layer": {
    [layers.features]: {
      gap: "12px",
      paddingTop: "0",
      minHeight: 0,
    },
  },
});

export const summaryGroup = style({
  "@layer": {
    [layers.features]: {
      gap: "12px",
    },
  },
});

export const panelHeader = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  fontSize: "var(--font-size-meta)",
  letterSpacing: "0.01em",
  alignItems: "stretch",
  gap: "8px",
  minHeight: "auto",
  padding: 0,
  borderBottom: "none",
});

export const panelHeaderPrimary = style({
  display: "flex",
  alignItems: "center",
  minWidth: 0,
});

export const panelHeaderSecondary = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  width: "100%",
});

export const panelSelect = style({
  display: "inline-flex",
  alignItems: "center",
  position: "relative",
  minWidth: "124px",
  marginLeft: 0,
});

export const panelSelectIcon = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ds-panel-muted)",
      position: "absolute",
      left: "11px",
      pointerEvents: "none",
    },
  },
});

export const panelSelectInput = style({
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 48%, transparent)",
      color: "var(--ds-panel-value)",
      fontSize: "var(--font-size-fine)",
      letterSpacing: "0.01em",
      textTransform: "none",
      padding: "6px 30px 6px 32px",
      borderRadius: "7px",
      cursor: "pointer",
      minHeight: "30px",
      appearance: "none",
      backgroundImage:
        "linear-gradient(45deg, transparent 50%, var(--ds-panel-muted) 50%), linear-gradient(135deg, var(--ds-panel-muted) 50%, transparent 50%)",
      backgroundPosition: "calc(100% - 12px) 50%, calc(100% - 8px) 50%",
      backgroundSize: "4px 4px, 4px 4px",
      backgroundRepeat: "no-repeat",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:hover": {
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 88%, transparent)",
      background: "var(--ds-panel-row-hover)",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--ds-panel-focus-ring) 54%, transparent)",
      outlineOffset: "1px",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 86%, transparent)",
    },
  },
});

export const worktreeApplyButton = style({
  "@layer": {
    [layers.features]: {
      width: "32px",
      height: "32px",
      borderRadius: "7px",
      padding: "0",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 48%, transparent)",
      color: "var(--ds-panel-muted)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      position: "relative",
    },
  },
  selectors: {
    "&:hover": {
      background: "var(--ds-panel-row-hover)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 86%, transparent)",
      color: "var(--ds-panel-value)",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--ds-panel-focus-ring) 54%, transparent)",
      outlineOffset: "1px",
    },
    "&[data-tooltip]::before, &[data-tooltip]::after": {
      opacity: "0",
      pointerEvents: "none",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
      transform: "translateY(4px)",
      zIndex: "10",
    },
    "&[data-tooltip]::after": {
      content: "attr(data-tooltip)",
      position: "absolute",
      left: "50%",
      bottom: "calc(100% + 8px)",
      transform: "translateX(-50%) translateY(4px)",
      padding: "4px 8px",
      borderRadius: "8px",
      background: "var(--ds-surface-command)",
      color: "var(--ds-text-emphasis)",
      fontSize: "var(--font-size-micro)",
      lineHeight: typographyValues.micro.lineHeight,
      whiteSpace: "nowrap",
      border: "1px solid var(--ds-border-subtle)",
      boxShadow: "0 8px 16px color-mix(in srgb, var(--ds-color-black) 14%, transparent)",
    },
    "&[data-tooltip]::before": {
      content: '""',
      position: "absolute",
      left: "50%",
      bottom: "calc(100% + 4px)",
      transform: "translateX(-50%) translateY(4px) rotate(45deg)",
      width: "8px",
      height: "8px",
      background: "var(--ds-surface-command)",
      borderLeft: "1px solid var(--ds-border-subtle)",
      borderTop: "1px solid var(--ds-border-subtle)",
    },
    "&:hover::before, &:hover::after, &:focus-visible::before, &:focus-visible::after": {
      opacity: "1",
    },
    "&:hover::after, &:focus-visible::after": {
      transform: "translateX(-50%) translateY(0)",
    },
    "&:hover::before, &:focus-visible::before": {
      transform: "translateX(-50%) translateY(0) rotate(45deg)",
    },
  },
});

export const summaryValue = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: 0,
    },
  },
});

export const integratedRailShell = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "14px",
      minWidth: 0,
      padding: 0,
    },
  },
});

export const integratedRailOverview = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "12px",
      minWidth: 0,
    },
  },
});

export const integratedRailSummary = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      alignItems: "start",
      gap: "12px",
      minWidth: 0,
      padding: "14px 14px 12px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 56%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 86%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      boxShadow:
        "0 20px 42px -34px color-mix(in srgb, var(--ds-shadow-color) 44%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
    },
  },
});

export const integratedRailRepo = style({
  "@layer": {
    [layers.features]: {
      padding: "12px 14px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 54%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 76%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
    },
  },
});
