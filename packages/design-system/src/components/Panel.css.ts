import { style } from "@vanilla-extract/css";
import { componentThemeVars, semanticThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const frame = style({
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  minWidth: 0,
  minHeight: 0,
  borderRadius: dsVar("--ds-radius-xl", semanticThemeVars.radius.xl),
  border: `1px solid ${dsVar("--ds-panel-border", componentThemeVars.panel.border)}`,
  background: dsVar("--ds-panel-surface", componentThemeVars.panel.surface),
  boxShadow: semanticThemeVars.shadow.xs,
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dsVar("--ds-space-3", componentThemeVars.panel.gap),
  minHeight: dsVar("--ds-panel-header-min-height", componentThemeVars.panel.headerMinHeight),
  padding: `0 ${dsVar("--ds-space-4", semanticThemeVars.space.lg)}`,
  borderBottom: `1px solid color-mix(in srgb, ${dsVar("--ds-panel-border", componentThemeVars.panel.border)} 92%, transparent)`,
});

export const meta = style({
  display: "inline-flex",
  alignItems: "center",
  gap: dsVar("--ds-space-2", semanticThemeVars.space.sm),
  color: dsVar("--ds-panel-header-text", componentThemeVars.panel.headerText),
  fontSize: semanticThemeVars.typography.role.label,
});

export const searchField = style({
  display: "flex",
  alignItems: "center",
  gap: dsVar("--ds-space-2", semanticThemeVars.space.sm),
  minHeight: dsVar("--ds-button-height-sm", semanticThemeVars.size.control.sm),
  paddingInline: dsVar("--ds-space-3", semanticThemeVars.space.md),
  borderRadius: dsVar("--ds-radius-md", semanticThemeVars.radius.md),
  border: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", semanticThemeVars.color.border.subtle)} 88%, transparent)`,
  background: `color-mix(in srgb, ${dsVar("--ds-surface-control", semanticThemeVars.color.control.default)} 88%, transparent)`,
});

export const searchIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: dsVar("--ds-text-faint", semanticThemeVars.color.text.tertiary),
  flexShrink: 0,
});

export const searchInput = style({
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
  fontFamily: semanticThemeVars.typography.font.ui,
  fontSize: semanticThemeVars.typography.role.body,
  selectors: {
    "&::placeholder": {
      color: dsVar("--ds-text-faint", semanticThemeVars.color.text.tertiary),
    },
  },
});

export const navList = style({
  display: "grid",
  gap: dsVar("--ds-space-1", semanticThemeVars.space.xs),
  padding: dsVar("--ds-space-2", semanticThemeVars.space.sm),
});

export const navItem = style({
  width: "100%",
  minHeight: "var(--of-list-row-height, 32px)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dsVar("--ds-space-3", componentThemeVars.panel.gap),
  padding: "var(--of-list-row-padding, 0 8px)",
  borderRadius: "var(--of-list-row-radius, 8px)",
  border: "1px solid transparent",
  background: "transparent",
  color: dsVar("--ds-text-muted", componentThemeVars.panel.muted),
  fontFamily: semanticThemeVars.typography.font.ui,
  fontSize: semanticThemeVars.typography.role.label,
  fontWeight: "500",
  textAlign: "left",
  cursor: "pointer",
  transition:
    "background-color var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
  selectors: {
    "&:not(:disabled):hover": {
      background: dsVar("--ds-surface-hover", componentThemeVars.panel.rowHover),
      borderColor: `color-mix(in srgb, ${dsVar("--ds-border-default", semanticThemeVars.color.border.default)} 78%, transparent)`,
      color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
    },
    "&:focus-visible": {
      outline: "var(--focus-ring-input)",
      outlineOffset: "2px",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
});

export const navItemActive = style({
  background: dsVar("--ds-surface-card-base", componentThemeVars.panel.rowSelected),
  borderColor: `color-mix(in srgb, ${dsVar("--ds-border-strong", semanticThemeVars.color.border.strong)} 70%, transparent)`,
  color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
});

export const navItemMain = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-3, 12px)",
  minWidth: 0,
  flex: 1,
});

export const navItemIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  flexShrink: 0,
});

export const navItemLabel = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const navItemDisclosure = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: dsVar("--ds-text-faint", semanticThemeVars.color.text.tertiary),
});
