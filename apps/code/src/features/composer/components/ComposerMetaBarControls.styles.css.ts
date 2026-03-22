import { style } from "@vanilla-extract/css";

export const modeToggle = style({
  display: "inline-grid",
  gridTemplateColumns: "14px minmax(0, 1fr)",
  alignItems: "center",
  justifyItems: "start",
  columnGap: "5px",
  flexShrink: 0,
  width: "74px",
  minHeight: "var(--composer-meta-control-height)",
  padding: "1px 9px 1px 9px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  letterSpacing: "0.01em",
  lineHeight: "var(--line-height-chrome)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), opacity var(--duration-normal) var(--ease-smooth)",
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
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "default",
    },
  },
  "@media": {
    "(max-width: 768px)": {
      gridTemplateColumns: "12px minmax(0, 1fr)",
      width: "68px",
      minHeight: "24px",
      padding: "0 8px",
      columnGap: "3px",
      fontSize: "var(--font-size-micro)",
    },
  },
});

export const modeToggleIcon = style({
  width: "14px",
  height: "14px",
  flexShrink: 0,
  opacity: 0.8,
  "@media": {
    "(max-width: 768px)": {
      width: "12px",
      height: "12px",
    },
  },
});

export const modeToggleLabel = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  lineHeight: "inherit",
});
