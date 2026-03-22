import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".settings-project-name", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".settings-project-path", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
    },
  },
});
applyGlobalStyle(".settings-overrides", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".settings-override-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
      padding: "10px 12px",
      "border-radius": "var(--ds-radius-md)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".settings-override-row:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 76%, var(--ds-surface-card-base))",
    },
  },
});
applyGlobalStyle(".settings-override-info", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".settings-override-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      gap: "8px",
      "min-width": "280px",
    },
  },
});
applyGlobalStyle(".settings-override-field", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
    },
  },
});
