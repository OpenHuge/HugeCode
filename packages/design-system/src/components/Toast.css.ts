import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars, semanticThemeVars } from "../themeSemantics";

const slideIn = keyframes({
  from: { opacity: 0, transform: `translateY(${componentThemeVars.toast.enterOffsetY})` },
  to: { opacity: 1, transform: "translateY(0)" },
});

export const viewport = style({
  position: "fixed",
  right: `var(--space-4, ${semanticThemeVars.space.lg})`,
  bottom: `var(--space-4, ${semanticThemeVars.space.lg})`,
  zIndex: `var(--z-toast, ${semanticThemeVars.layer.toast})`,
  display: "flex",
  flexDirection: "column",
  gap: `var(--space-2, ${semanticThemeVars.space.sm})`,
});

export const card = style({
  display: "flex",
  width: "var(--space-80, 320px)",
  alignItems: "flex-start",
  gap: `var(--space-3, ${semanticThemeVars.space.md})`,
  borderRadius: `var(--radius-lg, ${componentThemeVars.toast.radius})`,
  border: `1px solid var(--color-border-subtle, ${componentThemeVars.toast.border})`,
  padding: `var(--space-4, ${semanticThemeVars.space.lg})`,
  boxShadow: `var(--elevation-floating, ${componentThemeVars.toast.shadow})`,
  backgroundColor: `var(--color-surface-0, ${componentThemeVars.toast.background})`,
  animationName: slideIn,
  animationDuration: "var(--duration-normal)",
  animationTimingFunction: "var(--ease-smooth)",
  animationFillMode: "forwards",
  fontFamily: semanticThemeVars.typography.font.ui,
});

export const cardTone = styleVariants({
  info: {},
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
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: `var(--space-3, ${semanticThemeVars.space.md})`,
});

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: `var(--space-2, ${semanticThemeVars.space.sm})`,
  flexWrap: "wrap",
});

export const title = style({
  margin: 0,
  fontSize: semanticThemeVars.typography.role.body,
  fontWeight: "500",
  color: componentThemeVars.toast.title,
});

export const body = style({
  marginTop: `var(--space-1, ${semanticThemeVars.space.xs})`,
  marginBottom: 0,
  fontSize: semanticThemeVars.typography.role.label,
  color: componentThemeVars.toast.body,
});

export const error = style({
  margin: 0,
  padding: `var(--space-3, ${semanticThemeVars.space.md})`,
  borderRadius: `var(--radius-md, ${semanticThemeVars.radius.md})`,
  background: `color-mix(in srgb, ${semanticThemeVars.color.bg.inset} 88%, transparent)`,
  color: semanticThemeVars.color.text.secondary,
  fontFamily: `var(--font-mono, ${semanticThemeVars.typography.font.mono})`,
  fontSize: semanticThemeVars.typography.role.label,
  overflowX: "auto",
});
