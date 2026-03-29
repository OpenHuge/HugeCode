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
      borderRadius: "var(--radius-xl, 16px)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
      backdropFilter: "blur(16px) saturate(1.06)",
      WebkitBackdropFilter: "blur(16px) saturate(1.06)",
      boxShadow:
        "var(--ds-elevation-2), 0 1px 3px color-mix(in srgb, var(--ds-shadow-color) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent)",
    },
  },
});
