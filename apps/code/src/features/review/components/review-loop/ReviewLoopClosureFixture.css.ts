import { style } from "@vanilla-extract/css";
import { layers } from "../../../../styles/system/layers.css";

export const page = style({
  "@layer": {
    [layers.features]: {
      minHeight: "100vh",
      padding: "24px",
      background:
        "radial-gradient(circle at top, color-mix(in srgb, var(--ds-accent-primary) 10%, transparent), transparent 28%), linear-gradient(180deg, var(--ds-surface-canvas), color-mix(in srgb, var(--ds-surface-base) 96%, transparent))",
    },
  },
});

export const stack = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "16px",
      maxWidth: "1500px",
      margin: "0 auto",
    },
  },
});

export const split = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
      gap: "16px",
      alignItems: "start",
      "@media": {
        "(max-width: 1180px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const cluster = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "16px",
    },
  },
});

export const rail = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "16px",
    },
  },
});

export const parityGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "12px",
    },
  },
});

export const parityCard = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 78%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-raised) 92%, transparent), color-mix(in srgb, var(--ds-surface-base) 97%, transparent))",
    },
  },
});

export const parityHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
    },
  },
});

export const parityDetails = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
    },
  },
});
