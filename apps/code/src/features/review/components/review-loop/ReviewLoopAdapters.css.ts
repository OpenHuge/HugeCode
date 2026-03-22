import { style } from "@vanilla-extract/css";
import { layers } from "../../../../styles/system/layers.css";

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      padding: "16px 18px",
      borderRadius: "20px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 98%, transparent), color-mix(in srgb, var(--ds-surface-base) 94%, transparent))",
      boxShadow:
        "0 18px 36px -34px color-mix(in srgb, var(--ds-shadow-color) 42%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
    },
  },
});

export const headerTopRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
      flexWrap: "wrap",
    },
  },
});

export const headerCopy = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      minWidth: 0,
      flex: 1,
    },
  },
});

export const headerEyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-125)",
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const headerTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(20px, 2vw, 24px)",
      lineHeight: "var(--line-height-110)",
      fontWeight: 640,
      letterSpacing: "-0.03em",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const headerDescription = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "64ch",
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-150)",
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const headerSignals = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      minHeight: "28px",
    },
  },
});

export const section = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      padding: "14px 16px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 90%, transparent), color-mix(in srgb, var(--ds-surface-base) 96%, transparent))",
    },
  },
});

export const sectionBare = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      minWidth: 0,
    },
  },
});

export const sectionHeader = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
    },
  },
});

export const sectionDescription = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-145)",
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const sectionBody = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      minWidth: 0,
    },
  },
});

export const signalGroup = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px",
      minHeight: "26px",
    },
  },
});

export const summaryCard = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      minWidth: 0,
      padding: "14px 14px 12px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-canvas) 98%, transparent), color-mix(in srgb, var(--ds-surface-item) 92%, transparent))",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
      selectors: {
        '&[data-review-summary-tone="attention"]': {
          borderColor: "color-mix(in srgb, var(--ds-accent-warning) 28%, transparent)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--ds-accent-warning) 10%, var(--ds-surface-overlay)), color-mix(in srgb, var(--ds-surface-base) 95%, transparent))",
        },
        '&[data-review-summary-tone="success"]': {
          borderColor: "color-mix(in srgb, var(--ds-accent-success) 24%, transparent)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--ds-accent-success) 10%, var(--ds-surface-overlay)), color-mix(in srgb, var(--ds-surface-base) 95%, transparent))",
        },
      },
    },
  },
});

export const summaryLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      lineHeight: "var(--line-height-125)",
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const summaryValue = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(22px, 2vw, 28px)",
      lineHeight: "var(--line-height-100)",
      fontWeight: 640,
      letterSpacing: "-0.04em",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const summaryDetail = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-145)",
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const actionRail = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      minHeight: "32px",
    },
  },
});

export const evidenceList = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      margin: 0,
      padding: 0,
      listStyle: "none",
    },
  },
});

export const evidenceItem = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 144px) minmax(0, 1fr)",
      gap: "8px 12px",
      alignItems: "baseline",
      padding: "10px 12px",
      borderRadius: "14px",
      background: "color-mix(in srgb, var(--ds-surface-item) 86%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 66%, transparent)",
      "@media": {
        "(max-width: 720px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const evidenceLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-130)",
      fontWeight: 600,
      color: "var(--ds-text-faint)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    },
  },
});

export const evidenceDetail = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-145)",
      color: "var(--ds-text-strong)",
      minWidth: 0,
      textWrap: "pretty",
    },
  },
});
