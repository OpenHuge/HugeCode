import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const root = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      borderRadius: "14px",
    },
  },
});

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
      flexWrap: "wrap",
    },
  },
});

export const headerCopy = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: "0",
      flex: "1 1 180px",
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
    },
  },
});

export const summary = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
    },
  },
});

export const blockedReason = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      color: "var(--ds-syntax-warning)",
    },
  },
});

export const fieldList = style({
  "@layer": {
    [layers.features]: {
      gap: "8px",
    },
  },
});

export const field = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
  },
});

export const fieldDetail = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      paddingLeft: "12px",
      overflowWrap: "anywhere",
    },
  },
});
