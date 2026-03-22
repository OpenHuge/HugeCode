import { style, styleVariants } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const panel = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      minHeight: 0,
      height: "100%",
    },
  },
});

export const sectionBody = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      minHeight: 0,
    },
  },
});

export const artifactCard = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
  },
});

export const artifactHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      flexWrap: "wrap",
    },
  },
});

export const artifactKicker = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-130)",
      fontWeight: 600,
      letterSpacing: "0.01em",
      textTransform: "uppercase",
      color: "var(--ds-panel-muted)",
    },
  },
});

export const artifactTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-135)",
      fontWeight: 600,
      color: "var(--ds-panel-title)",
    },
  },
});

export const artifactPreview = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-155)",
      color: "var(--ds-panel-subtitle)",
      whiteSpace: "pre-wrap",
    },
  },
});

export const artifactBody = style({
  "@layer": {
    [layers.features]: {
      paddingTop: "10px",
      borderTop: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 54%, transparent)",
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-155)",
      color: "var(--ds-panel-value)",
      whiteSpace: "pre-wrap",
      maxHeight: "220px",
      overflowY: "auto",
    },
  },
});

export const explanation = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-155)",
      color: "var(--ds-panel-subtitle)",
      whiteSpace: "pre-wrap",
    },
  },
});

export const stepList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      margin: 0,
      padding: 0,
      listStyle: "none",
      minHeight: 0,
    },
  },
});

export const stepRow = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      gap: "10px",
      alignItems: "start",
      padding: "7px 9px",
      borderRadius: "7px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 54%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 44%, transparent)",
    },
  },
});

export const stepStatus = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "42px",
      minHeight: "20px",
      padding: "0 7px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 64%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 68%, transparent)",
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-100)",
      color: "var(--ds-panel-label)",
    },
  },
});

export const stepStatusTone = styleVariants({
  default: {},
  progress: {
    color: "var(--ds-panel-value)",
    borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 68%, transparent)",
    background: "color-mix(in srgb, var(--ds-panel-selected) 68%, transparent)",
  },
  success: {
    color: "var(--status-success)",
    borderColor: "color-mix(in srgb, var(--status-success) 28%, transparent)",
    background: "color-mix(in srgb, var(--status-success) 10%, transparent)",
  },
  warning: {
    color: "var(--status-warning)",
    borderColor: "color-mix(in srgb, var(--status-warning) 34%, transparent)",
    background: "color-mix(in srgb, var(--status-warning) 12%, transparent)",
  },
  error: {
    color: "var(--status-error)",
    borderColor: "color-mix(in srgb, var(--status-error) 34%, transparent)",
    background: "color-mix(in srgb, var(--status-error) 10%, transparent)",
  },
  muted: {
    color: "var(--ds-panel-muted)",
    borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 52%, transparent)",
    background: "color-mix(in srgb, var(--ds-panel-section-bg) 60%, transparent)",
    opacity: 0.88,
  },
});

export const stepText = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-150)",
      color: "var(--ds-panel-value)",
      overflowWrap: "anywhere",
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
