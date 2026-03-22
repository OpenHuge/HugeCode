import { style } from "@vanilla-extract/css";
import { elevationValues, motionValues, typographyValues } from "@ku0/design-system";

export const groupCreate = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px 12px",
});

export const groupCreateInput = style({
  minWidth: "220px",
  maxWidth: "360px",
});

export const groupError = style({
  color: "var(--ds-text-danger)",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});

export const groupList = style({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});

export const groupRow = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  padding: "14px 16px",
  borderRadius: "var(--ds-radius-lg)",
  border: "1px solid var(--ds-border-muted)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 88%, transparent)",
});

export const groupFields = style({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minWidth: 0,
  flex: 1,
});

export const groupNameInput = style({
  maxWidth: "360px",
});

export const groupCopies = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const groupCopiesLabel = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  fontWeight: "600",
  color: "var(--ds-text-subtle)",
});

export const groupCopiesRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px 10px",
});

export const groupCopiesPath = style({
  flex: "1 1 240px",
  minHeight: "32px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 10px",
  borderRadius: "var(--ds-radius-md)",
  border: "1px solid var(--ds-border-muted)",
  background: "var(--ds-surface-control)",
  color: "var(--ds-text-strong)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const groupCopiesPathEmpty = style({
  color: "var(--ds-text-faint)",
});

export const groupActions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
});

export const projectGroup = style({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});

export const projectGroupSpaced = style({
  marginTop: "12px",
});

export const projectGroupLabel = style({
  textTransform: "uppercase",
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  letterSpacing: "0.08em",
  color: "var(--ds-text-faint)",
  paddingLeft: "4px",
});

export const projectName = style({
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  fontWeight: "600",
  color: "var(--ds-text-stronger)",
});

export const projectPath = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: "var(--ds-text-faint)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const projectRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "var(--ds-radius-md)",
  background: "var(--ds-surface-card-base)",
  border: "1px solid var(--ds-border-muted)",
  boxShadow: elevationValues.none,
  transition: motionValues.interactive,
  selectors: {
    "&:hover": {
      borderColor: "color-mix(in srgb, var(--ds-border-strong) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 86%, var(--ds-surface-card-base))",
      boxShadow: elevationValues.card,
    },
  },
});

export const projectInfo = style({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: "0",
});

export const projectActions = style({
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
});

export const projectGroupSelect = style({
  minWidth: "150px",
  width: "150px",
});

export const emptyMessage = style({
  color: "color-mix(in srgb, var(--ds-text-faint) 88%, white)",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
});
