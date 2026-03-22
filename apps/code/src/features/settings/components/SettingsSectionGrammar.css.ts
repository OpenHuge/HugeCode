import { style } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";

export const sectionFrame = style({
  width: "100%",
});

export const sectionTitle = style({
  fontSize: typographyValues.titleLg.fontSize,
  lineHeight: typographyValues.titleLg.lineHeight,
  letterSpacing: "-0.03em",
  color: "color-mix(in srgb, var(--ds-text-stronger) 92%, white)",
  "@media": {
    "(max-width: 720px)": {
      fontSize: typographyValues.title.fontSize,
      lineHeight: typographyValues.title.lineHeight,
    },
  },
});

export const sectionSubtitle = style({
  maxWidth: "64ch",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  color: "color-mix(in srgb, var(--ds-text-subtle) 94%, white)",
});

export const fieldGroup = style({
  display: "flex",
  flexDirection: "column",
  gap: "14px",
});

export const fieldGroupHeader = style({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const fieldGroupTitle = style({
  marginTop: "4px",
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  fontWeight: "700",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

export const fieldGroupSubtitle = style({
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  color: "color-mix(in srgb, var(--ds-text-subtle) 90%, white)",
});

export const fieldGroupBody = style({
  display: "flex",
  flexDirection: "column",
  gap: "14px",
});

export const field = style({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});

export const fieldLabel = style({
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  fontWeight: "600",
  color: "var(--ds-text-strong)",
});

export const fieldControlRow = style({
  display: "flex",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "10px 12px",
  minHeight: "40px",
  padding: "2px 0",
});

export const fieldActions = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px 12px",
});

export const helpText = style({
  fontSize: typographyValues.meta.fontSize,
  color: "color-mix(in srgb, var(--ds-text-subtle) 90%, white)",
  lineHeight: typographyValues.meta.lineHeight,
});

export const errorText = style({
  fontSize: typographyValues.meta.fontSize,
  color: "var(--ds-text-danger)",
  lineHeight: typographyValues.meta.lineHeight,
});

export const toggleRow = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
  minHeight: "65px",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  selectors: {
    "&:last-child": {
      borderBottom: "none",
      paddingBottom: 0,
    },
  },
});

export const toggleCopy = style({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const toggleTitle = style({
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  fontWeight: "600",
  color: "var(--ds-text-stronger)",
});

export const toggleSubtitle = style({
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  color: "var(--ds-text-faint)",
});

export const footerBar = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "6px",
});

export const valueText = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "32px",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  fontWeight: "600",
  color: "var(--ds-text-subtle)",
});
