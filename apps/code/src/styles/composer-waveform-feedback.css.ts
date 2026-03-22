import { type GlobalStyleRule, globalKeyframes, globalStyle } from "@vanilla-extract/css";
import { layers } from "./system/layers.css";

globalStyle(".composer-waveform-bar--l1", {
  "@layer": {
    [layers.features]: {
      height: "5%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l2", {
  "@layer": {
    [layers.features]: {
      height: "10%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l3", {
  "@layer": {
    [layers.features]: {
      height: "15%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l4", {
  "@layer": {
    [layers.features]: {
      height: "20%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l5", {
  "@layer": {
    [layers.features]: {
      height: "25%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l6", {
  "@layer": {
    [layers.features]: {
      height: "30%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l7", {
  "@layer": {
    [layers.features]: {
      height: "35%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l8", {
  "@layer": {
    [layers.features]: {
      height: "40%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l9", {
  "@layer": {
    [layers.features]: {
      height: "45%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l10", {
  "@layer": {
    [layers.features]: {
      height: "50%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l11", {
  "@layer": {
    [layers.features]: {
      height: "55%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l12", {
  "@layer": {
    [layers.features]: {
      height: "60%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l13", {
  "@layer": {
    [layers.features]: {
      height: "65%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l14", {
  "@layer": {
    [layers.features]: {
      height: "70%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l15", {
  "@layer": {
    [layers.features]: {
      height: "75%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l16", {
  "@layer": {
    [layers.features]: {
      height: "80%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l17", {
  "@layer": {
    [layers.features]: {
      height: "85%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l18", {
  "@layer": {
    [layers.features]: {
      height: "90%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l19", {
  "@layer": {
    [layers.features]: {
      height: "95%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-bar--l20", {
  "@layer": {
    [layers.features]: {
      height: "100%",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-waveform-label", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      inset: "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-fine)",
      "letter-spacing": "0.02em",
      "text-transform": "uppercase",
      color: "var(--ds-text-subtle)",
      "pointer-events": "none",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action.is-stop", {
  "@layer": {
    [layers.features]: {
      width: "36px",
      height: "36px",
      color: "var(--ds-text-strong)",
      "border-color": "color-mix(in srgb, var(--ds-border-strong) 22%, transparent)",
      background: "color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-surface-popover) 4%)",
      "box-shadow":
        "0 10px 24px -16px color-mix(in srgb, var(--ds-shadow-color) 30%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 12%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action:hover", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 92%, var(--ds-surface-item))",
      "border-color": "color-mix(in srgb, var(--ds-border-strong) 84%, transparent)",
      color: "var(--ds-text-strong)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-border-accent-soft) 72%, transparent)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 70%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(':root[data-theme="light"] .composer-action', {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-control) 80%, var(--ds-color-white))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(':root[data-theme="light"] .composer-action:hover', {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 84%, var(--ds-color-white))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(":root:not([data-theme]) .composer-action", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(prefers-color-scheme: light)": {
          background: "color-mix(in srgb, var(--ds-surface-control) 80%, var(--ds-color-white))",
        },
      },
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(":root:not([data-theme]) .composer-action:hover", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(prefers-color-scheme: light)": {
          background:
            "color-mix(in srgb, var(--ds-surface-control-hover) 84%, var(--ds-color-white))",
        },
      },
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action.is-stop:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-strong) 28%, transparent)",
      background:
        "color-mix(in srgb, var(--ds-color-white) 92%, var(--ds-surface-control-hover) 8%)",
      color: "var(--ds-text-strong)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action-stop-square", {
  "@layer": {
    [layers.features]: {
      display: "block",
      width: "10px",
      height: "10px",
      "border-radius": "3px",
      background: "currentColor",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action-spinner", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      width: "18px",
      height: "18px",
      "border-radius": "999px",
      border: "2px solid color-mix(in srgb, var(--status-error) 35%, transparent)",
      "border-top-color": "color-mix(in srgb, var(--status-error) 90%, transparent)",
      animation: "composer-action-spin var(--ds-motion-spin-duration, 0.88s) linear infinite",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action.is-loading", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 72%, transparent)",
      background:
        "var(\n    --ds-state-loading-bg,\n    color-mix(in srgb, var(--ds-surface-active) 38%, var(--ds-surface-control))\n  )",
      "box-shadow":
        "0 0 0 1px\n    var(--ds-state-loading-ring, color-mix(in srgb, var(--ds-border-accent-soft) 42%, transparent))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer.is-disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "0.7",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer textarea:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "0.6",
      cursor: "not-allowed",
      color: "var(--ds-text-fainter)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action:disabled,\n.composer-action.is-disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "var(--ds-state-disabled-opacity, 0.58)",
      cursor: "not-allowed",
      background: "var(--ds-state-disabled-bg, var(--ds-surface-control-disabled))",
      color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
      "border-color": "var(--ds-state-disabled-border, var(--ds-border-subtle))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-action.is-stop:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      cursor: "not-allowed",
      "border-color": "color-mix(in srgb, var(--ds-border-strong) 22%, transparent)",
      background: "color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-surface-popover) 4%)",
      color: "var(--ds-text-strong)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-select:disabled", {
  "@layer": {
    [layers.features]: {
      cursor: "not-allowed",
      color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
      "background-image": "none",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestions", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "0",
      right: "auto",
      bottom: "calc(100% + 10px)",
      top: "auto",
      "z-index": "20",
      display: "grid",
      gap: "4px",
      padding: "6px",
      "border-radius": "12px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-popover) 96%, var(--ds-surface-card-base))",
      "box-shadow":
        "0 20px 36px -18px color-mix(in srgb, var(--ds-brand-background) 44%, transparent)",
      "backdrop-filter": "blur(12px)",
      width: "min(100%, 460px)",
      "max-height": "280px",
      "overflow-y": "auto",
      "overflow-x": "hidden",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
      "text-align": "left",
      border: "1px solid transparent",
      "border-radius": "10px",
      padding: "8px 10px",
      background: "transparent",
      color: "var(--ds-text-strong)",
      cursor: "pointer",
      width: "100%",
      "min-width": "0",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-section", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "font-weight": "700",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      color: "var(--ds-text-faint)",
      padding: "6px 8px 2px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion:hover,\n.composer-suggestion.is-active", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-item) 98%, var(--ds-surface-card-base))",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-border-accent-soft) 70%, transparent)",
      "outline-offset": "1px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "flex-start",
      gap: "8px",
      "min-width": "0",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-icon", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      width: "16px",
      height: "16px",
      color: "var(--ds-text-muted)",
      flex: "0 0 auto",
      "margin-top": "1px",
      transition: "color var(--duration-fast) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(
  ".composer-suggestion:hover .composer-suggestion-icon,\n.composer-suggestion.is-active .composer-suggestion-icon",
  {
    "@layer": {
      [layers.features]: {
        color: "var(--ds-text-stronger)",
      },
    },
  } as unknown as GlobalStyleRule
);
globalStyle(".composer-suggestion-icon svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-icon-image", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
      display: "block",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-content", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
      "min-width": "0",
      flex: "1",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      width: "100%",
      "white-space": "normal",
      "overflow-wrap": "anywhere",
      "word-break": "break-word",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-description", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-muted)",
      width: "100%",
      "white-space": "normal",
      "overflow-wrap": "anywhere",
      "word-break": "break-word",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".composer-suggestion-description--skill", {
  "@layer": {
    [layers.features]: {
      display: "-webkit-box",
      "-webkit-box-orient": "vertical",
      "-webkit-line-clamp": "2",
      "line-clamp": "2",
      overflow: "hidden",
    },
  },
} as unknown as GlobalStyleRule);
globalKeyframes("composer-action-spin", {
  from: {
    transform: "rotate(0deg)",
  },
  to: {
    transform: "rotate(360deg)",
  },
});
globalKeyframes("composer-runtime-pulse", {
  "0%": {
    boxShadow: "0 0 0 0 color-mix(in srgb, var(--status-success) 42%, transparent)",
  },
  "70%": {
    boxShadow: "0 0 0 6px color-mix(in srgb, var(--status-success) 0%, transparent)",
  },
  "100%": {
    boxShadow: "0 0 0 0 color-mix(in srgb, var(--status-success) 0%, transparent)",
  },
});
