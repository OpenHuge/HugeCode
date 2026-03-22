import { style } from "@vanilla-extract/css";
import { typographyStyles } from "../semanticPrimitives.css";
import { rowValues } from "../semanticPrimitives";
import { componentThemeVars } from "../themeSemantics";

export const metadataList = style({
  display: "flex",
  flexDirection: "column",
  gap: rowValues.listGap,
});

export const metadataRow = style({
  display: "grid",
  gridTemplateColumns: "minmax(78px, 0.8fr) minmax(0, 1.2fr)",
  gap: rowValues.rowGap,
  alignItems: "start",
  minWidth: 0,
  padding: rowValues.rowPadding,
  borderBottom: `1px solid color-mix(in srgb, ${componentThemeVars.rows.rowBorder} 48%, transparent)`,
  selectors: {
    "&:last-child": {
      borderBottom: "none",
    },
  },
  "@media": {
    "(max-width: 360px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const metadataLabel = style([
  typographyStyles.fine,
  {
    fontWeight: rowValues.labelFontWeight,
    color: componentThemeVars.rows.label,
    textTransform: "uppercase",
    letterSpacing: rowValues.labelLetterSpacing,
  },
]);

export const metadataValue = style([
  typographyStyles.meta,
  {
    color: componentThemeVars.rows.value,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
]);

export const inlineActionRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: rowValues.inlineGap,
  padding: rowValues.inlinePadding,
  borderRadius: rowValues.inlineRadius,
  background: `color-mix(in srgb, ${componentThemeVars.rows.inlineActionSurface} 48%, transparent)`,
  selectors: {
    "&:hover": {
      background: componentThemeVars.rows.inlineActionSurfaceHover,
    },
  },
});

export const inlineActionCopy = style({
  display: "flex",
  flexDirection: "column",
  gap: rowValues.copyGap,
  minWidth: 0,
});

export const inlineActionLabel = style([
  typographyStyles.meta,
  {
    fontWeight: 600,
    color: componentThemeVars.rows.value,
  },
]);

export const inlineActionDescription = style([
  typographyStyles.fine,
  {
    color: componentThemeVars.rows.description,
  },
]);
