import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const panel = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
  },
});

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
      flexWrap: "wrap",
    },
  },
});

export const summaryGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "10px",
      "@media": {
        "(max-width: 720px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const titleBlock = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: 0,
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-lg)",
      lineHeight: "var(--line-height-115)",
      fontWeight: 620,
      color: "var(--ds-text-stronger)",
    },
  },
});

export const subtitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-150)",
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
      maxWidth: "56ch",
    },
  },
});

export const list = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
    },
  },
});

export const itemCard = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
  },
});

export const itemHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "space-between",
      gap: "12px",
      alignItems: "flex-start",
    },
  },
});

export const itemTitleBlock = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: 0,
    },
  },
});

export const itemTitle = style({
  "@layer": {
    [layers.features]: {
      textWrap: "pretty",
    },
  },
});

export const itemMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-subtle)",
      lineHeight: "var(--line-height-140)",
    },
  },
});

export const chipRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    },
  },
});

export const summary = style({
  "@layer": {
    [layers.features]: {
      textWrap: "pretty",
    },
  },
});

export const footer = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      flexWrap: "wrap",
    },
  },
});

export const actionRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    },
  },
});

export const footerCopy = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-subtle)",
      lineHeight: "var(--line-height-150)",
      textWrap: "pretty",
    },
  },
});

export const emptyState = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-150)",
      color: "var(--ds-text-subtle)",
    },
  },
});
