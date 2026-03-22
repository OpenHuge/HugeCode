import { style } from "@vanilla-extract/css";
import { layers } from "../../styles/system/layers.css";

export const compactModalCard = style({
  "@layer": {
    [layers.features]: {
      width: "min(420px, calc(100vw - 48px))",
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      boxShadow:
        "var(--ds-elevation-2), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
    },
  },
});
