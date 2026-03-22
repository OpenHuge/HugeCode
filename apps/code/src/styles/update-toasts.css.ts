import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".update-toasts", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      bottom: "36px",
      right: "20px",
      width: "min(360px, calc(100vw - 40px))",
      "z-index": "5",
      "pointer-events": "none",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle(".update-toast", {
  "@layer": {
    [layers.features]: {
      "--ds-toast-enter-duration": "0.2s",
      "box-shadow":
        "var(--ds-toast-shadow),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
    },
  },
});
applyGlobalStyle(".update-toast-header", {
  "@layer": { [layers.features]: { "margin-bottom": "6px" } },
});
applyGlobalStyle(".update-toast-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".update-toast-version", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".update-toast-body", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-chrome)", "margin-bottom": "10px" },
  },
});
applyGlobalStyle(".update-toast-progress", {
  "@layer": { [layers.features]: { display: "grid", gap: "6px", "margin-bottom": "4px" } },
});
applyGlobalStyle(".update-toast-progress-bar", {
  "@layer": {
    [layers.features]: {
      appearance: "none",
      "-webkit-appearance": "none",
      display: "block",
      width: "100%",
      height: "6px",
      "border-radius": "999px",
      background: "transparent",
      overflow: "hidden",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
    },
  },
});
applyGlobalStyle(".update-toast-progress-bar::-webkit-progress-bar", {
  "@layer": { [layers.features]: { background: "var(--ds-surface-muted)" } },
});
applyGlobalStyle(".update-toast-progress-bar::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background:
        "linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--ds-brand-secondary) 82%, white),\n    color-mix(in srgb, var(--status-success) 84%, white)\n  )",
      transition:
        "inline-size var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".update-toast-progress-bar::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background:
        "linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--ds-brand-secondary) 82%, white),\n    color-mix(in srgb, var(--status-success) 84%, white)\n  )",
      transition:
        "inline-size var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".update-toast-progress-meta", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-muted)" },
  },
});
applyGlobalStyle(".update-toast-error", {
  "@layer": { [layers.features]: { "margin-bottom": "10px" } },
});
applyGlobalStyle(".update-toast-inline", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
    },
  },
});
applyGlobalStyle(".update-toast-body-inline", {
  "@layer": { [layers.features]: { "margin-bottom": "0" } },
});
applyGlobalStyle(".update-toasts", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 960px)": {
          top: "auto",
          bottom: "96px",
          left: "50%",
          transform: "translateX(-50%)",
        },
      },
    },
  },
});
