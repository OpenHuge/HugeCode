import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".account-pools-empty-state", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-md)",
      border: "1px dashed color-mix(in srgb, var(--ds-border-muted) 84%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 52%, transparent)",
      color: "var(--ds-text-subtle)",
      padding: "12px",
    },
  },
});
