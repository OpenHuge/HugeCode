import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const panel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "12px",
      minHeight: 0,
    },
  },
});

export const headerBody = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      minHeight: 0,
    },
  },
});

export const panelScroll = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "14px",
      minHeight: 0,
      overflowY: "auto",
      paddingRight: "2px",
      scrollbarWidth: "thin",
    },
  },
});
