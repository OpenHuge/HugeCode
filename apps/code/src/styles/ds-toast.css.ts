import { type GlobalStyleRule, globalKeyframes, globalStyle } from "@vanilla-extract/css";
import { layers } from "./system/layers.css";

globalStyle(".ds-toast-viewport", {
  "@layer": { [layers.components]: { display: "grid", gap: "12px" } },
} as unknown as GlobalStyleRule);
globalStyle(".ds-toast-card", {
  "@layer": {
    [layers.components]: {
      background: "var(--ds-toast-bg)",
      border: "1px solid var(--ds-toast-border)",
      "box-shadow": [
        "var(--ds-toast-shadow)",
        "var(--ds-toast-shadow),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 34%, transparent)",
      ],
      "border-radius": "12px",
      padding: "12px",
      "pointer-events": "auto",
      "max-width": "100%",
      animation: "ds-toast-in var(--ds-toast-enter-duration, 0.2s) ease-out",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".ds-toast-title", {
  "@layer": { [layers.components]: { color: "var(--ds-toast-title)", "font-weight": "600" } },
} as unknown as GlobalStyleRule);
globalStyle(".ds-toast-body", {
  "@layer": {
    [layers.components]: {
      color: "var(--ds-toast-body)",
      "overflow-wrap": "anywhere",
      "word-break": "break-word",
      "line-height": "var(--line-height-145)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".ds-toast-header", {
  "@layer": {
    [layers.components]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".ds-toast-actions", {
  "@layer": {
    [layers.components]: {
      display: "flex",
      gap: "8px",
      "justify-content": "flex-end",
      "flex-wrap": "wrap",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".ds-toast-error", {
  "@layer": {
    [layers.components]: {
      "font-family": "var(--code-font-family)",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      "white-space": "pre-wrap",
      "max-height": "120px",
      overflow: "auto",
      "border-radius": "8px",
      background: "var(--ds-surface-muted)",
      padding: "8px",
      margin: "0",
      "overflow-wrap": "anywhere",
      "word-break": "break-word",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 90%, transparent)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalKeyframes("ds-toast-in", {
  from: { opacity: "0", transform: "translateY(var(--ds-toast-enter-y, -6px))" },
  to: { opacity: "1", transform: "translateY(0)" },
});
