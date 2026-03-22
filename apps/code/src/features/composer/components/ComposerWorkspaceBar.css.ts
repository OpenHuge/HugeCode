import { style } from "@vanilla-extract/css";

export const root = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "8px",
  flexWrap: "wrap",
  padding: "2px 10px 0",
  minWidth: 0,
});

export const leading = style({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
  flex: "1 1 auto",
  flexWrap: "wrap",
});

export const trailing = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "6px",
  minWidth: 0,
  flexWrap: "wrap",
});

export const workspaceRail = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
  flexWrap: "wrap",
});

export const supportRail = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "0",
  flexShrink: 0,
  minWidth: 0,
  maxWidth: "100%",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-raised) 88%, var(--ds-surface-floating) 12%)",
  boxShadow:
    "inset 0 1px 0 color-mix(in srgb, white 12%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 6%, transparent)",
  padding: "1px",
  overflow: "hidden",
});

export const badge = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  minHeight: "28px",
  flexShrink: 0,
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
  padding: "0 10px 0 8px",
});

export const badgeIcon = style({
  width: "16px",
  height: "16px",
  flexShrink: 0,
  opacity: 0.78,
});

export const accessSlot = style({
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "stretch",
  minWidth: 0,
  borderLeft: "1px solid color-mix(in srgb, var(--ds-border-subtle) 64%, transparent)",
});

export const dropdownRoot = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
});

export const branchTrigger = style({
  gap: "5px",
  minWidth: 0,
  minHeight: "30px",
  maxWidth: "min(184px, 46vw)",
  width: "100%",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-raised) 88%, var(--ds-surface-floating) 12%)",
  boxShadow:
    "inset 0 1px 0 color-mix(in srgb, white 12%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 6%, transparent)",
  selectors: {
    "&:hover:not(:disabled), &[aria-expanded='true']": {
      borderColor: "color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, var(--ds-surface-raised) 22%)",
    },
    "&:disabled": {
      opacity: 0.5,
    },
  },
});

export const branchTriggerIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ds-text-muted)",
  flexShrink: 0,
  opacity: 0.8,
});

export const branchTriggerLabel = style({
  display: "inline-block",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "left",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  lineHeight: "var(--line-height-120)",
  maxWidth: "100%",
});

export const branchTriggerCaret = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ds-text-muted)",
  flexShrink: 0,
  marginLeft: "auto",
  opacity: 0.76,
});

export const contextIndicator = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "18px",
  height: "18px",
  flexShrink: 0,
  color: "var(--ds-text-faint)",
  selectors: {
    '&[data-tone="calm"]': {
      color: "color-mix(in srgb, var(--color-primary) 60%, var(--ds-text-faint))",
    },
    '&[data-tone="warm"]': {
      color: "color-mix(in srgb, var(--color-warning) 78%, var(--ds-text-muted))",
    },
    '&[data-tone="hot"]': {
      color: "color-mix(in srgb, var(--color-status-error) 82%, var(--ds-text-muted))",
    },
  },
});

export const contextIndicatorGraphic = style({
  width: "18px",
  height: "18px",
  overflow: "visible",
});

export const contextIndicatorTrack = style({
  stroke: "color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  strokeWidth: 1.75,
});

export const contextIndicatorProgress = style({
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  transition: "stroke-dashoffset var(--duration-fast) var(--ease-smooth)",
});

export const contextIndicatorPercent = style({
  display: "none",
});

export const visuallyHidden = style({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: "0",
});
