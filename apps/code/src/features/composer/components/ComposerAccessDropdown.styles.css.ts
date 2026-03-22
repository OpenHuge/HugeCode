import { style, styleVariants } from "@vanilla-extract/css";
import { compactOption, flatMenu, flatTriggerChromeVars } from "./ComposerSelectMenu.css";

export const shell = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  minHeight: "26px",
  minWidth: 0,
  cursor: "pointer",
});

export const shellLayout = styleVariants({
  grouped: {
    padding: "1px 10px 1px 8px",
    borderRadius: "0",
    background: "transparent",
    boxShadow: "none",
    overflow: "hidden",
    selectors: {
      "&:hover, &:focus-within": {
        background: "color-mix(in srgb, var(--ds-surface-hover) 24%, transparent)",
      },
      "&:has([aria-expanded='true'])": {
        background:
          "color-mix(in srgb, var(--ds-surface-control-hover) 34%, var(--ds-surface-hover) 18%)",
        boxShadow: "none",
      },
    },
  },
  standalone: {
    margin: 0,
    padding: "1px 7px 1px 8px",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
    background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
    boxShadow: "none",
    overflow: "hidden",
    selectors: {
      "&:hover, &:focus-within": {
        borderColor: "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
        background: "color-mix(in srgb, var(--ds-surface-hover) 84%, transparent)",
      },
      "&:has([aria-expanded='true'])": {
        borderColor: "color-mix(in srgb, var(--ds-border-strong) 72%, transparent)",
        background: "color-mix(in srgb, var(--ds-surface) 88%, transparent)",
        boxShadow: "none",
      },
    },
  },
});

export const iconWrap = style({
  width: "14px",
  height: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  pointerEvents: "none",
});

export const iconTone = styleVariants({
  "read-only": {
    color: "var(--ds-text-muted)",
  },
  "on-request": {
    color: "color-mix(in srgb, var(--color-status-warning) 72%, var(--ds-text-strong))",
  },
  "full-access": {
    color: "color-mix(in srgb, var(--color-status-warning) 86%, white)",
  },
});

export const selectRoot = style({
  vars: flatTriggerChromeVars,
  minWidth: 0,
  display: "inline-flex",
  alignItems: "center",
});

export const trigger = style({
  vars: flatTriggerChromeVars,
  minHeight: "24px",
  padding: "0 4px 0 0",
  border: "none",
  background: "transparent",
  boxShadow: "none",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  lineHeight: "var(--line-height-100)",
  borderRadius: "0",
  transition:
    "background-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
  selectors: {
    "&:hover:not(:disabled), &:focus-visible": {
      borderColor: "transparent",
      background: "transparent",
      boxShadow: "none",
      color: "var(--ds-text-stronger)",
    },
    "&.is-open": {
      background: "transparent",
      boxShadow: "none",
    },
  },
});

export const shellDisabled = style({
  opacity: "var(--ds-state-disabled-opacity, 0.58)",
  cursor: "default",
});

export const triggerTone = styleVariants({
  "read-only": {
    color: "var(--ds-text-muted)",
  },
  "on-request": {
    color: "var(--ds-text-strong)",
  },
  "full-access": {
    color: "color-mix(in srgb, var(--color-status-warning) 90%, white)",
  },
});

export const menu = style([
  flatMenu,
  {
    minWidth: "156px",
    maxWidth: "min(220px, 90vw)",
  },
]);

export const option = style([compactOption]);
