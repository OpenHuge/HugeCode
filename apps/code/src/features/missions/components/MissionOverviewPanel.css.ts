import { style } from "@vanilla-extract/css";
import {
  elevationValues,
  focusRingValues,
  motionValues,
  typographyValues,
} from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

export const panel = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      padding: "16px 18px 14px",
      borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 96%, transparent), color-mix(in srgb, var(--ds-surface-base) 98%, transparent))",
      "@media": {
        "(max-width: 640px)": {
          padding: "14px 16px 12px",
        },
      },
    },
  },
});

export const eyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.title.fontSize,
      lineHeight: typographyValues.title.lineHeight,
      fontWeight: 620,
      color: "var(--ds-text-stronger)",
    },
  },
});

export const subtitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const summaryGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "10px",
      "@media": {
        "(max-width: 900px)": {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
      },
    },
  },
});

export const summaryValue = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(24px, 2.8vw, 30px)",
      lineHeight: typographyValues.displaySm.lineHeight,
      fontWeight: 640,
      letterSpacing: "-0.04em",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const summaryHint = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
    },
  },
});

export const missionList = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "10px",
      "@media": {
        "(max-width: 900px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const missionButton = style({
  "@layer": {
    [layers.features]: {
      appearance: "none",
      WebkitAppearance: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "10px",
      width: "100%",
      padding: "14px 14px 12px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-canvas) 96%, transparent)",
      color: "inherit",
      textAlign: "left",
      cursor: "pointer",
      transition: motionValues.interactive,
      selectors: {
        "&:hover": {
          borderColor: "color-mix(in srgb, var(--ds-border-strong) 70%, transparent)",
          background: "color-mix(in srgb, var(--ds-surface-overlay) 98%, transparent)",
          transform: "translateY(-1px)",
        },
        "&:focus-visible": {
          outline: focusRingValues.button,
          outlineOffset: "2px",
        },
      },
    },
  },
});

export const missionButtonActive = style({
  "@layer": {
    [layers.features]: {
      borderColor: "color-mix(in srgb, var(--ds-accent-primary) 35%, var(--ds-border-strong))",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-accent-primary) 12%, var(--ds-surface-overlay)), color-mix(in srgb, var(--ds-surface-canvas) 98%, transparent))",
      boxShadow: elevationValues.card,
    },
  },
});

export const missionHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
    },
  },
});

export const missionTitleBlock = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: 0,
    },
  },
});

export const missionTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.label.fontSize,
      lineHeight: typographyValues.label.lineHeight,
      fontWeight: 610,
      color: "var(--ds-text-stronger)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const missionMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
      whiteSpace: "nowrap",
    },
  },
});

export const missionSummary = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
      textWrap: "pretty",
      minHeight: "2.8em",
    },
  },
});

export const operatorSignal = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-strong)",
      fontWeight: 560,
      textWrap: "pretty",
    },
  },
});

export const missionDetail = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const attentionSignals = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
    },
  },
});

export const emptyState = style({
  "@layer": {
    [layers.features]: {
      padding: "16px 2px 2px",
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
    },
  },
});
