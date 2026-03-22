import { type StyleRule, style } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

function feature(rule: StyleRule) {
  return style({ "@layer": { [layers.features]: rule } });
}

export const modalCard = feature({
  width: "min(520px, calc(100vw - 48px))",
  borderRadius: "16px",
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow:
    "var(--ds-elevation-2), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
});

export const pathInput = feature({
  minHeight: "40px",
  height: "40px",
  padding: "8px 10px",
  resize: "none",
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  selectors: {
    "&::-webkit-scrollbar": {
      width: "0",
      height: "0",
    },
  },
});

export const row = feature({
  display: "flex",
  gap: "8px",
  alignItems: "center",
});

export const field = feature({
  flex: "1",
  minWidth: "0",
});

export const suggested = feature({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const suggestedLabel = feature({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: "var(--ds-text-faint)",
});

export const suggestedPath = feature({
  vars: {
    "--ds-textarea-border": "color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
    "--ds-textarea-surface": "color-mix(in srgb, var(--ds-surface-muted) 82%, transparent)",
    "--ds-textarea-text": "var(--ds-text-subtle)",
  } as never,
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
});

export const button = feature({
  whiteSpace: "nowrap",
});
