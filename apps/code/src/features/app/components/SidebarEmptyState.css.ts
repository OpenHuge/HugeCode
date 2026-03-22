import { typographyValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const card = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "14px",
      width: "100%",
      textAlign: "left",
      padding: "18px 18px 17px",
      borderRadius: "18px",
      background: "var(--ds-surface-card-base)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent)",
    },
  },
});

export const icon = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "32px",
      height: "32px",
      borderRadius: "11px",
      background: "color-mix(in srgb, var(--ds-brand-primary) 10%, var(--ds-surface-item))",
      color: "var(--ds-text-strong)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 10%, transparent)",
      flexShrink: "0",
      selectors: {
        [`${card}[data-state="runtime"] &, ${card}[data-state="error"] &`]: {
          background: "color-mix(in srgb, var(--status-warning) 14%, var(--ds-surface-item))",
          color: "color-mix(in srgb, var(--status-warning) 68%, var(--ds-text-strong))",
        },
      },
    },
  },
});

export const copy = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      width: "100%",
      minWidth: "0",
    },
  },
});

export const kicker = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      fontWeight: "600",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "color-mix(in srgb, var(--ds-text-faint) 92%, var(--ds-text-muted))",
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(1.55rem, 1.2rem + 0.8vw, 1.9rem)",
      fontWeight: "700",
      color: "var(--ds-text-stronger)",
      lineHeight: typographyValues.title.lineHeight,
      letterSpacing: "-0.03em",
      textWrap: "balance",
    },
  },
});

export const body = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "color-mix(in srgb, var(--ds-text-muted) 94%, var(--ds-text-faint))",
      lineHeight: typographyValues.fine.lineHeight,
      textWrap: "pretty",
      maxWidth: "28ch",
    },
  },
});

export const cta = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "36px",
      padding: "0 14px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 90%, var(--ds-surface-item))",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
      color: "var(--ds-text-strong)",
      fontSize: "var(--font-size-micro)",
      fontWeight: "600",
      letterSpacing: "0.02em",
      boxShadow: "none",
      selectors: {
        [`${card}[data-state="runtime"] &, ${card}[data-state="error"] &`]: {
          background:
            "color-mix(in srgb, var(--status-warning) 10%, var(--ds-surface-control-hover))",
          border:
            "1px solid color-mix(in srgb, var(--status-warning) 20%, var(--ds-border-subtle))",
        },
      },
    },
  },
});
