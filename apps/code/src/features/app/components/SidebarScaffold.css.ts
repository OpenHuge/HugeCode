import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const frame = style({
  "@layer": {
    [layers.features]: {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: 0,
      minHeight: 0,
      borderRadius: 0,
      paddingTop: "calc(var(--shell-chrome-inset-top, 10px) + 3px)",
      boxSizing: "border-box",
    },
  },
});

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      minWidth: 0,
    },
  },
});

export const body = style({
  "@layer": {
    [layers.features]: {
      flex: "1 1 auto",
      minHeight: 0,
      minWidth: 0,
      display: "grid",
    },
  },
});

export const section = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minWidth: 0,
    },
  },
});

export const footer = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      minWidth: 0,
      marginTop: "auto",
    },
  },
});

export const row = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
    },
  },
});
