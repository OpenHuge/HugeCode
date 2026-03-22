import { style } from "@vanilla-extract/css";
import { componentThemeVars, semanticThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const frame = style({
  display: "grid",
  minWidth: 0,
  alignContent: "start",
  gap: componentThemeVars.surface.padding.md,
});

export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: componentThemeVars.surface.padding.sm,
  minWidth: 0,
  minHeight: "100%",
  borderRadius: dsVar("--ds-shell-section-radius", componentThemeVars.surface.radius),
  boxShadow: "none",
});

export const sectionHeader = style({
  display: "grid",
  gap: componentThemeVars.sectionHeader.gap,
  minWidth: 0,
});

export const sectionBody = style({
  display: "flex",
  flexDirection: "column",
  gap: componentThemeVars.surface.padding.sm,
  minWidth: 0,
  minHeight: 0,
  flex: 1,
});

export const toolbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: componentThemeVars.sectionHeader.gap,
  flexWrap: "wrap",
  minWidth: 0,
});

export const toolbarLeading = style({
  display: "inline-flex",
  alignItems: "center",
  gap: componentThemeVars.sectionHeader.gap,
  minWidth: 0,
});

export const toolbarCenter = style({
  display: "inline-flex",
  alignItems: "center",
  gap: componentThemeVars.sectionHeader.gap,
  minWidth: 0,
  flex: "1 1 auto",
});

export const toolbarTrailing = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: componentThemeVars.sectionHeader.gap,
  minWidth: 0,
  marginLeft: "auto",
});

export const emptySurface = style({
  display: "grid",
  minWidth: 0,
  minHeight: "88px",
  color: dsVar("--ds-empty-surface-fg", componentThemeVars.emptyState.description),
});

export const emptyState = style({
  minHeight: "100%",
  alignContent: "start",
  color: dsVar("--ds-empty-surface-fg", componentThemeVars.emptyState.description),
  textWrap: "pretty",
});

export const listRowBase = style({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: componentThemeVars.surface.padding.sm,
  minWidth: 0,
  padding: `${componentThemeVars.surface.padding.sm} ${componentThemeVars.surface.padding.md}`,
  border: `${semanticThemeVars.borderWidth.default} solid ${componentThemeVars.surface.border}`,
  borderRadius: componentThemeVars.surface.radius,
  background: componentThemeVars.surface.surfaceSubtle,
  color: semanticThemeVars.color.text.primary,
  textAlign: "left",
  selectors: {
    "&:where(button)": {
      appearance: "none",
      font: "inherit",
    },
  },
});

export const listRowInteractive = style({
  cursor: "pointer",
  transition: [
    `background-color ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
    `border-color ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
    `transform ${semanticThemeVars.motion.duration.fast} ${semanticThemeVars.motion.easing.standard}`,
  ].join(", "),
  selectors: {
    "&:not(:disabled):hover": {
      background: semanticThemeVars.color.bg.hover,
      borderColor: semanticThemeVars.color.border.strong,
      transform: "translateY(-1px)",
    },
    "&:focus-visible": {
      outline: `${semanticThemeVars.motion.focus.width} solid ${semanticThemeVars.color.border.focus}`,
      outlineOffset: semanticThemeVars.motion.focus.offset,
    },
    "&:disabled": {
      opacity: 0.72,
      cursor: "not-allowed",
    },
  },
});

export const listRowLeading = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

export const listRowCopy = style({
  display: "flex",
  flexDirection: "column",
  gap: semanticThemeVars.space.xs,
  minWidth: 0,
  flex: 1,
});

export const listRowTitle = style({
  minWidth: 0,
});

export const listRowDescription = style({
  minWidth: 0,
});

export const listRowTrailing = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: semanticThemeVars.space.xs,
  flexShrink: 0,
});
