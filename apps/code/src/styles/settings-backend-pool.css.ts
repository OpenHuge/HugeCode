import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".settings-backend-pool", {
  "@layer": {
    [layers.features]: {
      border: "1px solid transparent",
      "border-radius": "var(--ds-radius-md)",
      padding: "11px 12px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 60%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-metrics", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(4, minmax(0, 1fr))",
      gap: "8px",
      "margin-top": "8px",
      "margin-bottom": "0",
      padding: "0",
      "list-style": "none",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-metric", {
  "@layer": {
    [layers.features]: {
      border: "1px solid transparent",
      "border-radius": "var(--ds-radius-sm)",
      padding: "7px 8px",
      background: "color-mix(in srgb, var(--ds-surface-muted) 58%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-metric-label", {
  "@layer": {
    [layers.features]: {
      display: "block",
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.06em",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-metric-value", {
  "@layer": {
    [layers.features]: {
      display: "block",
      "margin-top": "2px",
      "font-size": "var(--font-size-label)",
      "font-weight": "650",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-actions-top", {
  "@layer": {
    [layers.features]: {
      "margin-top": "8px",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "margin-top": "10px",
      "margin-bottom": "0",
      padding: "0",
      "list-style": "none",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "10px",
      border: "1px solid transparent",
      "border-radius": "var(--ds-radius-sm)",
      padding: "8px 10px",
      background: "color-mix(in srgb, var(--ds-surface-item) 72%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-row-main", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-row-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-row-meta", {
  "@layer": {
    [layers.features]: {
      "margin-top": "2px",
      display: "flex",
      gap: "8px",
      "flex-wrap": "wrap",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-state", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
      padding: "1px 7px",
      "text-transform": "uppercase",
      "letter-spacing": "0.06em",
      "font-size": "var(--font-size-micro)",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-state-enabled", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-success) 46%, transparent)",
      color: "color-mix(in srgb, var(--status-success) 76%, var(--ds-text-strong))",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-state-draining", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-warning) 46%, transparent)",
      color: "color-mix(in srgb, var(--status-warning) 76%, var(--ds-text-strong))",
    },
  },
});
applyGlobalStyle(
  ".settings-backend-pool-state-disabled,\n.settings-backend-pool-state-degraded,\n.settings-backend-pool-state-unknown",
  {
    "@layer": {
      [layers.features]: {
        "border-color": "color-mix(in srgb, var(--status-error) 36%, transparent)",
        color: "color-mix(in srgb, var(--status-error) 72%, var(--ds-text-strong))",
      },
    },
  }
);
applyGlobalStyle(".settings-backend-pool-row-controls", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "6px",
      "flex-wrap": "wrap",
      "justify-content": "flex-end",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-icon-button", {
  "@layer": {
    [layers.features]: {
      width: "30px",
      height: "30px",
      padding: "0",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
    },
  },
});
applyGlobalStyle(".settings-backend-pool-metrics", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 880px)": {
          "grid-template-columns": "repeat(2, minmax(0, 1fr))",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-backend-pool-row", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 880px)": {
          "align-items": "flex-start",
          "flex-direction": "column",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-backend-pool-row-controls", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 880px)": {
          width: "100%",
        },
      },
    },
  },
});
