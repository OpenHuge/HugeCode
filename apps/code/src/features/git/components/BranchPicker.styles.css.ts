import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

const monoFamily = 'var(--code-font-family, Menlo, Monaco, "Courier New", monospace)';

export const listBase = style({
  "@layer": {
    [layers.features]: {
      padding: "6px",
      overflowY: "auto",
      scrollbarWidth: "thin",
    },
  },
});

export const emptyBase = style({
  "@layer": {
    [layers.features]: {
      padding: "12px",
      textAlign: "center",
    },
  },
});

export const itemBase = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      padding: "8px 10px",
      border: "1px solid transparent",
      background: "transparent",
      color: "var(--ds-text-strong)",
      fontSize: "var(--font-size-chrome)",
      textAlign: "left",
      cursor: "pointer",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:focus-visible": {
      outline: "2px solid var(--ds-focus-ring)",
      outlineOffset: "1px",
    },
  },
});

export const itemName = style({
  "@layer": {
    [layers.features]: {
      flex: "1",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontFamily: monoFamily,
    },
  },
});
