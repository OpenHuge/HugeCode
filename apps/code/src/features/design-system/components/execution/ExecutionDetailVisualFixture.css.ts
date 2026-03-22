import { style } from "@vanilla-extract/css";
import { layers } from "../../../../styles/system/layers.css";

const semanticThemeVars = {
  borderWidth: {
    default: "1px",
  },
  color: {
    bg: {
      canvas: "var(--color-canvas, var(--color-background))",
      card: "var(--color-card)",
      inset: "var(--color-surface-1)",
      panel: "var(--ds-surface-panel, var(--color-surface-2))",
    },
    border: {
      subtle:
        "var(--color-border-subtle, color-mix(in srgb, var(--color-border) 60%, transparent))",
    },
    text: {
      primary: "var(--color-fg-primary)",
      secondary: "var(--color-fg-secondary)",
      tertiary: "var(--color-fg-tertiary)",
    },
  },
  radius: {
    lg: "var(--radius-lg)",
    x2: "var(--radius-2xl)",
    xl: "var(--radius-xl)",
  },
  space: {
    lg: "var(--spacing-4)",
    md: "var(--spacing-3)",
    sm: "var(--spacing-2)",
    xl: "var(--spacing-5)",
    xs: "var(--spacing-1)",
    xxs: "var(--spacing-1)",
  },
  typography: {
    font: {
      mono: "var(--font-mono)",
    },
    lineHeight: {
      md: "var(--line-height-content)",
      sm: "var(--line-height-label)",
    },
    role: {
      body: "var(--font-size-content)",
      caption: "var(--font-size-chrome)",
      heading: "var(--font-size-title-lg)",
      label: "var(--font-size-label)",
    },
    weight: {
      semibold: "600",
    },
  },
} as const;

export const shell = style({
  "@layer": {
    [layers.components]: {
      minHeight: "100vh",
      padding: semanticThemeVars.space.xl,
      background: `linear-gradient(180deg, ${semanticThemeVars.color.bg.canvas} 0%, color-mix(in srgb, ${semanticThemeVars.color.bg.canvas} 82%, ${semanticThemeVars.color.bg.panel}) 100%)`,
      color: semanticThemeVars.color.text.primary,
    },
  },
});

export const frame = style({
  "@layer": {
    [layers.components]: {
      maxWidth: "1360px",
      margin: "0 auto",
      display: "grid",
      gap: semanticThemeVars.space.lg,
    },
  },
});

export const hero = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.sm,
      padding: semanticThemeVars.space.lg,
      borderRadius: semanticThemeVars.radius.x2,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${semanticThemeVars.color.bg.card} 92%, ${semanticThemeVars.color.bg.canvas}) 0%, ${semanticThemeVars.color.bg.card} 100%)`,
    },
  },
});

export const eyebrow = style({
  "@layer": {
    [layers.components]: {
      color: semanticThemeVars.color.text.tertiary,
      fontSize: semanticThemeVars.typography.role.label,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
});

export const titleRow = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: semanticThemeVars.space.sm,
    },
  },
});

export const title = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      fontSize: semanticThemeVars.typography.role.heading,
      lineHeight: semanticThemeVars.typography.lineHeight.sm,
      fontWeight: semanticThemeVars.typography.weight.semibold,
    },
  },
});

export const subtitle = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      maxWidth: "880px",
      color: semanticThemeVars.color.text.secondary,
      fontSize: semanticThemeVars.typography.role.body,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
    },
  },
});

export const chipRow = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      flexWrap: "wrap",
      gap: semanticThemeVars.space.xs,
      alignItems: "center",
    },
  },
});

export const contentGrid = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.lg,
      alignItems: "start",
      gridTemplateColumns: "minmax(0, 1.75fr) minmax(280px, 0.9fr)",
      "@media": {
        "screen and (max-width: 1100px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const sectionStack = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.md,
    },
  },
});

export const sidePanel = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.md,
      padding: semanticThemeVars.space.md,
      borderRadius: semanticThemeVars.radius.xl,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.card,
    },
  },
});

export const panelTitle = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      fontSize: semanticThemeVars.typography.role.label,
      lineHeight: semanticThemeVars.typography.lineHeight.sm,
      fontWeight: semanticThemeVars.typography.weight.semibold,
      color: semanticThemeVars.color.text.primary,
    },
  },
});

export const panelDescription = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      color: semanticThemeVars.color.text.secondary,
      fontSize: semanticThemeVars.typography.role.caption,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
    },
  },
});

export const fileList = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.xs,
      listStyle: "none",
      margin: 0,
      padding: 0,
    },
  },
});

export const fileRow = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.xxs,
      padding: `${semanticThemeVars.space.sm} ${semanticThemeVars.space.md}`,
      borderRadius: semanticThemeVars.radius.lg,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.inset,
    },
  },
});

export const filePath = style({
  "@layer": {
    [layers.components]: {
      fontFamily: semanticThemeVars.typography.font.mono,
      fontSize: semanticThemeVars.typography.role.caption,
      lineHeight: semanticThemeVars.typography.lineHeight.sm,
      color: semanticThemeVars.color.text.primary,
    },
  },
});

export const fileMeta = style({
  "@layer": {
    [layers.components]: {
      color: semanticThemeVars.color.text.tertiary,
      fontSize: semanticThemeVars.typography.role.caption,
      lineHeight: semanticThemeVars.typography.lineHeight.sm,
    },
  },
});

export const codeBlock = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      padding: semanticThemeVars.space.md,
      borderRadius: semanticThemeVars.radius.lg,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.canvas,
      color: semanticThemeVars.color.text.secondary,
      fontFamily: semanticThemeVars.typography.font.mono,
      fontSize: semanticThemeVars.typography.role.caption,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
      overflowX: "auto",
      whiteSpace: "pre-wrap",
    },
  },
});
