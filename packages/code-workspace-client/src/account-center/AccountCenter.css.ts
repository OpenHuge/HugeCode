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
