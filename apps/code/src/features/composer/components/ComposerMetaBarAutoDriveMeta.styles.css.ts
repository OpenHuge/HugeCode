import { keyframes, style } from "@vanilla-extract/css";

const autoDriveBreath = keyframes({
  "0%": {
    opacity: 0.2,
    transform: "scaleX(0.985) scaleY(0.98)",
  },
  "50%": {
    opacity: 0.82,
    transform: "scaleX(1) scaleY(1)",
  },
  "100%": {
    opacity: 0.2,
    transform: "scaleX(0.985) scaleY(0.98)",
  },
});

const autoDrivePulse = keyframes({
  "0%": {
    opacity: 0.42,
    transform: "scale(0.92)",
  },
  "50%": {
    opacity: 1,
    transform: "scale(1)",
  },
  "100%": {
    opacity: 0.42,
    transform: "scale(0.92)",
  },
});

export const root = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  zIndex: 80,
});

export const switchButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "60px",
  minWidth: "60px",
  height: "26px",
  padding: 0,
  borderRadius: "999px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  flexShrink: 0,
  selectors: {
    "&:disabled": {
      opacity: 0.5,
      cursor: "default",
    },
  },
});

export const switchLabel = style({
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 1,
  fontSize: "var(--font-size-micro)",
  fontWeight: 650,
  letterSpacing: "0.02em",
  color: "var(--ds-text-muted)",
  transition:
    "color var(--duration-fast) var(--ease-smooth), left var(--duration-fast) var(--ease-smooth), right var(--duration-fast) var(--ease-smooth)",
  selectors: {
    '&[data-state="off"]': {
      right: "8px",
    },
    '&[data-state="on"]': {
      left: "9px",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const switchTrack = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  width: "60px",
  height: "100%",
  padding: "2px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-default) 80%, transparent)",
  flexShrink: 0,
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
  selectors: {
    '&[data-state="off"]': {
      background: "color-mix(in srgb, var(--ds-surface-hover) 84%, var(--ds-surface-control) 16%)",
      borderColor: "color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
    },
    '&[data-state="on"]': {
      background: "color-mix(in srgb, var(--color-primary) 34%, var(--ds-surface-hover))",
      borderColor: "color-mix(in srgb, var(--color-primary) 54%, var(--ds-border-subtle))",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, white 12%, transparent)",
    },
  },
});

export const switchThumb = style({
  display: "block",
  position: "relative",
  zIndex: 2,
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 96%, var(--ds-color-white) 4%)",
  boxShadow: "none",
  border: "1px solid color-mix(in srgb, var(--ds-border-default) 76%, transparent)",
  transition:
    "transform var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
  selectors: {
    '&[data-state="off"]': {
      transform: "translateX(0)",
      borderColor: "color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
    },
    '&[data-state="on"]': {
      transform: "translateX(36px)",
      background: "white",
      borderColor: "color-mix(in srgb, white 64%, var(--color-primary) 36%)",
      boxShadow: "0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 14%, transparent)",
    },
  },
});

export const statusRail = style({
  position: "relative",
  display: "grid",
  gap: "10px",
  padding: "8px 12px",
  borderRadius: "16px 16px 0 0",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 84%, var(--ds-surface-card-base))",
  overflow: "hidden",
  selectors: {
    "&::before": {
      content: "",
      position: "absolute",
      inset: 0,
      opacity: 0,
      pointerEvents: "none",
      background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
    },
    '&[data-breathing="true"]::before': {
      animation: `${autoDriveBreath} 2.8s var(--ease-smooth) infinite`,
    },
    '&[data-state="running"]': {
      borderColor: "color-mix(in srgb, var(--color-primary) 30%, var(--ds-border-subtle))",
      background: "color-mix(in srgb, var(--color-primary) 10%, var(--ds-surface-control) 90%)",
    },
    '&[data-state="paused"]': {
      borderColor: "color-mix(in srgb, var(--ds-status-warning) 26%, var(--ds-border-subtle))",
    },
    '&[data-state="arrived"]': {
      borderColor: "color-mix(in srgb, var(--ds-status-success) 28%, var(--ds-border-subtle))",
    },
    '&[data-state="failed"]': {
      borderColor: "color-mix(in srgb, var(--ds-status-danger) 28%, var(--ds-border-subtle))",
    },
  },
});

export const statusRailPresence = style({
  overflow: "hidden",
  transformOrigin: "top center",
  transition:
    "opacity 220ms var(--ease-smooth), transform 220ms var(--ease-smooth), max-height 220ms var(--ease-smooth)",
  selectors: {
    '&[data-visibility="hidden"], &[data-visibility="entering"], &[data-visibility="exiting"]': {
      opacity: 0,
      transform: "translateY(-8px) scaleY(0.985)",
      maxHeight: 0,
      pointerEvents: "none",
    },
    '&[data-visibility="visible"]': {
      opacity: 1,
      transform: "translateY(0) scaleY(1)",
      maxHeight: "520px",
    },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transition: "none",
    },
  },
});

export const statusRailToggle = style({
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: 0,
  border: "none",
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
  minWidth: 0,
  selectors: {
    "&:focus-visible": {
      outline: "none",
    },
  },
  "@media": {
    "(max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      rowGap: "6px",
    },
  },
});

export const statusRailLead = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
  flexWrap: "wrap",
});

export const statusSignal = style({
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  flexShrink: 0,
  background: "color-mix(in srgb, var(--ds-text-muted) 60%, transparent)",
  selectors: {
    '&[data-state="on"]': {
      background: "color-mix(in srgb, var(--color-primary) 52%, white)",
    },
    '&[data-state="running"]': {
      background: "color-mix(in srgb, var(--color-primary) 74%, white)",
      animation: `${autoDrivePulse} 1.9s ease-out infinite`,
    },
    '&[data-state="paused"]': {
      background: "color-mix(in srgb, var(--ds-status-warning) 78%, white)",
    },
    '&[data-state="arrived"]': {
      background: "color-mix(in srgb, var(--ds-status-success) 72%, white)",
    },
    '&[data-state="stopped"], &[data-state="failed"]': {
      background: "color-mix(in srgb, var(--ds-status-danger) 72%, white)",
    },
  },
});

export const statusTitle = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--ds-text-stronger)",
});

export const statusSummary = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-muted)",
  lineHeight: "var(--line-height-140)",
  "@media": {
    "(max-width: 720px)": {
      gridColumn: "1 / -1",
      order: 3,
    },
  },
});

export const statusRailMeta = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  justifySelf: "end",
  flexShrink: 0,
});

export const triggerCaret = style({
  width: "12px",
  height: "12px",
  flexShrink: 0,
  opacity: 0.84,
  transition: "transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    [`${statusRailToggle}[aria-expanded="true"] &`]: {
      transform: "rotate(180deg)",
    },
  },
});

export const expandedPanel = style({
  position: "relative",
  zIndex: 1,
  display: "grid",
  gap: "10px",
  paddingTop: "2px",
});

export const headline = style({
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-strong)",
  lineHeight: "var(--line-height-145)",
});

export const detail = style({
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  lineHeight: "var(--line-height-150)",
});

export const statusCard = style({
  display: "grid",
  gap: "8px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
  selectors: {
    '&[data-state="on"]': {
      background: "color-mix(in srgb, var(--ds-surface-control) 82%, var(--ds-surface-card-base))",
    },
    '&[data-state="running"]': {
      background: "color-mix(in srgb, var(--color-primary) 10%, var(--ds-surface-control) 90%)",
      borderColor: "color-mix(in srgb, var(--color-primary) 20%, var(--ds-border-subtle))",
    },
    '&[data-state="paused"]': {
      borderColor: "color-mix(in srgb, var(--ds-status-warning) 20%, var(--ds-border-subtle))",
    },
    '&[data-state="arrived"]': {
      borderColor: "color-mix(in srgb, var(--ds-status-success) 24%, var(--ds-border-subtle))",
    },
    '&[data-state="failed"]': {
      borderColor: "color-mix(in srgb, var(--ds-status-danger) 24%, var(--ds-border-subtle))",
    },
  },
});

export const summaryGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
  "@media": {
    "(max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
});

export const summaryItem = style({
  display: "grid",
  gap: "2px",
  padding: "10px",
  borderRadius: "10px",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 82%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 60%, transparent)",
});

export const summaryLabel = style({
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  lineHeight: "var(--line-height-135)",
});

export const summaryValue = style({
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-strong)",
  lineHeight: "var(--line-height-140)",
});

export const actionRail = style({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
});
