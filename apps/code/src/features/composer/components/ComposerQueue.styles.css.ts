import { style } from "@vanilla-extract/css";

export const queue = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "10px 12px",
  borderRadius: "14px",
  background: "var(--ds-surface-card-base)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  boxShadow: "none",
});

export const queueHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
});

export const queueTitleWrap = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
});

export const queueTitle = style({
  fontSize: "var(--font-size-micro)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ds-text-fainter)",
});

export const queueCount = style({
  minWidth: "20px",
  height: "20px",
  padding: "0 6px",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-muted)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 90%, transparent)",
});

export const queueToggle = style({
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 82%, var(--ds-surface-card-base))",
  color: "var(--ds-text-faint)",
  width: "22px",
  height: "22px",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
  transition:
    "background var(--duration-fast) var(--ease-smooth),\n  color var(--duration-fast) var(--ease-smooth),\n  border-color var(--duration-fast) var(--ease-smooth),\n  transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover": {
      color: "var(--ds-text-strong)",
      borderColor: "color-mix(in srgb, var(--ds-border-strong) 86%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 92%, var(--ds-surface-item))",
    },
  },
});

export const queueToggleIcon = style({
  transform: "rotate(-90deg)",
  transition: "transform var(--duration-fast) var(--ease-smooth)",
  selectors: {
    [`${queueToggle}.is-expanded &`]: {
      transform: "rotate(0deg)",
    },
  },
});

export const queueList = style({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const queueItem = style({
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  padding: "8px 10px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
  background: "var(--ds-surface-item)",
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-fine)",
});

export const queueLeading = style({
  width: "18px",
  height: "18px",
  marginTop: "1px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ds-status-queued)",
  flex: "0 0 auto",
});

export const queueText = style({
  flex: 1,
  overflowWrap: "anywhere",
  display: "-webkit-box",
  WebkitLineClamp: "3",
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: "var(--line-height-150)",
});

export const queueMenu = style({
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 86%, transparent)",
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-fine)",
  minWidth: "24px",
  minHeight: "24px",
  padding: "0 6px",
  cursor: "pointer",
  selectors: {
    "&:hover": {
      borderColor: "color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 72%, var(--ds-surface-card-base))",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const queueContextMenu = style({
  position: "fixed",
  top: "var(--composer-queue-menu-top, 0px)",
  left: "var(--composer-queue-menu-left, 0px)",
  zIndex: 50,
  width: "200px",
  padding: "6px",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

export const queueContextOption = style({
  width: "100%",
  justifyContent: "flex-start",
});
