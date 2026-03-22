import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

const semanticThemeVars = {
  borderWidth: {
    default: "1px",
  },
  color: {
    bg: {
      canvas: "var(--color-canvas, var(--color-background))",
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
    xl: "var(--radius-xl)",
  },
  space: {
    lg: "var(--spacing-4)",
    md: "var(--spacing-3)",
    sm: "var(--spacing-2)",
    xl: "var(--spacing-5)",
    xs: "var(--spacing-1)",
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
      background: `linear-gradient(180deg, ${semanticThemeVars.color.bg.canvas} 0%, color-mix(in srgb, ${semanticThemeVars.color.bg.canvas} 78%, ${semanticThemeVars.color.bg.panel}) 100%)`,
      color: semanticThemeVars.color.text.primary,
      position: "relative",
      overflow: "hidden",
    },
  },
});

export const frame = style({
  "@layer": {
    [layers.components]: {
      maxWidth: "1480px",
      margin: "0 auto",
      display: "grid",
      gap: semanticThemeVars.space.lg,
      position: "relative",
    },
  },
});

export const hero = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.sm,
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
      alignItems: "center",
      justifyContent: "space-between",
      gap: semanticThemeVars.space.sm,
      flexWrap: "wrap",
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
      maxWidth: "920px",
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

export const workspaceGrid = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
      gap: semanticThemeVars.space.lg,
      alignItems: "start",
      "@media": {
        "screen and (max-width: 1180px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const panelStack = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.md,
      alignItems: "start",
    },
  },
});

export const panelShell = style({
  "@layer": {
    [layers.components]: {
      height: "320px",
      minHeight: 0,
      borderRadius: semanticThemeVars.radius.xl,
      overflow: "hidden",
      boxShadow: "0 12px 24px color-mix(in srgb, var(--ds-color-black) 8%, transparent)",
    },
  },
});

export const planPanelShell = style([
  panelShell,
  {
    "@layer": {
      [layers.components]: {
        height: "360px",
      },
    },
  },
]);

export const diffSurface = style({
  "@layer": {
    [layers.components]: {
      minHeight: "700px",
    },
  },
});

export const planArtifact = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.xs,
    },
  },
});

export const planArtifactTitle = style({
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

export const planArtifactBody = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      color: semanticThemeVars.color.text.secondary,
      fontSize: semanticThemeVars.typography.role.caption,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
      whiteSpace: "pre-wrap",
    },
  },
});

export const planStepList = style({
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

export const planStepRow = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      gap: semanticThemeVars.space.sm,
      alignItems: "start",
      padding: `${semanticThemeVars.space.sm} ${semanticThemeVars.space.md}`,
      borderRadius: semanticThemeVars.radius.lg,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.inset,
    },
  },
});

export const planStepStatus = style({
  "@layer": {
    [layers.components]: {
      fontFamily: semanticThemeVars.typography.font.mono,
      fontSize: semanticThemeVars.typography.role.caption,
      color: semanticThemeVars.color.text.tertiary,
      whiteSpace: "nowrap",
    },
  },
});

export const planStepText = style({
  "@layer": {
    [layers.components]: {
      fontSize: semanticThemeVars.typography.role.body,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
      color: semanticThemeVars.color.text.primary,
    },
  },
});

export const planNote = style({
  "@layer": {
    [layers.components]: {
      margin: 0,
      padding: `${semanticThemeVars.space.sm} ${semanticThemeVars.space.md}`,
      borderRadius: semanticThemeVars.radius.lg,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.inset,
      color: semanticThemeVars.color.text.secondary,
      fontSize: semanticThemeVars.typography.role.caption,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
    },
  },
});
