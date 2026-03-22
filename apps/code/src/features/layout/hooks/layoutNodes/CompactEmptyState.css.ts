import { typographyValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";
import { layers } from "../../../../styles/system/layers.css";

export const root = style({
  "@layer": {
    [layers.features]: {
      width: "min(100%, 360px)",
      margin: "auto",
      padding: "22px 20px",
      borderRadius: "22px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 96%, var(--ds-surface-messages)), color-mix(in srgb, var(--ds-surface-elevated) 86%, transparent))",
      boxShadow:
        "0 28px 46px -40px color-mix(in srgb, var(--ds-shadow-color) 50%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 9%, transparent)",
    },
  },
});

export const kicker = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      fontWeight: "600",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const title = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(22px, 6vw, 28px)",
      fontWeight: "600",
      letterSpacing: "-0.03em",
      lineHeight: typographyValues.titleLg.lineHeight,
      color: "var(--ds-text-stronger)",
      textWrap: "balance",
    },
  },
});

export const copy = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-label)",
      lineHeight: typographyValues.label.lineHeight,
      color: "var(--ds-text-subtle)",
      maxWidth: "30ch",
      textWrap: "pretty",
    },
  },
});

export const actions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      marginTop: "2px",
    },
  },
});
