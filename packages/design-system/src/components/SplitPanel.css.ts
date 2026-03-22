import { style } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  display: "grid",
  gridTemplateColumns: dsVar("--ds-split-panel-columns", "minmax(240px, 280px) minmax(0, 1fr)"),
  gap: componentThemeVars.surface.padding.md,
  minWidth: 0,
  minHeight: 0,
  alignItems: "stretch",
});

export const leading = style({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
});

export const trailing = style({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
});
