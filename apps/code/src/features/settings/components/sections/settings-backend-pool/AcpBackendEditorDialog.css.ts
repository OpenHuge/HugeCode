import { style } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";
import { layers } from "../../../../../styles/system/layers.css";

export const card = style({
  "@layer": {
    [layers.features]: {
      width: "min(560px, calc(100vw - 48px))",
      maxHeight: "min(760px, calc(100vh - 48px))",
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      overflow: "auto",
    },
  },
});

export const form = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    },
  },
});

export const textarea = style({
  "@layer": {
    [layers.features]: {
      minHeight: "92px",
      resize: "vertical",
    },
  },
});

export const keyValueList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
  },
});

export const keyValueRow = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
      gap: "8px",
      alignItems: "center",
    },
  },
});

export const keyValueEntry = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
  },
});

export const keyValueRowError = style({
  "@layer": {
    [layers.features]: {
      color: "var(--status-error)",
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
    },
  },
});

export const keyValueActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "flex-start",
    },
  },
});

export const checkboxRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
  },
});

export const sectionTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
  },
});
