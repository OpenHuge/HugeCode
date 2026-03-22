import { style } from "@vanilla-extract/css";

export const contentBlock = style({
  padding: "1.5rem",
});

export const title = style({
  margin: 0,
  fontSize: "var(--font-size-title-lg)",
  fontWeight: 600,
  color: "var(--color-fg-primary, var(--color-fg-primary))",
});

export const body = style({
  margin: "0.5rem 0 0",
  fontSize: "var(--font-size-content)",
  lineHeight: 1.6,
  color: "var(--color-fg-secondary, var(--color-fg-secondary))",
});

export const bodySmall = style([
  body,
  {
    fontSize: "var(--font-size-label)",
  },
]);

export const blockGap = style({
  display: "grid",
  gap: "1rem",
});

export const stack = style({
  display: "grid",
  gap: "1rem",
});

export const formStack = style({
  display: "grid",
  gap: "1rem",
  width: "min(34rem, 100%)",
});

export const row = style({
  display: "flex",
  alignItems: "center",
  gap: "1rem",
});

export const wrapRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
});

export const fixedCardWidth = style({
  width: "21.875rem",
});

export const fixedPanelWidth = style({
  width: "25rem",
});

export const fixedFieldWidth = style({
  width: "17.5rem",
});

export const fixedWidePanelWidth = style({
  width: "42rem",
  maxWidth: "100%",
});

export const avatarChip = style({
  display: "flex",
  height: "3rem",
  width: "3rem",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "9999px",
  backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
  color: "var(--color-primary)",
  fontWeight: 700,
});

export const paddedSurface = style({
  padding: "2.5rem",
});

export const centeredSurface = style({
  display: "flex",
  justifyContent: "center",
  padding: "6.25rem",
});

export const wideTextBlock = style({
  width: "22.5rem",
});

export const shellCanvas = style({
  display: "grid",
  gap: "1rem",
  width: "100%",
  maxWidth: "72rem",
});

export const shellSidebar = style({
  display: "grid",
  gap: "0.75rem",
});

export const shellMain = style({
  display: "grid",
  gap: "1rem",
});

export const listColumn = style({
  display: "grid",
  gap: "0.75rem",
  width: "min(42rem, 100%)",
});

export const surfaceMatrix = style({
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
});

export const splitPanelShowcase = style({
  minHeight: "20rem",
});

export const toneCard = style({
  display: "grid",
  gap: "0.75rem",
  minHeight: "9rem",
});

export const badgeWrap = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
});

export const scrollSurface = style({
  maxHeight: "12rem",
  overflow: "auto",
});

export const skeletonCard = style({
  width: "20rem",
  height: "7.5rem",
  borderRadius: "1rem",
});

export const skeletonAvatar = style({
  width: "3.5rem",
  height: "3.5rem",
});

export const textScaleStack = style({
  display: "grid",
  gap: "0.875rem",
  width: "min(56rem, 100%)",
});

export const textScaleRow = style({
  display: "grid",
  alignItems: "baseline",
  gap: "1rem",
  gridTemplateColumns: "5rem minmax(0, 1fr)",
});
