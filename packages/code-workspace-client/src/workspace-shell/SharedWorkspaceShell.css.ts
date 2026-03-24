import {
  elevationValues,
  motionValues,
  semanticColors,
  spacing,
  statusChipValues,
  typographyValues,
} from "@ku0/design-system";
import { globalStyle, style, styleVariants } from "@vanilla-extract/css";
import {
  workspaceSelectChromeVars,
  workspaceSelectMenuChromeVars,
} from "./SharedWorkspaceSelectChrome.css";

export const shell = style({
  minHeight: "100vh",
  padding: "12px",
  background: "var(--ds-surface-app)",
  color: semanticColors.foreground,
  boxSizing: "border-box",
  position: "relative",
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing[4],
  margin: "0 auto",
  width: "min(1320px, 100%)",
  padding: "0 6px 12px",
  "@media": {
    "screen and (max-width: 960px)": {
      flexDirection: "column",
      alignItems: "stretch",
      padding: "0 0 12px",
    },
  },
});

export const headerLeading = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  minWidth: 0,
  flex: "1 1 auto",
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
});

export const headerIdentity = style({
  display: "grid",
  gap: "1px",
  minWidth: 0,
});

export const headerSubtitle = style({
  margin: 0,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  textWrap: "pretty",
});

export const headerActions = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: spacing[2],
  flexWrap: "wrap",
  "@media": {
    "screen and (max-width: 960px)": {
      justifyContent: "flex-start",
    },
  },
});

export const content = style({
  display: "grid",
  gap: spacing[4],
  width: "min(1320px, 100%)",
  margin: "0 auto",
});

export const sectionNav = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  flexWrap: "wrap",
});

export const sectionNavButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  minHeight: "30px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--ds-surface-item) 88%, transparent)",
  color: semanticColors.mutedForeground,
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  fontWeight: 600,
  cursor: "pointer",
  transition: motionValues.interactive,
  selectors: {
    "&:hover:not(:disabled), &:focus-visible": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-item))",
      color: semanticColors.foreground,
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 32%, transparent)",
      outline: "none",
    },
  },
});

export const sectionNavButtonActive = style({
  background: "color-mix(in srgb, var(--ds-brand-primary) 12%, var(--ds-surface-card))",
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 32%, transparent)",
  color: semanticColors.foreground,
  boxShadow: elevationValues.card,
});

export const kicker = style({
  margin: 0,
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: semanticColors.mutedForeground,
  fontWeight: 650,
});

export const title = style({
  margin: 0,
  fontSize: "clamp(18px, 1rem + 0.3vw, 21px)",
  lineHeight: typographyValues.title.lineHeight,
  color: semanticColors.foreground,
  fontWeight: 620,
  letterSpacing: "-0.02em",
});

export const body = style({
  margin: 0,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.content.fontSize,
  lineHeight: typographyValues.content.lineHeight,
  textWrap: "pretty",
});

export const button = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--ds-surface-item) 88%, transparent)",
  color: semanticColors.mutedForeground,
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  transition: motionValues.interactive,
  selectors: {
    "&:hover:not(:disabled), &:focus-visible": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-item))",
      color: semanticColors.foreground,
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 32%, transparent)",
      outline: "none",
    },
  },
});

export const subtleButton = style([
  button,
  {
    background: "transparent",
    borderColor: "color-mix(in srgb, var(--ds-border-subtle) 26%, transparent)",
  },
]);

export const runtimeBadge = style({
  minHeight: "24px",
  paddingInline: "8px",
  textTransform: "capitalize",
});

export const workspaceSelect = style({
  vars: workspaceSelectChromeVars,
  width: "auto",
  minWidth: "240px",
  maxWidth: "min(420px, 52vw)",
  "@media": {
    "screen and (max-width: 720px)": {
      minWidth: "220px",
      maxWidth: "100%",
    },
  },
});

export const workspaceSelectTrigger = style({
  minHeight: "28px",
  borderRadius: "999px",
  padding: "0 10px",
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  fontWeight: 600,
  letterSpacing: "0.01em",
});

globalStyle(`${workspaceSelectTrigger} [data-ui-select-trigger-caret="true"]`, {
  width: "14px",
  height: "14px",
  opacity: "0.76",
});

export const workspaceSelectMenu = style({
  vars: workspaceSelectMenuChromeVars,
  display: "grid",
  gap: "4px",
  borderRadius: "16px",
});

export const workspaceSelectOption = style({
  minHeight: "38px",
  padding: "0 12px",
  borderRadius: "12px",
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
});

export const heroCard = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
  gap: spacing[4],
  padding: spacing[5],
  borderRadius: "22px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 72%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-panel) 96%, transparent), color-mix(in srgb, var(--ds-surface-card) 92%, transparent))",
  boxShadow: elevationValues.floating,
  "@media": {
    "screen and (max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const heroCopy = style({
  display: "grid",
  gap: spacing[3],
  alignContent: "start",
});

export const heroAside = style({
  display: "grid",
  gap: spacing[3],
  alignContent: "start",
});

export const operatorActionCard = style({
  display: "grid",
  gap: spacing[3],
  padding: spacing[4],
  borderRadius: "18px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 60%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 96%, transparent), color-mix(in srgb, var(--ds-brand-primary) 7%, var(--ds-surface-panel)))",
  boxShadow: elevationValues.card,
});

export const operatorActionCopy = style({
  display: "grid",
  gap: spacing[2],
});

export const operatorActionFooter = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  flexWrap: "wrap",
});

export const summaryGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: spacing[4],
  "@media": {
    "screen and (max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const card = style({
  display: "grid",
  gap: spacing[3],
  padding: spacing[5],
  borderRadius: "20px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 68%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 96%, transparent), color-mix(in srgb, var(--ds-surface-panel) 94%, transparent))",
  boxShadow: elevationValues.card,
});

export const cardTitle = style({
  margin: 0,
  fontSize: "clamp(20px, 1.05rem + 0.4vw, 28px)",
  lineHeight: typographyValues.titleLg.lineHeight,
  fontWeight: 620,
  letterSpacing: "-0.02em",
});

export const statGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: spacing[3],
});

export const statRow = style({
  display: "grid",
  gap: spacing[1],
  padding: "10px 12px",
  borderRadius: "16px",
  background: "color-mix(in srgb, var(--ds-surface-item) 70%, transparent)",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 48%, transparent)`,
});

export const statLabel = style({
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});

export const statValue = style({
  fontSize: "clamp(18px, 0.95rem + 0.4vw, 26px)",
  lineHeight: typographyValues.title.lineHeight,
  fontWeight: 700,
  letterSpacing: "-0.03em",
});

export const readinessHeader = style({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[2],
});

export const readinessLabel = style({
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
  fontWeight: 600,
});

export const sectionHeader = style({
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: spacing[3],
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
});

export const sectionHeading = style({
  display: "grid",
  gap: "4px",
});

export const sectionTitle = style({
  margin: 0,
  fontSize: typographyValues.title.fontSize,
  lineHeight: typographyValues.title.lineHeight,
  fontWeight: 620,
  letterSpacing: "-0.02em",
});

export const sectionMeta = style({
  margin: 0,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});

export const workspaceSection = style({
  display: "grid",
  gap: spacing[3],
});

export const sectionStack = style({
  display: "grid",
  gap: spacing[3],
});

export const workspaceGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: spacing[3],
});

export const workspaceList = workspaceGrid;

export const workspaceButton = style({
  display: "grid",
  gap: spacing[1],
  alignItems: "start",
  width: "100%",
  padding: "16px",
  borderRadius: "18px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 66%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 94%, transparent), color-mix(in srgb, var(--ds-surface-panel) 92%, transparent))",
  color: semanticColors.foreground,
  textAlign: "left",
  cursor: "pointer",
  transition: motionValues.interactive,
  selectors: {
    "&:hover:not(:disabled), &:focus-visible": {
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-hover) 74%, var(--ds-surface-card)), color-mix(in srgb, var(--ds-surface-panel) 94%, transparent))",
      outline: "none",
      transform: "translateY(-1px)",
    },
  },
});

export const workspaceButtonActive = style({
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 46%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-brand-primary) 10%, var(--ds-surface-card)), color-mix(in srgb, var(--ds-surface-panel) 92%, transparent))",
  boxShadow: elevationValues.card,
});

export const workspaceName = style({
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
  fontWeight: 620,
});

export const workspaceMeta = style({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[2],
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});

export const overviewGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: spacing[3],
});

export const overviewButton = style([
  workspaceButton,
  {
    minHeight: "136px",
    alignContent: "start",
  },
]);

export const activityList = style({
  display: "grid",
  gap: spacing[3],
});

export const activityCard = style({
  display: "grid",
  gap: spacing[3],
  padding: spacing[4],
  borderRadius: "18px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 64%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 96%, transparent), color-mix(in srgb, var(--ds-surface-panel) 94%, transparent))",
  boxShadow: elevationValues.card,
});

export const activityHeader = style({
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: spacing[3],
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
});

export const activityCopy = style({
  display: "grid",
  gap: spacing[1],
  minWidth: 0,
});

export const activityTitle = style({
  margin: 0,
  fontSize: typographyValues.title.fontSize,
  lineHeight: typographyValues.title.lineHeight,
  fontWeight: 620,
  letterSpacing: "-0.02em",
});

export const activityMeta = style({
  margin: 0,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});

export const activityStatus = style({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[2],
  whiteSpace: "nowrap",
});

export const activityTone = styleVariants({
  active: { background: semanticColors.info },
  ready: { background: semanticColors.success },
  attention: { background: semanticColors.warning },
  blocked: { background: semanticColors.destructive },
  neutral: { background: semanticColors.mutedForeground },
});

export const highlightRow = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  flexWrap: "wrap",
});

export const highlightChip = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 10px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-surface-item) 84%, transparent)",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 52%, transparent)`,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  fontWeight: 600,
});

export const settingsGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: spacing[3],
});

export const statusDot = style({
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: semanticColors.mutedForeground,
  flexShrink: 0,
});

export const statusDotTone = styleVariants({
  ready: { background: semanticColors.success },
  attention: { background: semanticColors.warning },
  blocked: { background: semanticColors.destructive },
  idle: { background: semanticColors.mutedForeground },
});

export const emptyCard = style([
  card,
  {
    minHeight: "220px",
    alignContent: "center",
  },
]);

export const toastViewport = style({
  position: "fixed",
  top: "16px",
  right: "16px",
  bottom: "auto",
  zIndex: "var(--z-toast, 70)",
  width: "min(360px, calc(100vw - 24px))",
  display: "grid",
  gap: spacing[2],
  pointerEvents: "none",
  "@media": {
    "screen and (max-width: 720px)": {
      left: "12px",
      right: "12px",
      width: "auto",
    },
  },
});

export const toastCard = style({
  display: "grid",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  borderRadius: "18px",
  boxShadow: "var(--ds-toast-shadow), inset 0 1px 0 color-mix(in srgb, white 6%, transparent)",
  pointerEvents: "auto",
});

export const toastHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing[2],
});

export const toastDismiss = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "transparent",
  color: semanticColors.mutedForeground,
  cursor: "pointer",
  transition: motionValues.interactive,
  selectors: {
    "&:hover, &:focus-visible": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 66%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 32%, transparent)",
      color: semanticColors.foreground,
      outline: "none",
    },
  },
});

export const toastBody = style({
  marginTop: "4px",
  overflowWrap: "anywhere",
  lineHeight: typographyValues.meta.lineHeight,
  fontSize: typographyValues.meta.fontSize,
});
