import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".composer-waveform", {
  "@layer": {
    [layers.features]: {
      "margin-top": "8px",
      padding: "6px 8px",
      "border-radius": "10px",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      display: "flex",
      "align-items": "flex-end",
      gap: "3px",
      height: "40px",
      position: "relative",
    },
  },
});
applyGlobalStyle(".composer-waveform.is-processing", {
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--ds-brand-secondary) 15%, transparent),\n    color-mix(in srgb, var(--status-success) 15%, transparent)\n  )",
    },
  },
});
applyGlobalStyle(".composer-waveform-bar", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "2px",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-brand-secondary) 70%, transparent)",
      transition: "height var(--duration-fast) var(--ease-smooth)",
    },
  },
});
