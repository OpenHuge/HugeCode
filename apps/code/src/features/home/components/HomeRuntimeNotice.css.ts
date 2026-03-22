import { style } from "@vanilla-extract/css";
import { overlayValues, typographyValues } from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

export const root = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "grid",
      gap: "6px",
      padding: 0,
      border: "none",
      background: "transparent",
    },
  },
});

export const shell = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
      alignItems: "stretch",
    },
  },
});

export const copy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      fontWeight: 620,
      letterSpacing: "-0.015em",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const titleWarning = style({
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-warning) 82%, white)",
    },
  },
});

export const titleError = style({
  "@layer": {
    [layers.features]: {
      color: "var(--color-status-error)",
    },
  },
});

export const body = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-muted)",
      textWrap: "pretty",
    },
  },
});

export const connectionPanel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
    },
  },
});

export const localForm = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
      padding: 0,
      border: "none",
      background: "transparent",
    },
  },
});

export const localInline = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: "6px",
      alignItems: "center",
      "@media": {
        "(max-width: 720px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const targetField = style({
  vars: {
    "--ds-input-radius": "14px",
    "--ds-input-surface":
      "color-mix(in srgb, var(--ds-surface-item) 92%, var(--ds-surface-card-base))",
    "--ds-input-border": "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
    "--ds-input-placeholder": "color-mix(in srgb, var(--ds-text-faint) 84%, transparent)",
  },
  "@layer": {
    [layers.features]: {
      minWidth: "0",
    },
  },
});

export const targetControl = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.title.fontSize,
      lineHeight: typographyValues.title.lineHeight,
    },
  },
});

export const endpointPreview = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-faint)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      paddingLeft: "2px",
    },
  },
});

export const error = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      gap: "8px",
      alignItems: "start",
      padding: "9px 10px",
      borderRadius: "12px",
      border: overlayValues.menuBorder,
      background: "color-mix(in srgb, var(--color-status-error) 6%, var(--ds-surface-item))",
      color: "var(--color-status-error)",
    },
  },
});

export const errorIcon = style({
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
      marginTop: "2px",
      flexShrink: 0,
    },
  },
});

export const errorCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "2px",
      minWidth: 0,
    },
  },
});

export const errorTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 620,
      color: "color-mix(in srgb, var(--color-status-error) 90%, white)",
    },
  },
});

export const errorBody = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "color-mix(in srgb, var(--color-status-error) 76%, white)",
      textWrap: "pretty",
    },
  },
});
