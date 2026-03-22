import { type GlobalStyleRule, globalKeyframes, globalStyle } from "@vanilla-extract/css";
import { layers } from "./system/layers.css";

globalStyle(".plan-panel", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      "-webkit-app-region": "no-drag",
      height: "100%",
      "min-height": "0",
      margin: "0",
      padding: "0",
      background: "transparent",
      border: "none",
      "border-radius": "0",
      "box-shadow": "none",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".context-panel-content .plan-panel", {
  "@layer": {
    [layers.features]: {
      background: "transparent",
      border: "none",
      "border-radius": "0",
      margin: "0",
      padding: "0",
      "box-shadow": "none",
      gap: "10px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      gap: "10px",
      "font-size": "var(--font-size-title)",
      "font-weight": "680",
      "letter-spacing": "-0.02em",
      color: "var(--ds-text-stronger)",
      "padding-bottom": "4px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-progress", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "min-height": "28px",
      padding: "0 11px",
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 86%, transparent), color-mix(in srgb, var(--ds-surface-app) 72%, transparent))",
      "font-size": "var(--font-size-micro)",
      "font-weight": "650",
      "letter-spacing": "0.06em",
      "text-transform": "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-explanation", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-subtle)",
      "white-space": "pre-wrap",
      padding: "14px 15px",
      "border-radius": "18px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 58%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 84%, transparent), color-mix(in srgb, var(--ds-surface-app) 58%, transparent))",
      "line-height": "var(--line-height-160)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-empty", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "min-height": "148px",
      padding: "22px",
      "border-radius": "22px",
      border: "1px dashed color-mix(in srgb, var(--ds-border-subtle) 54%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-muted) 34%, transparent), color-mix(in srgb, var(--ds-surface-app) 52%, transparent))",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-faint)",
      "text-align": "center",
      "line-height": "var(--line-height-160)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-empty.is-processing", {
  "@layer": {
    [layers.features]: {
      animation: "plan-empty-pulse var(--ds-motion-pulse-duration, 1.4s) ease-in-out infinite",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "overflow-y": "auto",
      "min-height": "0",
      "padding-right": "2px",
      margin: "0",
      "padding-left": "0",
      "list-style": "none",
      "scrollbar-width": "thin",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "10px",
      "align-items": "flex-start",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-emphasis)",
      padding: "10px 12px",
      "border-radius": "16px",
      border: "1px solid transparent",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 72%, transparent), color-mix(in srgb, var(--ds-surface-app) 48%, transparent))",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
      transition:
        "border-color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-hover) 62%, transparent), color-mix(in srgb, var(--ds-surface-app) 48%, transparent))",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent), 0 12px 24px color-mix(in srgb, var(--ds-shadow-color) 8%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step-status", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "min-width": "42px",
      "min-height": "24px",
      padding: "0 8px",
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 48%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 84%, transparent), color-mix(in srgb, var(--ds-surface-app) 68%, transparent))",
      "font-family": "var(--code-font-family)",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-faint)",
      flex: "0 0 auto",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step.inProgress .plan-step-status", {
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--ds-brand-secondary) 68%, var(--ds-text-strong))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step.inProgress", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 56%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-active) 34%, var(--ds-surface-card-base))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step.completed .plan-step-status", {
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-success) 72%, var(--ds-text-strong))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step.completed", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-success) 36%, var(--ds-border-subtle))",
      background: "color-mix(in srgb, var(--status-success) 6%, var(--ds-surface-card-base))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".plan-step-text", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      "word-break": "break-word",
      "line-height": "var(--line-height-155)",
    },
  },
} as unknown as GlobalStyleRule);
globalKeyframes("plan-empty-pulse", {
  "0%,\n  100%": { opacity: "0.5" },
  "50%": { opacity: "1" },
});
