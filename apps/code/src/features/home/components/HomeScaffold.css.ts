import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const frame = style({
  "@layer": {
    [layers.features]: {
      height: "100%",
      width: "100%",
      display: "grid",
      gridTemplateRows: "minmax(0, 1fr) auto",
      minWidth: 0,
    },
  },
});

export const hero = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "16px",
      width: "100%",
      minWidth: 0,
    },
  },
});

export const section = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      minWidth: 0,
    },
  },
});

export const listRow = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
    },
  },
});

export const dock = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      minWidth: 0,
    },
  },
});
