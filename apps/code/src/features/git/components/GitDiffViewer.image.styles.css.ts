import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const imageContent = style({
  "@layer": {
    [layers.features]: {
      padding: "16px",
    },
  },
});

export const imagePane = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
  },
});

export const imageSideBySide = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
    },
  },
});

export const imageSingle = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "center",
    },
  },
});

export const imageSinglePane = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "50%",
    },
  },
});

export const imagePreview = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "100%",
      maxHeight: "300px",
      objectFit: "contain",
      background:
        "repeating-conic-gradient(var(--ds-surface-control) 0% 25%, var(--ds-surface-card) 0% 50%) 50% / 16px 16px",
    },
  },
});

export const imagePlaceholder = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "6px",
      minHeight: "140px",
      padding: "12px 16px",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-meta)",
      textAlign: "center",
      borderRadius: "8px",
      background: "var(--ds-surface-card)",
      border: "1px solid var(--ds-border-subtle)",
    },
  },
});

export const imagePlaceholderIcon = style({
  "@layer": {
    [layers.features]: {
      width: "20px",
      height: "20px",
      color: "var(--ds-text-faint)",
    },
  },
});

export const imagePlaceholderText = style({
  "@layer": {
    [layers.features]: {
      lineHeight: "var(--line-height-140)",
    },
  },
});

export const imageMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      fontVariantNumeric: "tabular-nums",
      marginTop: "8px",
    },
  },
});
