import { style } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";

export const root = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: componentThemeVars.sectionHeader.gap,
  minWidth: 0,
});

export const title = style({
  minWidth: 0,
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  lineHeight: "var(--line-height-125)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: componentThemeVars.sectionHeader.title,
});

export const side = style({
  display: "inline-flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: componentThemeVars.sectionHeader.gap,
  minWidth: 0,
});

export const meta = style({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-135)",
  color: componentThemeVars.sectionHeader.meta,
  whiteSpace: "nowrap",
});

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: componentThemeVars.sectionHeader.gap,
});
