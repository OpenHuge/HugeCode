import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const suggestionMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "6px",
      width: "100%",
    },
  },
});

export const suggestionMetaChip = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "18px",
      padding: "1px 7px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control) 74%, transparent)",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-micro)",
      fontWeight: "560",
      letterSpacing: "0.01em",
    },
  },
});

export const suggestionMetaChipSkill = style({
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--ds-surface-control) 86%, transparent), color-mix(in srgb, var(--ds-brand-primary) 10%, transparent))",
      color: "color-mix(in srgb, var(--ds-brand-primary) 70%, var(--ds-text-strong))",
      borderColor: "color-mix(in srgb, var(--ds-brand-primary) 20%, var(--ds-border-subtle))",
    },
  },
});
