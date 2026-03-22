import { keyframes, style } from "@vanilla-extract/css";
import { overlayValues, typographyValues } from "../semanticPrimitives";
import { componentThemeVars } from "../themeSemantics";

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const dialogZoomIn = keyframes({
  from: { opacity: 0, transform: "scale(0.95) translateY(4px)" },
  to: { opacity: 1, transform: "scale(1) translateY(0)" },
});

export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: "var(--z-modal, 200)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

export const backdrop = style({
  position: "absolute",
  inset: 0,
  backgroundColor: overlayValues.scrim,
  backdropFilter: overlayValues.translucentBackdrop,
  WebkitBackdropFilter: overlayValues.translucentBackdrop,
  border: "none",
  cursor: "pointer",
  animationName: fadeIn,
  animationDuration: "var(--duration-fast)",
  animationTimingFunction: "var(--ease-smooth)",
  animationFillMode: "forwards",
});

export const content = style({
  position: "relative",
  zIndex: "calc(var(--z-modal, 200) + 1)",
  width: "100%",
  maxWidth: "24rem",
  borderRadius: componentThemeVars.dialog.radius,
  border: `1px solid ${componentThemeVars.dialog.border}`,
  backgroundColor: componentThemeVars.dialog.surface,
  boxShadow: componentThemeVars.dialog.shadow,
  margin: componentThemeVars.dialog.margin,
  padding: componentThemeVars.dialog.padding,
  animationName: dialogZoomIn,
  animationDuration: "var(--duration-normal)",
  animationTimingFunction: "var(--ease-smooth)",
  animationFillMode: "forwards",
});

export const header = style({
  marginBottom: componentThemeVars.dialog.headerGap,
});

export const title = style({
  fontSize: typographyValues.displaySm.fontSize,
  lineHeight: typographyValues.displaySm.lineHeight,
  fontWeight: "500",
  color: componentThemeVars.dialog.title,
  margin: 0,
});

export const description = style({
  marginTop: componentThemeVars.dialog.headerGap,
  fontSize: typographyValues.title.fontSize,
  lineHeight: typographyValues.title.lineHeight,
  color: componentThemeVars.dialog.description,
});

export const footer = style({
  marginTop: componentThemeVars.dialog.padding,
  display: "flex",
  justifyContent: "flex-end",
  gap: componentThemeVars.dialog.footerGap,
  borderTop: `1px solid ${componentThemeVars.dialog.border}`,
  paddingTop: componentThemeVars.dialog.footerPaddingTop,
});
