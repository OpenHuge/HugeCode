import { style } from "@vanilla-extract/css";
import {
  elevationValues,
  focusRingValues,
  motionValues,
  typographyValues,
} from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

export const panel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateRows: "auto minmax(0, 1fr)",
      alignContent: "stretch",
      gap: "10px",
      minHeight: 0,
    },
  },
});

export const count = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-faint)",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.01em",
    },
  },
});

export const headerStack = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      minHeight: "0",
    },
  },
});

export const headerGroup = style({
  "@layer": {
    [layers.features]: {
      padding: "0",
    },
  },
});

export const headerControls = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    },
  },
});

export const toggle = style({
  "@layer": {
    [layers.features]: {
      padding: "4px",
      borderRadius: "6px",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 62%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 36%, transparent)",
      color: "var(--ds-panel-muted)",
      transition: motionValues.interactive,
      selectors: {
        "&:hover, &:focus-visible": {
          borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 82%, transparent)",
          background: "var(--ds-panel-row-hover)",
          color: "var(--ds-panel-value)",
        },
      },
    },
  },
});

export const searchFilter = style({
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
      width: "var(--of-list-row-height, 32px)",
      height: "var(--of-list-row-height, 32px)",
      borderRadius: "6px",
      padding: "0",
      color: "var(--ds-panel-muted)",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 62%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 36%, transparent)",
      transition: motionValues.interactive,
      selectors: {
        "&:hover": {
          color: "var(--ds-panel-value)",
          borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 82%, transparent)",
          background: "var(--ds-panel-row-hover)",
        },
      },
    },
  },
});

export const searchFilterActive = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-panel-selected) 62%, var(--ds-panel-section-bg))",
      color: "var(--ds-panel-value)",
      borderColor:
        "color-mix(in srgb, var(--ds-panel-focus-ring) 34%, var(--ds-panel-section-divider))",
      boxShadow: elevationValues.card,
    },
  },
});

export const list = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      overflowY: "auto",
      flex: "1",
      paddingRight: "2px",
      minHeight: "0",
      scrollbarWidth: "thin",
    },
  },
});

export const virtual = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      width: "100%",
      height: "var(--file-tree-virtual-height, auto)",
    },
  },
});

export const empty = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flex: "1 1 auto",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "0",
      padding: "8px 0 12px",
    },
  },
});

export const skeleton = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "4px 2px",
    },
  },
});

export const skeletonRow = style({
  "@layer": {
    [layers.features]: {
      height: "8px",
      borderRadius: "var(--ds-radius-full)",
      background:
        "linear-gradient(110deg, color-mix(in srgb, var(--ds-color-white) 4%, transparent) 8%, color-mix(in srgb, var(--ds-color-white) 18%, transparent) 18%, color-mix(in srgb, var(--ds-color-white) 4%, transparent) 33%)",
      backgroundSize: "200% 100%",
      selectors: {
        '&[data-width="10"]': { width: "10%" },
        '&[data-width="20"]': { width: "20%" },
        '&[data-width="30"]': { width: "30%" },
        '&[data-width="40"]': { width: "40%" },
        '&[data-width="50"]': { width: "50%" },
        '&[data-width="60"]': { width: "60%" },
        '&[data-width="70"]': { width: "70%" },
        '&[data-width="80"]': { width: "80%" },
        '&[data-width="90"]': { width: "90%" },
        '&[data-width="100"]': { width: "100%" },
      },
    },
  },
});

export const rowWrap = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      minHeight: "var(--of-list-row-height, 32px)",
      selectors: {
        '&[data-depth="0"]': { paddingLeft: "0" },
        '&[data-depth="1"]': { paddingLeft: "10px" },
        '&[data-depth="2"]': { paddingLeft: "20px" },
        '&[data-depth="3"]': { paddingLeft: "30px" },
        '&[data-depth="4"]': { paddingLeft: "40px" },
        '&[data-depth="5"]': { paddingLeft: "50px" },
        '&[data-depth="6"]': { paddingLeft: "60px" },
        '&[data-depth="7"]': { paddingLeft: "70px" },
        '&[data-depth="8"]': { paddingLeft: "80px" },
      },
    },
  },
});

export const row = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ds-space-2)",
      padding: "0 8px",
      minHeight: "var(--of-list-row-height, 32px)",
      borderRadius: "var(--of-list-row-radius, 8px)",
      cursor: "pointer",
      border: "1px solid transparent",
      background: "transparent",
      color: "var(--ds-panel-value)",
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      textAlign: "left",
      width: "100%",
      transition: motionValues.interactive,
      selectors: {
        "&:hover": {
          background: "var(--ds-panel-row-hover)",
          borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 64%, transparent)",
          color: "var(--ds-panel-value)",
        },
        "&:focus-visible": {
          outline: focusRingValues.button,
          outlineOffset: "1px",
          borderColor:
            "color-mix(in srgb, var(--ds-panel-focus-ring) 34%, var(--ds-panel-section-divider))",
          background: "color-mix(in srgb, var(--ds-panel-selected) 54%, transparent)",
        },
      },
    },
  },
});

export const rowFile = style({
  "@layer": {
    [layers.features]: {
      paddingLeft: "26px",
    },
  },
});

export const rowFolder = style({
  "@layer": {
    [layers.features]: {
      fontWeight: "600",
    },
  },
});

export const chevron = style({
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ds-panel-muted)",
      transform: "rotate(0deg)",
      transition: motionValues.press,
    },
  },
});

export const chevronOpen = style({
  "@layer": {
    [layers.features]: {
      transform: "rotate(90deg)",
    },
  },
});

export const spacer = style({
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
    },
  },
});

export const icon = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-panel-muted)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: motionValues.interactive,
      selectors: {
        [`${row}:hover &`]: {
          color: "var(--ds-panel-subtitle)",
        },
      },
    },
  },
});

export const iconImage = style({
  "@layer": {
    [layers.features]: {
      width: "12px",
      height: "12px",
      display: "block",
    },
  },
});

export const name = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      letterSpacing: "0.01em",
    },
  },
});

export const action = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "4px",
      top: "50%",
      transform: "translateY(-50%)",
      opacity: "0",
      pointerEvents: "none",
      padding: "2px",
      border: "none",
      background: "transparent",
      borderRadius: "6px",
      boxShadow: "none",
      color: "var(--ds-panel-muted)",
      transition: motionValues.interactive,
      selectors: {
        "&:hover:not(:disabled)": {
          transform: "translateY(-50%)",
          boxShadow: "none",
        },
        [`${rowWrap}:hover &`]: {
          opacity: "1",
          pointerEvents: "auto",
        },
        "&:hover, &:focus-visible": {
          opacity: "1",
          pointerEvents: "auto",
          color: "var(--ds-panel-value)",
          background: "var(--ds-panel-row-hover)",
        },
      },
    },
  },
});
