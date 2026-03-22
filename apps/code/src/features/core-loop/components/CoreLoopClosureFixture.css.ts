import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-base) 98%, transparent), color-mix(in srgb, var(--ds-surface-canvas) 94%, transparent))",
});

export const stack = style({
  display: "grid",
  gap: "16px",
});

export const shell = style({
  maxWidth: "1600px",
  margin: "0 auto",
});

export const sectionStack = style({
  display: "grid",
  gap: "14px",
  minWidth: 0,
});

export const stateGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  minWidth: 0,
  "@media": {
    "(max-width: 1200px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "(max-width: 820px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
});

export const timelineHost = style({
  minWidth: 0,
  minHeight: "280px",
  display: "flex",
  borderRadius: "18px",
  overflow: "hidden",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-base) 92%, transparent)",
});

export const activeTimelineHost = style({
  minWidth: 0,
  minHeight: "360px",
  display: "flex",
  borderRadius: "20px",
  overflow: "hidden",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-base) 94%, transparent)",
});

export const composerHost = style({
  minWidth: 0,
  padding: "12px 14px",
  borderRadius: "18px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 66%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 90%, transparent)",
});
