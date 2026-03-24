import { style, styleVariants } from "@vanilla-extract/css";

export const root = style({
  position: "relative",
  minWidth: 0,
});

export const rootWidth = styleVariants({
  auto: {
    width: "auto",
  },
  full: {
    width: "100%",
  },
});

export const trigger = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  width: "100%",
  gap: "8px",
  padding: "0",
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  selectors: {
    "&:disabled": {
      cursor: "default",
    },
  },
});

export const triggerBody = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  width: "100%",
  gap: "8px",
});

export const triggerIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "14px",
  height: "14px",
  flexShrink: 0,
  opacity: 0.9,
});

export const triggerLabel = style({
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const triggerCaret = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "14px",
  height: "14px",
  flexShrink: 0,
  opacity: 0.72,
});

export const overlay = style({
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
});

export const panel = style({
  minWidth: "208px",
  padding: "8px",
  borderRadius: "18px",
  border: "1px solid color-mix(in srgb, var(--ds-border-muted) 78%, transparent)",
  background:
    "color-mix(in srgb, var(--ds-surface-overlay, var(--ds-surface-card-base)) 96%, black 4%)",
  boxShadow: "var(--shadow-lg)",
  backdropFilter: "blur(24px)",
});

export const modelPanel = style({
  minWidth: "236px",
});

export const list = style({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

export const item = style({
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr) 12px",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  minHeight: "40px",
  padding: "0 12px",
  border: "none",
  borderRadius: "12px",
  background: "transparent",
  color: "var(--ds-text-strong)",
  cursor: "pointer",
  textAlign: "left",
  transition:
    "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), opacity var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:hover:not(:disabled), &:focus-visible:not(:disabled)": {
      outline: "none",
      background: "color-mix(in srgb, var(--ds-surface-hover) 88%, transparent)",
    },
    "&:disabled": {
      opacity: "var(--ds-state-disabled-opacity, 0.58)",
      cursor: "default",
    },
  },
});

export const itemActive = style({
  background: "color-mix(in srgb, var(--ds-surface-hover) 88%, transparent)",
});

export const itemSelected = style({
  color: "var(--ds-text-stronger)",
});

export const itemIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  flexShrink: 0,
  opacity: 0.9,
});

export const itemLabel = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--font-size-chrome)",
  fontWeight: 500,
  lineHeight: "var(--line-height-chrome)",
});

export const itemText = style({
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
});

export const itemMetaRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  minWidth: 0,
});

const badgeBase = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "18px",
  padding: "0 7px",
  borderRadius: "999px",
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-100)",
  fontWeight: 600,
  whiteSpace: "nowrap",
});

export const itemBadge = style([
  badgeBase,
  {
    background: "color-mix(in srgb, var(--ds-accent-soft) 82%, transparent)",
    color: "var(--ds-text-strong)",
  },
]);

export const itemBadgeMuted = style([
  badgeBase,
  {
    background: "color-mix(in srgb, var(--ds-surface-hover) 88%, transparent)",
    color: "var(--ds-text-muted)",
  },
]);

export const itemAffordance = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "12px",
  height: "12px",
  opacity: 0.68,
});

export const providerPanel = style({});
