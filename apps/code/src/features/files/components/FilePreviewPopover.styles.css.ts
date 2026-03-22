import { style, styleVariants } from "@vanilla-extract/css";
import { elevationValues, overlayValues, typographyValues } from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

export const popover = style({
  "@layer": {
    [layers.features]: {
      borderRadius: "10px",
      padding: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      zIndex: "30",
      position: "fixed",
      top: "var(--file-preview-top, 0px)",
      left: "var(--file-preview-left, 0px)",
      border: overlayValues.menuBorder,
      background: overlayValues.menuSurface,
      boxShadow: overlayValues.menuShadow,
      backdropFilter: overlayValues.menuBackdrop,
      selectors: {
        "&::after": {
          content: '""',
          position: "absolute",
          right: "-8px",
          top: "var(--file-preview-arrow-top, 40px)",
          width: "0",
          height: "0",
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderLeft: "8px solid var(--ds-surface-popover)",
          filter:
            "drop-shadow(0 2px 4px color-mix(in srgb, var(--ds-color-black) 12%, transparent))",
        },
      },
    },
  },
});

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
    },
  },
});

export const headerCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minWidth: "0",
    },
  },
});

export const eyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 600,
      color: "var(--ds-panel-muted)",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: { display: "flex", alignItems: "center", gap: "8px", minWidth: "0" },
  },
});

export const path = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      fontWeight: 600,
      color: "var(--ds-panel-title)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
});

export const headerActions = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      flexShrink: 0,
    },
  },
});

export const close = style({
  "@layer": {
    [layers.features]: {
      padding: "4px",
      color: "var(--ds-panel-muted)",
      borderRadius: "6px",
    },
  },
});

export const status = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const statusError = style({
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-error) 72%, var(--ds-panel-value))",
      borderColor: "color-mix(in srgb, var(--status-error) 28%, var(--ds-panel-section-divider))",
      background: "color-mix(in srgb, var(--status-error) 8%, var(--ds-panel-section-bg))",
    },
  },
});

export const body = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minHeight: "0",
      maxHeight: "70vh",
    },
  },
});

export const bodyImage = style({ "@layer": { [layers.features]: { gap: "12px" } } });

export const image = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "8px",
      overflow: "auto",
      maxHeight: "60vh",
    },
  },
});

export const imageElement = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "100%",
      maxHeight: "58vh",
      objectFit: "contain",
      borderRadius: "8px",
      boxShadow: elevationValues.card,
    },
  },
});

export const toolbar = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
      padding: "8px 9px",
      borderRadius: "7px",
      border: overlayValues.menuBorder,
      background: overlayValues.translucentSurface,
    },
  },
});

export const selection = style({});

export const selectionGroup = style({
  "@layer": {
    [layers.features]: { display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" },
  },
});

export const hints = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      color: "var(--ds-panel-muted)",
    },
  },
});

export const hint = style({ "@layer": { [layers.features]: { whiteSpace: "nowrap" } } });

export const actions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
  },
});

export const action = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      padding: "0 10px",
      minHeight: "28px",
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      borderRadius: "6px",
    },
  },
});

export const actionAdd = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-panel-selected) 58%, var(--ds-panel-section-bg))",
      color: "var(--ds-panel-value)",
      border:
        "1px solid color-mix(in srgb, var(--ds-panel-focus-ring) 24%, var(--ds-panel-section-divider))",
      boxShadow: "none",
      selectors: {
        "&:hover:not(:disabled)": {
          transform: "none",
          boxShadow: "none",
        },
      },
    },
  },
});

export const lines = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "0",
      overflow: "auto",
      borderRadius: "8px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 56%, transparent)",
      background: "var(--ds-panel-code-bg)",
      padding: "4px 0",
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
      fontWeight: "var(--code-font-weight, 400)",
      lineHeight: "var(--code-line-height)",
      color: "var(--ds-text-quiet)",
      whiteSpace: "pre",
    },
  },
});

export const line = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "52px 1fr",
      gap: "10px",
      alignItems: "start",
      padding: "3px 10px",
      minWidth: "100%",
      width: "max-content",
      border: "1px solid transparent",
      borderRadius: "0",
      background: "transparent",
      textAlign: "left",
      cursor: "pointer",
      transition: "none",
      transform: "none",
      boxShadow: "none",
      outline: "none",
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
      fontWeight: "var(--code-font-weight, 400)",
      lineHeight: "var(--code-line-height)",
      selectors: {
        "&:hover, &:active, &:focus, &:focus-visible": {
          transform: "none",
          boxShadow: "none",
        },
        "&:not(.is-selected):hover": {
          background: "var(--ds-panel-row-hover)",
        },
      },
    },
  },
});

export const lineSelected = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-panel-selected) 44%, transparent)",
      borderColor: "transparent",
      boxShadow: elevationValues.card,
    },
  },
});

export const lineNumber = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-panel-muted)",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
    },
  },
});

export const lineText = style({
  "@layer": {
    [layers.features]: { minWidth: "0", overflowWrap: "anywhere", wordBreak: "break-word" },
  },
});

export const syntaxTone = styleVariants({
  comment: { color: "var(--ds-syntax-variable)" },
  punctuation: { color: "var(--ds-text-muted)" },
  danger: { color: "var(--ds-syntax-danger)" },
  warning: { color: "var(--ds-syntax-warning)" },
  success: { color: "var(--ds-syntax-success)" },
  variable: { color: "var(--ds-syntax-variable)" },
  keyword: { color: "var(--ds-syntax-keyword)" },
  function: { color: "var(--ds-syntax-function)" },
});
