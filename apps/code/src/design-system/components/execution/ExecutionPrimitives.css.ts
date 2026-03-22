import { createVar, style, styleVariants } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import { executionCompatThemeVars as semanticThemeVars } from "../../../styles/tokens/executionCompatThemeVars";

const accentVar = createVar();
const accentSurfaceVar = createVar();
const accentTextVar = createVar();
const accentBorderVar = createVar();

const toneVars = {
  neutral: {
    [accentVar]: semanticThemeVars.color.border.default,
    [accentSurfaceVar]: semanticThemeVars.color.bg.inset,
    [accentTextVar]: semanticThemeVars.color.text.secondary,
    [accentBorderVar]: semanticThemeVars.color.border.subtle,
  },
  running: {
    [accentVar]: semanticThemeVars.color.state.running,
    [accentSurfaceVar]:
      "color-mix(in srgb, var(--semantic-color-state-running) 12%, var(--semantic-color-bg-card))",
    [accentTextVar]: semanticThemeVars.color.text.primary,
    [accentBorderVar]:
      "color-mix(in srgb, var(--semantic-color-state-running) 38%, var(--semantic-color-border-default))",
  },
  success: {
    [accentVar]: semanticThemeVars.color.state.success,
    [accentSurfaceVar]:
      "color-mix(in srgb, var(--semantic-color-state-success) 11%, var(--semantic-color-bg-card))",
    [accentTextVar]: semanticThemeVars.color.text.primary,
    [accentBorderVar]:
      "color-mix(in srgb, var(--semantic-color-state-success) 34%, var(--semantic-color-border-default))",
  },
  warning: {
    [accentVar]: semanticThemeVars.color.state.warning,
    [accentSurfaceVar]:
      "color-mix(in srgb, var(--semantic-color-state-warning) 12%, var(--semantic-color-bg-card))",
    [accentTextVar]: semanticThemeVars.color.text.primary,
    [accentBorderVar]:
      "color-mix(in srgb, var(--semantic-color-state-warning) 36%, var(--semantic-color-border-default))",
  },
  danger: {
    [accentVar]: semanticThemeVars.color.state.danger,
    [accentSurfaceVar]:
      "color-mix(in srgb, var(--semantic-color-state-danger) 11%, var(--semantic-color-bg-card))",
    [accentTextVar]: semanticThemeVars.color.text.primary,
    [accentBorderVar]:
      "color-mix(in srgb, var(--semantic-color-state-danger) 34%, var(--semantic-color-border-default))",
  },
} as const;

export const executionRow = style({
  "@layer": {
    [layers.components]: {
      vars: toneVars.neutral,
      display: "grid",
      gap: semanticThemeVars.space.sm,
      width: "100%",
      maxWidth: "100%",
      padding: semanticThemeVars.space.md,
      borderRadius: semanticThemeVars.radius.xl,
      border: `${semanticThemeVars.borderWidth.default} solid ${accentBorderVar}`,
      background: `color-mix(in srgb, ${accentSurfaceVar} 82%, ${semanticThemeVars.color.bg.card})`,
      boxShadow: `inset 0 1px 0 color-mix(in srgb, ${semanticThemeVars.color.text.inverse} 4%, transparent)`,
      transition: [
        `border-color ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
        `background ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
        `box-shadow ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
      ].join(", "),
    },
  },
});

export const executionRowTone = styleVariants({
  neutral: { "@layer": { [layers.components]: { vars: toneVars.neutral } } },
  running: { "@layer": { [layers.components]: { vars: toneVars.running } } },
  success: { "@layer": { [layers.components]: { vars: toneVars.success } } },
  warning: { "@layer": { [layers.components]: { vars: toneVars.warning } } },
  danger: { "@layer": { [layers.components]: { vars: toneVars.danger } } },
});

export const executionRowHeader = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: semanticThemeVars.space.sm,
      minWidth: "0",
    },
  },
});

export const executionRowInteractive = style({
  "@layer": {
    [layers.components]: {
      cursor: "default",
      selectors: {
        "&:hover": {
          borderColor: `color-mix(in srgb, ${accentVar} 22%, ${semanticThemeVars.color.border.default})`,
          background: `color-mix(in srgb, ${accentSurfaceVar} 88%, ${semanticThemeVars.color.bg.card})`,
        },
        "&:focus-within": {
          borderColor: semanticThemeVars.color.border.focus,
          boxShadow: [
            `0 0 0 ${semanticThemeVars.motion.focus.width} color-mix(in srgb, ${semanticThemeVars.color.border.focus} 24%, transparent)`,
            `inset 0 1px 0 color-mix(in srgb, ${semanticThemeVars.color.text.inverse} 4%, transparent)`,
          ].join(", "),
        },
      },
    },
  },
});

export const executionRowSelected = style({
  "@layer": {
    [layers.components]: {
      borderColor: `color-mix(in srgb, ${accentVar} 34%, ${semanticThemeVars.color.border.default})`,
      background: `color-mix(in srgb, ${accentSurfaceVar} 92%, ${semanticThemeVars.color.bg.card})`,
    },
  },
});

export const executionRowDisabled = style({
  "@layer": {
    [layers.components]: {
      opacity: 0.68,
    },
  },
});

export const executionRowLead = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      minWidth: "0",
      alignItems: "flex-start",
      gap: semanticThemeVars.space.sm,
      flex: "1 1 auto",
    },
  },
});

export const executionRowIcon = style({
  "@layer": {
    [layers.components]: {
      width: semanticThemeVars.size.control.sm,
      height: semanticThemeVars.size.control.sm,
      borderRadius: semanticThemeVars.radius.pill,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
      color: accentVar,
      background: `color-mix(in srgb, ${accentVar} 14%, ${semanticThemeVars.color.bg.panel})`,
      border: `${semanticThemeVars.borderWidth.default} solid ${accentBorderVar}`,
    },
  },
});

export const executionRowTitleStack = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.xxs,
      minWidth: "0",
      flex: "1 1 auto",
    },
  },
});

export const executionRowTitle = style({
  "@layer": {
    [layers.components]: {
      minWidth: "0",
      maxWidth: "100%",
      color: semanticThemeVars.color.text.primary,
      fontSize: semanticThemeVars.typography.role.label,
      fontWeight: semanticThemeVars.typography.weight.semibold,
      lineHeight: semanticThemeVars.typography.lineHeight.sm,
    },
  },
});

export const executionRowDescription = style({
  "@layer": {
    [layers.components]: {
      minWidth: "0",
      maxWidth: "100%",
      color: semanticThemeVars.color.text.secondary,
      fontSize: semanticThemeVars.typography.role.body,
      lineHeight: semanticThemeVars.typography.lineHeight.md,
      textWrap: "pretty",
    },
  },
});

export const executionRowMeta = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: semanticThemeVars.space.xs,
      minWidth: "0",
    },
  },
});

export const executionRowActions = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: semanticThemeVars.space.xs,
      flex: "0 0 auto",
      alignSelf: "flex-start",
    },
  },
});

export const executionRowBody = style({
  "@layer": {
    [layers.components]: {
      display: "grid",
      gap: semanticThemeVars.space.sm,
      minWidth: "0",
    },
  },
});

export const executionRowFooter = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: semanticThemeVars.space.xs,
      paddingTop: semanticThemeVars.space.sm,
      borderTop: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
    },
  },
});

export const statusPill = style({
  "@layer": {
    [layers.components]: {
      vars: toneVars.neutral,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: semanticThemeVars.space.xxs,
      minHeight: semanticThemeVars.size.control.xs,
      padding: `0 ${semanticThemeVars.space.xs}`,
      borderRadius: semanticThemeVars.radius.pill,
      border: `${semanticThemeVars.borderWidth.default} solid ${accentBorderVar}`,
      background: accentSurfaceVar,
      color: accentTextVar,
      fontSize: semanticThemeVars.typography.role.caption,
      fontWeight: semanticThemeVars.typography.weight.medium,
      whiteSpace: "nowrap",
      transition: [
        `border-color ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
        `background ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
      ].join(", "),
    },
  },
});

export const statusPillTone = styleVariants({
  neutral: { "@layer": { [layers.components]: { vars: toneVars.neutral } } },
  running: { "@layer": { [layers.components]: { vars: toneVars.running } } },
  success: { "@layer": { [layers.components]: { vars: toneVars.success } } },
  warning: { "@layer": { [layers.components]: { vars: toneVars.warning } } },
  danger: { "@layer": { [layers.components]: { vars: toneVars.danger } } },
});

export const statusPillStrong = style({
  "@layer": {
    [layers.components]: {
      background: `color-mix(in srgb, ${accentVar} 18%, ${semanticThemeVars.color.bg.card})`,
      color: semanticThemeVars.color.text.primary,
    },
  },
});

export const statusPillDot = style({
  "@layer": {
    [layers.components]: {
      width: semanticThemeVars.space.xxs,
      height: semanticThemeVars.space.xxs,
      borderRadius: semanticThemeVars.radius.pill,
      background: accentVar,
      flex: "0 0 auto",
    },
  },
});

export const toolCallChip = style({
  "@layer": {
    [layers.components]: {
      vars: toneVars.neutral,
      display: "inline-flex",
      alignItems: "center",
      gap: semanticThemeVars.space.xxs,
      minHeight: semanticThemeVars.size.control.xs,
      padding: `0 ${semanticThemeVars.space.xs}`,
      borderRadius: semanticThemeVars.radius.pill,
      border: `${semanticThemeVars.borderWidth.default} solid ${accentBorderVar}`,
      background: `color-mix(in srgb, ${accentSurfaceVar} 82%, ${semanticThemeVars.color.bg.panel})`,
      color: semanticThemeVars.color.text.secondary,
      fontSize: semanticThemeVars.typography.role.caption,
      fontWeight: semanticThemeVars.typography.weight.medium,
      minWidth: "0",
      maxWidth: "100%",
      transition: [
        `border-color ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
        `background ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
      ].join(", "),
    },
  },
});

export const toolCallChipTone = styleVariants({
  neutral: { "@layer": { [layers.components]: { vars: toneVars.neutral } } },
  running: { "@layer": { [layers.components]: { vars: toneVars.running } } },
  success: { "@layer": { [layers.components]: { vars: toneVars.success } } },
  warning: { "@layer": { [layers.components]: { vars: toneVars.warning } } },
  danger: { "@layer": { [layers.components]: { vars: toneVars.danger } } },
});

export const toolCallChipIcon = style({
  "@layer": {
    [layers.components]: {
      color: accentVar,
      flex: "0 0 auto",
    },
  },
});

export const toolCallChipLabel = style({
  "@layer": {
    [layers.components]: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: "0",
    },
  },
});

export const diffPanelFileList = style({
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

export const diffPanelFile = style({
  "@layer": {
    [layers.components]: {
      display: "flex",
      alignItems: "center",
      gap: semanticThemeVars.space.sm,
      minWidth: "0",
      padding: `${semanticThemeVars.space.xs} ${semanticThemeVars.space.sm}`,
      borderRadius: semanticThemeVars.radius.lg,
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.inset,
    },
  },
});

export const diffPanelFileStatus = style({
  "@layer": {
    [layers.components]: {
      flex: "0 0 auto",
      textTransform: "capitalize",
    },
  },
});

export const diffPanelFilePath = style({
  "@layer": {
    [layers.components]: {
      color: semanticThemeVars.color.text.primary,
      fontSize: semanticThemeVars.typography.role.body,
      lineHeight: semanticThemeVars.typography.lineHeight.sm,
      fontFamily: semanticThemeVars.typography.font.mono,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: "0",
    },
  },
});

export const diffPanelContent = style({
  "@layer": {
    [layers.components]: {
      borderRadius: semanticThemeVars.radius.lg,
      overflow: "hidden",
      border: `${semanticThemeVars.borderWidth.default} solid ${semanticThemeVars.color.border.subtle}`,
      background: semanticThemeVars.color.bg.inset,
    },
  },
});
