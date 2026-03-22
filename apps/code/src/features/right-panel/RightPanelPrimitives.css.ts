import { style } from "@vanilla-extract/css";
import {
  focusRingValues,
  motionValues,
  semanticColors,
  spacing,
  statusChipValues,
  typographyValues,
} from "@ku0/design-system";

export const shell = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  height: "100%",
  overflow: "hidden",
  borderLeft: `1px solid color-mix(in srgb, ${semanticColors.border} 72%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-panel) 98%, var(--ds-surface-shell) 2%), color-mix(in srgb, var(--ds-surface-panel) 94%, var(--ds-surface-card) 6%) 26%, color-mix(in srgb, var(--ds-surface-shell) 96%, var(--ds-surface-card) 4%))",
  color: "var(--ds-panel-value)",
  backdropFilter: "blur(14px) saturate(1.04)",
  WebkitBackdropFilter: "blur(14px) saturate(1.04)",
  selectors: {
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-color-white) 4%, transparent), transparent 22%)",
      opacity: 1,
    },
    "&::after": {
      content: '""',
      position: "absolute",
      inset: "0 0 auto",
      height: "180px",
      pointerEvents: "none",
      background:
        "radial-gradient(circle at top right, color-mix(in srgb, var(--ds-brand-primary) 12%, transparent), transparent 56%)",
      opacity: 0.9,
    },
  },
});

export const header = style({
  position: "sticky",
  top: 0,
  zIndex: 3,
  display: "grid",
  gap: spacing[2],
  padding: "16px 16px 12px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-panel) 98%, var(--ds-surface-shell) 2%), color-mix(in srgb, var(--ds-surface-panel) 92%, transparent) 88%, transparent)",
  borderBottom: `1px solid color-mix(in srgb, ${semanticColors.border} 72%, transparent)`,
  backdropFilter: "blur(16px) saturate(1.04)",
  WebkitBackdropFilter: "blur(16px) saturate(1.04)",
});

export const headerTopRow = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
});

export const headerCopy = style({
  display: "grid",
  gap: "3px",
  minWidth: 0,
});

export const eyebrow = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  fontWeight: 650,
  color: semanticColors.mutedForeground,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
});

export const title = style({
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
  fontWeight: 620,
  color: semanticColors.foreground,
  minWidth: 0,
  letterSpacing: "-0.02em",
  overflowWrap: "anywhere",
});

export const subtitle = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: semanticColors.mutedForeground,
  minWidth: 0,
  maxWidth: "42ch",
  textWrap: "pretty",
});

export const headerActions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[1],
  flexWrap: "wrap",
  justifyContent: "flex-end",
  flexShrink: 0,
});

export const toolbar = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  minWidth: 0,
});

export const body = style({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "0 0 12px",
  scrollbarGutter: "stable",
});

export const bodyInner = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "14px",
  padding: "12px 12px 16px",
  minWidth: 0,
});

export const topBar = style({
  position: "sticky",
  top: 0,
  zIndex: 4,
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  padding: "10px 12px 6px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-panel) 98%, var(--ds-surface-shell)), color-mix(in srgb, var(--ds-surface-panel) 94%, transparent) 74%, transparent)",
  backdropFilter: "blur(14px) saturate(1.04)",
  WebkitBackdropFilter: "blur(14px) saturate(1.04)",
});

export const resizeHandle = style({
  position: "absolute",
  top: 0,
  bottom: 0,
  right: "calc(var(--right-panel-width-live, var(--right-panel-width, 360px)) - 6px)",
  width: "12px",
  cursor: "col-resize",
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  selectors: {
    "&::before": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "2px",
      height: "56px",
      transform: "translate(-50%, -50%)",
      borderRadius: "999px",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-resize-handle) 24%, transparent), var(--ds-panel-resize-handle), color-mix(in srgb, var(--ds-panel-resize-handle) 24%, transparent))",
      opacity: 0,
      transition: motionValues.interactive,
    },
    "&:hover::before, &:focus-visible::before": {
      opacity: 1,
    },
    "&:focus-visible": {
      outline: focusRingValues.overlay,
      outlineOffset: "-2px",
    },
  },
});

export const emptyState = style({
  display: "grid",
  gap: spacing[2],
  padding: "14px 12px",
  borderRadius: "16px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 62%, transparent)`,
  background: "color-mix(in srgb, var(--ds-surface-card) 94%, transparent)",
});

export const emptyStateActions = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
});

export const emptyStateBody = style({
  display: "grid",
  gap: "8px",
  minWidth: 0,
});

export const section = style({
  display: "grid",
  gap: spacing[2],
});

export const sectionGroup = style({
  display: "grid",
  gap: spacing[2],
  padding: "0",
  borderRadius: "18px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 54%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 98%, transparent), color-mix(in srgb, var(--ds-surface-item) 88%, transparent))",
  boxShadow:
    "0 18px 40px -34px color-mix(in srgb, var(--ds-shadow-color) 48%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
  overflow: "hidden",
});

export const sectionHeader = style({
  display: "grid",
  gap: "3px",
  padding: "14px 14px 0",
});

export const sectionBody = style({
  display: "grid",
  gap: spacing[2],
  minWidth: 0,
});

export const railSection = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "14px",
  minWidth: 0,
  padding: "14px 14px 10px",
  borderRadius: "22px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 64%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 98%, transparent), color-mix(in srgb, var(--ds-surface-item) 84%, transparent) 58%, color-mix(in srgb, var(--ds-surface-panel) 92%, transparent))",
  overflow: "hidden",
  boxShadow:
    "0 24px 48px -38px color-mix(in srgb, var(--ds-shadow-color) 54%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
  selectors: {
    "&[data-rail-section='interrupt']": {
      borderColor: "color-mix(in srgb, var(--status-warning) 38%, var(--ds-border-subtle))",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--status-warning) 10%, var(--ds-surface-card)), color-mix(in srgb, var(--ds-surface-card) 98%, transparent))",
    },
    "&[data-rail-section='artifact']": {
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 98%, transparent), color-mix(in srgb, var(--ds-surface-item) 86%, transparent))",
    },
    "&[data-rail-section='detail']": {
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-brand-primary) 4%, var(--ds-surface-card)), color-mix(in srgb, var(--ds-surface-item) 92%, transparent))",
    },
  },
});

export const stickySectionActions = style({
  position: "sticky",
  bottom: 0,
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  justifyContent: "flex-end",
  padding: "12px 14px 14px",
  marginInline: "-14px",
  marginBottom: "-14px",
  marginTop: spacing[1],
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 8%, transparent), color-mix(in srgb, var(--ds-surface-card) 98%, transparent) 34%)",
  borderTop: `1px solid color-mix(in srgb, ${semanticColors.border} 46%, transparent)`,
  backdropFilter: "blur(10px) saturate(1.02)",
  WebkitBackdropFilter: "blur(10px) saturate(1.02)",
});

export const metadataLabel = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  fontWeight: 600,
  color: semanticColors.mutedForeground,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
});

export const metadataValue = style({
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  color: semanticColors.foreground,
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const propertyGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
  gap: spacing[2],
});

export const keyValueRow = style({
  display: "grid",
  gap: "3px",
  minWidth: 0,
  padding: "11px 12px",
  borderRadius: "14px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 58%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 82%, transparent), color-mix(in srgb, var(--ds-surface-card) 94%, transparent))",
});

export const detailHero = style({
  display: "grid",
  gap: spacing[2],
  padding: "14px 14px 6px",
  margin: "-14px -14px 0",
  borderBottom: `1px solid color-mix(in srgb, ${semanticColors.border} 44%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-brand-primary) 5%, var(--ds-surface-card)), color-mix(in srgb, var(--ds-surface-card) 96%, transparent) 66%, transparent)",
});

export const detailHeroCopy = style({
  display: "grid",
  gap: "4px",
  minWidth: 0,
});

export const detailHeroTitleRow = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
});

export const detailHeroTitle = style({
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
  fontWeight: 620,
  color: semanticColors.foreground,
  letterSpacing: "-0.02em",
  minWidth: 0,
});

export const detailHeroSubtitle = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: semanticColors.mutedForeground,
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const narrativeBlock = style({
  display: "grid",
  gap: spacing[2],
  padding: "13px 14px",
  borderRadius: "16px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 58%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 76%, transparent), color-mix(in srgb, var(--ds-surface-card) 94%, transparent))",
  color: semanticColors.foreground,
});

export const evidenceList = style({
  display: "grid",
  gap: "1px",
  overflow: "hidden",
  borderRadius: "14px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 58%, transparent)`,
  background: "color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
});

export const evidenceRow = style({
  display: "grid",
  gap: "5px",
  padding: "12px 13px",
  background: "color-mix(in srgb, var(--ds-surface-card) 98%, transparent)",
});

export const evidenceRowHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
});

export const evidenceLabel = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  fontWeight: 600,
  color: semanticColors.mutedForeground,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
});

export const evidenceValue = style({
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  color: semanticColors.foreground,
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const chipList = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  flexWrap: "wrap",
});

export const chip = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: statusChipValues.minHeight,
  paddingInline: statusChipValues.paddingInline,
  borderRadius: "999px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 54%, transparent)`,
  background: "color-mix(in srgb, var(--ds-surface-item) 82%, transparent)",
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  fontWeight: 600,
  color: semanticColors.foreground,
});

export const inlineActionCopy = style({
  display: "grid",
  gap: "4px",
  minWidth: 0,
});

export const inlineActionDescription = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: semanticColors.mutedForeground,
  overflowWrap: "anywhere",
});

export const copyableField = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "flex-start",
  gap: spacing[2],
  padding: "11px 13px",
  borderRadius: "16px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 58%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 80%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
});

export const copyableValue = style({
  minWidth: 0,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  color: semanticColors.foreground,
  overflowWrap: "anywhere",
});

export const preformattedBlock = style({
  margin: 0,
  padding: "12px 13px",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--ds-panel-code-bg) 92%, var(--ds-surface-card))",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 56%, transparent)`,
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--code-font-size)",
  lineHeight: "var(--line-height-meta)",
  color: semanticColors.foreground,
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

export const logBlock = style([
  preformattedBlock,
  {
    background: "color-mix(in srgb, var(--ds-panel-log-bg) 88%, var(--ds-surface-card))",
    maxHeight: "220px",
    overflowY: "auto",
  },
]);

export const diffList = style({
  display: "grid",
  gap: "1px",
  overflow: "hidden",
  borderRadius: "14px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 58%, transparent)`,
  background: "color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
});

export const diffRow = style({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "flex-start",
  gap: spacing[2],
  minWidth: 0,
  padding: "10px 12px",
  background: "color-mix(in srgb, var(--ds-surface-card) 98%, transparent)",
});

export const diffStatusBadge = style({
  flexShrink: 0,
});

export const panelActionBar = style({
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  flexWrap: "wrap",
});

export const toolbarButton = style({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[1],
  minHeight: "28px",
  padding: "0 9px",
  borderRadius: "999px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 54%, transparent)`,
  background: "color-mix(in srgb, var(--ds-surface-item) 82%, transparent)",
  color: semanticColors.mutedForeground,
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  fontWeight: 600,
  transition: motionValues.interactive,
  selectors: {
    "&:hover": {
      background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-item))",
      color: semanticColors.foreground,
    },
    "&:focus-visible": {
      outline: focusRingValues.overlay,
      outlineOffset: "2px",
    },
  },
});

export const toolbarButtonIcon = style({
  transition: motionValues.interactive,
  selectors: {
    [`${toolbarButton}[aria-expanded='false'] &`]: {
      transform: "rotate(-90deg)",
    },
  },
});

export const tabList = style({
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "1fr",
  alignItems: "center",
  gap: "4px",
  width: "100%",
  padding: "4px",
  borderRadius: "16px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 82%, transparent), color-mix(in srgb, var(--ds-surface-card) 94%, transparent))",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 54%, transparent)`,
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
});

export const tab = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: semanticColors.mutedForeground,
  borderRadius: "12px",
  minHeight: "32px",
  padding: "0 12px",
  fontSize: statusChipValues.fontSize,
  lineHeight: statusChipValues.lineHeight,
  fontWeight: 600,
  whiteSpace: "nowrap",
  letterSpacing: "0.01em",
  transition: motionValues.interactive,
  selectors: {
    "&[data-state='active']": {
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 98%, transparent), color-mix(in srgb, var(--ds-surface-item) 88%, transparent))",
      color: semanticColors.foreground,
      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${semanticColors.border} 52%, transparent), 0 10px 24px -18px color-mix(in srgb, var(--ds-shadow-color) 34%, transparent)`,
    },
    "&:hover:not([data-state='active'])": {
      color: semanticColors.foreground,
      background: "color-mix(in srgb, var(--ds-surface-hover) 68%, transparent)",
    },
    "&:focus-visible": {
      outline: focusRingValues.overlay,
      outlineOffset: "2px",
    },
  },
});

export const tabPanel = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  minWidth: 0,
  width: "100%",
});
