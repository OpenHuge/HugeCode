import { keyframes, style, styleVariants } from "@vanilla-extract/css";

const slideIn = keyframes({
  from: { transform: "translateX(100%)" },
  to: { transform: "translateX(0)" },
});

export const container = style({
  position: "fixed",
  right: "var(--space-4, 16px)",
  bottom: "var(--space-4, 16px)",
  zIndex: "var(--z-toast, 500)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2, 8px)",
});

export const viewport = container;

export const toastBase = style({
  display: "flex",
  width: "var(--space-80, 320px)",
  alignItems: "flex-start",
  gap: "var(--space-3, 12px)",
  borderRadius: "var(--radius-lg, 12px)",
  border: "1px solid",
  padding: "var(--space-4, 16px)",
  boxShadow: "var(--elevation-floating)",
  backgroundColor: "var(--color-surface-0)",
  animationName: slideIn,
  animationDuration: "var(--duration-normal)",
  animationTimingFunction: "var(--ease-smooth)",
  animationFillMode: "forwards",
  fontFamily: "var(--ui-font-family)",
});

export const card = toastBase;

export const toastVariants = styleVariants({
  success: {
    backgroundColor: "var(--color-success-subtle)",
    borderColor: "color-mix(in srgb, var(--color-status-success) 24%, transparent)",
    color: "var(--color-status-success)",
  },
  error: {
    backgroundColor: "var(--color-destructive-subtle)",
    borderColor: "color-mix(in srgb, var(--color-status-error) 24%, transparent)",
    color: "var(--color-status-error)",
  },
  warning: {
    backgroundColor: "var(--color-warning-subtle)",
    borderColor: "color-mix(in srgb, var(--color-status-warning) 24%, transparent)",
    color: "var(--color-status-warning)",
  },
  info: {
    backgroundColor: "var(--color-surface-1)", // Using subtle background
    borderColor: "var(--color-border-subtle)",
    color: "var(--color-fg-secondary)",
  },
});

export const icon = style({
  fontSize: "var(--font-size-title-lg)",
  fontWeight: "bold",
});

export const content = style({
  flex: 1,
  minWidth: 0,
  display: "grid",
  gap: "var(--space-1, 4px)",
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3, 12px)",
});

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-2, 8px)",
  flexWrap: "wrap",
});

export const title = style({
  margin: 0,
  fontSize: "var(--font-size-title)",
  fontWeight: "500",
  color: "var(--color-fg-primary)",
});

export const description = style({
  marginTop: "var(--space-1, 4px)",
  marginBottom: 0,
  fontSize: "var(--font-size-label)",
  color: "var(--color-fg-secondary)",
});

export const error = style({
  margin: 0,
  padding: "var(--space-3, 12px)",
  borderRadius: "var(--radius-md, 8px)",
  background: "color-mix(in srgb, var(--color-surface-2) 88%, transparent)",
  color: "var(--color-fg-secondary)",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "var(--font-size-label)",
  overflowX: "auto",
});

export const closeButton = style({
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "var(--color-fg-tertiary)",
  transition: "color var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover": {
      color: "var(--color-fg-primary)",
    },
  },
});
