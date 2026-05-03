import { style } from "@vanilla-extract/css";
import { semanticColors, spacing, typographyValues } from "@ku0/design-system";

export const accountCenterShell = style({
  display: "flex",
  width: "100%",
  minHeight: "100vh",
  backgroundColor: semanticColors.surface0,
  color: semanticColors.foreground,
  padding: spacing[8],
});

export const accountCenterContent = style({
  width: "100%",
  maxWidth: "72rem",
  margin: "0 auto",
});

export const accountCenterHeader = style({
  marginBottom: spacing[8],
});

export const accountCenterHeaderRow = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing[4],
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
    },
  },
});

export const accountCenterTitle = style({
  margin: 0,
  fontSize: typographyValues.titleLg.fontSize,
  lineHeight: typographyValues.titleLg.lineHeight,
});

export const accountCenterSubtitle = style({
  margin: `${spacing[3]} 0 0`,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.content.fontSize,
  lineHeight: typographyValues.content.lineHeight,
});

export const accountCenterMeta = style({
  margin: `${spacing[2]} 0 0`,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
});

export const accountGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: spacing[6],
  "@media": {
    "screen and (max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const primaryActionButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  minHeight: "2.5rem",
  padding: `${spacing[2]} ${spacing[4]}`,
  border: "none",
  borderRadius: "0.5rem",
  backgroundColor: semanticColors.accentAiStrong,
  color: semanticColors.surface0,
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
  selectors: {
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.6,
    },
  },
});

export const secondaryActionButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  minHeight: "2rem",
  padding: `${spacing[1]} ${spacing[3]}`,
  border: `1px solid ${semanticColors.border}`,
  borderRadius: "0.5rem",
  backgroundColor: semanticColors.surface2,
  color: semanticColors.foreground,
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
  selectors: {
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.6,
    },
  },
});

export const panel = style({
  border: `1px solid ${semanticColors.border}`,
  borderRadius: "0.875rem",
  backgroundColor: semanticColors.surface1,
  padding: spacing[6],
});

export const panelTitle = style({
  margin: 0,
  fontSize: typographyValues.title.fontSize,
  lineHeight: typographyValues.title.lineHeight,
});

export const panelText = style({
  margin: `${spacing[2]} 0 ${spacing[4]}`,
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
});

export const statList = style({
  margin: 0,
  padding: 0,
  display: "grid",
  gap: spacing[3],
});

export const statRow = style({
  display: "flex",
  justifyContent: "space-between",
  gap: spacing[4],
});

export const statLabel = style({
  margin: 0,
  color: semanticColors.mutedForeground,
});

export const statValue = style({
  margin: 0,
  fontWeight: "600",
});

export const usageItem = style({
  display: "grid",
  gap: spacing[2],
  marginBottom: spacing[4],
});

export const usageItemHeader = style({
  display: "flex",
  justifyContent: "space-between",
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
});

export const usageTrack = style({
  height: "0.5rem",
  borderRadius: "999px",
  backgroundColor: semanticColors.surface3,
  overflow: "hidden",
});

const usageBarBase = style({
  height: "100%",
  borderRadius: "999px",
});

export const usageBarSession = style([
  usageBarBase,
  {
    width: "42%",
    backgroundColor: semanticColors.accentAiStrong,
  },
]);

export const usageBarWeekly = style([
  usageBarBase,
  {
    width: "68%",
    backgroundColor: semanticColors.accentIndigo,
  },
]);

export const workspaceList = style({
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: spacing[3],
});

export const workspaceListItem = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing[4],
  padding: `${spacing[2]} 0`,
  borderBottom: `1px solid ${semanticColors.border}`,
  selectors: {
    "&:last-child": {
      borderBottom: "none",
    },
  },
});

export const workspaceListMeta = style({
  color: semanticColors.mutedForeground,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});

export const accountList = style({
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: spacing[3],
});

export const accountListItem = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: spacing[4],
  padding: `${spacing[2]} 0`,
  borderBottom: `1px solid ${semanticColors.border}`,
  selectors: {
    "&:last-child": {
      borderBottom: "none",
    },
  },
  "@media": {
    "screen and (max-width: 720px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const accountActions = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: spacing[2],
});

export const authImportTextarea = style({
  width: "100%",
  minHeight: "10rem",
  resize: "vertical",
  boxSizing: "border-box",
  border: `1px solid ${semanticColors.border}`,
  borderRadius: "0.5rem",
  backgroundColor: semanticColors.surface0,
  color: semanticColors.foreground,
  padding: spacing[3],
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: "1.5",
});

export const authImportActions = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing[3],
  marginTop: spacing[3],
});

export const authImportFileInput = style({
  position: "absolute",
  width: "1px",
  height: "1px",
  opacity: 0,
  pointerEvents: "none",
});

export const authImportFormats = style({
  display: "grid",
  gap: spacing[3],
  marginTop: spacing[5],
});

export const authImportFormat = style({
  display: "grid",
  gap: spacing[2],
  paddingTop: spacing[3],
  borderTop: `1px solid ${semanticColors.border}`,
});

export const authImportFormatHeader = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing[3],
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
    },
  },
});

export const authImportFormatContent = style({
  maxHeight: "10rem",
  overflow: "auto",
  margin: 0,
  padding: spacing[3],
  border: `1px solid ${semanticColors.border}`,
  borderRadius: "0.5rem",
  backgroundColor: semanticColors.surface0,
  color: semanticColors.foreground,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: "1.5",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
