import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const summaryActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
  },
});

export const hint = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-150)",
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const warning = style({
  "@layer": {
    [layers.features]: {
      padding: "9px 10px",
      borderRadius: "7px",
      border:
        "1px solid color-mix(in srgb, var(--status-warning) 24%, var(--ds-panel-section-divider))",
      background: "color-mix(in srgb, var(--status-warning) 8%, var(--ds-panel-section-bg))",
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-155)",
      color: "var(--ds-panel-value)",
    },
  },
});

export const listShell = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      overflow: "auto",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      borderRadius: "8px",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 44%, transparent)",
    },
  },
});

export const compactList = style({
  "@layer": {
    [layers.features]: {
      height: "220px",
    },
  },
});

export const largeList = style({
  "@layer": {
    [layers.features]: {
      height: "280px",
    },
  },
});

export const virtualList = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      width: "100%",
      height: "var(--distributed-task-graph-virtual-height, auto)",
    },
  },
});

export const staticList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
    },
  },
});

export const groupRowBase = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 10px",
      minHeight: "30px",
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-120)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "var(--ds-panel-muted)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 64%, transparent)",
      borderBottom:
        "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 62%, transparent)",
    },
  },
});

export const nodeRowBase = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      minHeight: "44px",
      padding: "7px 10px",
      borderBottom:
        "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 54%, transparent)",
    },
  },
});

export const absoluteRow = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: 0,
      right: 0,
    },
  },
});

export const nodeMain = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "3px",
    },
  },
});

export const nodeTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-140)",
      color: "var(--ds-panel-value)",
    },
  },
});

export const nodeMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "6px",
      minWidth: 0,
    },
  },
});

export const metaToken = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "18px",
      padding: "0 6px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 58%, transparent)",
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-120)",
      color: "var(--ds-panel-muted)",
      whiteSpace: "nowrap",
    },
  },
});

export const nodeControl = style({
  "@layer": {
    [layers.features]: {
      width: "28px",
      height: "28px",
      minWidth: "28px",
      padding: 0,
      borderRadius: "6px",
    },
  },
});

export const drawer = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      padding: "10px",
      borderRadius: "8px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 44%, transparent)",
    },
  },
});

export const drawerHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "8px",
    },
  },
});

export const drawerHeaderCopy = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
    },
  },
});

export const drawerEyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-130)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "var(--ds-panel-muted)",
    },
  },
});

export const drawerTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-140)",
      fontWeight: 600,
      color: "var(--ds-panel-value)",
    },
  },
});

export const drawerActions = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "8px",
      "@media": {
        "(max-width: 360px)": {
          gridTemplateColumns: "1fr",
        },
      },
    },
  },
});

export const actionButton = style({
  "@layer": {
    [layers.features]: {
      justifyContent: "center",
    },
  },
});

export const helperText = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-150)",
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const helperTextError = style({
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-error) 62%, var(--ds-panel-value))",
    },
  },
});
