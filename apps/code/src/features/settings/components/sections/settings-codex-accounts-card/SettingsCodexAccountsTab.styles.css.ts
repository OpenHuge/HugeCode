import { applyGlobalStyle } from "../../../../../styles/system/globalStyleHelpers";
import { layers } from "../../../../../styles/system/layers.css";
import "./SettingsCodexAccountsSurface.global.css";

applyGlobalStyle(".apm-list--accounts", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(auto-fit, minmax(320px, 1fr))",
      gap: "14px",
      "@media": {
        "(max-width: 720px)": {
          "grid-template-columns": "1fr",
        },
      },
    },
  },
});

applyGlobalStyle(".apm-row--account", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "16px",
      "min-height": "420px",
      padding: "18px",
      borderRadius: "22px",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--apm-panel-bg) 98%, transparent), color-mix(in srgb, var(--apm-panel-hover) 92%, transparent))",
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-topbar", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "12px",
      width: "100%",
      "@media": {
        "(max-width: 560px)": {
          "flex-wrap": "wrap",
        },
      },
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-check", {
  "@layer": { [layers.features]: { padding: "0" } },
});

applyGlobalStyle('.apm-row--account .apm-row-check input[type="checkbox"]', {
  "@layer": { [layers.features]: { width: "18px", height: "18px" } },
});

applyGlobalStyle(".apm-row--account .apm-row-avatar", {
  "@layer": {
    [layers.features]: {
      width: "44px",
      height: "44px",
      borderRadius: "14px",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--apm-panel-muted) 88%, var(--ds-surface-card-base)), color-mix(in srgb, var(--apm-panel-muted) 100%, transparent))",
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-heading", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
      "min-width": "0",
      flex: "1",
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-pills", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "flex-wrap": "wrap",
      gap: "8px",
      "align-items": "center",
      "justify-content": "flex-end",
      "margin-left": "auto",
      "@media": {
        "(max-width: 560px)": {
          "margin-left": "0",
        },
      },
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-status-chip", {
  "@layer": {
    [layers.features]: {
      "align-self": "auto",
      "grid-column": "auto",
      "justify-self": "auto",
    },
  },
});

applyGlobalStyle(".apm-plan-chip", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      padding: "6px 12px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-brand-primary) 34%, var(--apm-border-soft))",
      background: "color-mix(in srgb, var(--ds-brand-primary) 12%, var(--apm-panel-bg))",
      color: "color-mix(in srgb, var(--ds-brand-primary) 82%, var(--ds-color-white))",
      "font-size": "var(--font-size-fine)",
      "font-weight": "700",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-info", {
  "@layer": { [layers.features]: { gap: "12px", width: "100%" } },
});

applyGlobalStyle(".apm-row-identity", {
  "@layer": { [layers.features]: { display: "grid", gap: "8px" } },
});

applyGlobalStyle(".apm-row-identity-line", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "8px",
      "align-items": "baseline",
    },
  },
});

applyGlobalStyle(".apm-row-identity-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
      "font-weight": "600",
    },
  },
});

applyGlobalStyle(".apm-row-identity-value", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-primary)",
      "line-height": "var(--line-height-150)",
    },
  },
});

applyGlobalStyle(".apm-row-identity-separator", {
  "@layer": { [layers.features]: { color: "var(--apm-text-tertiary)" } },
});

applyGlobalStyle(".apm-quota-list", {
  "@layer": { [layers.features]: { display: "grid", gap: "14px" } },
});

applyGlobalStyle(".apm-quota-item", {
  "@layer": { [layers.features]: { display: "grid", gap: "8px" } },
});

applyGlobalStyle(".apm-quota-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
    },
  },
});

applyGlobalStyle(".apm-quota-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-label)",
      "font-weight": "620",
      color: "var(--apm-text-secondary)",
    },
  },
});

applyGlobalStyle(".apm-quota-value", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-title)",
      "font-weight": "760",
      "font-variant-numeric": "tabular-nums",
    },
  },
});

applyGlobalStyle(".apm-quota-value.is-success", {
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-success) 78%, var(--ds-color-white))",
    },
  },
});

applyGlobalStyle(".apm-quota-value.is-warning", {
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-warning) 78%, var(--ds-color-white))",
    },
  },
});

applyGlobalStyle(".apm-quota-progress", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      height: "10px",
      borderRadius: "999px",
      background: "var(--apm-panel-muted)",
      border: "1px solid color-mix(in srgb, var(--apm-border-soft) 86%, transparent)",
      overflow: "hidden",
      appearance: "none",
    },
  },
});

applyGlobalStyle(".apm-quota-progress::-webkit-progress-bar", {
  "@layer": {
    [layers.features]: {
      background: "var(--apm-panel-muted)",
      borderRadius: "999px",
    },
  },
});

applyGlobalStyle(".apm-quota-progress::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      borderRadius: "999px",
    },
  },
});

applyGlobalStyle(".apm-quota-progress::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      borderRadius: "999px",
    },
  },
});

applyGlobalStyle(".apm-quota-progress.is-success::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(90deg, color-mix(in srgb, var(--status-success) 86%, transparent), color-mix(in srgb, var(--status-success) 60%, var(--ds-color-white)))",
    },
  },
});

applyGlobalStyle(".apm-quota-progress.is-success::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(90deg, color-mix(in srgb, var(--status-success) 86%, transparent), color-mix(in srgb, var(--status-success) 60%, var(--ds-color-white)))",
    },
  },
});

applyGlobalStyle(".apm-quota-progress.is-warning::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(90deg, color-mix(in srgb, var(--status-warning) 88%, transparent), color-mix(in srgb, var(--status-warning) 62%, var(--ds-color-white)))",
    },
  },
});

applyGlobalStyle(".apm-quota-progress.is-warning::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(90deg, color-mix(in srgb, var(--status-warning) 88%, transparent), color-mix(in srgb, var(--status-warning) 62%, var(--ds-color-white)))",
    },
  },
});

applyGlobalStyle(".apm-quota-reset", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--apm-text-tertiary)",
      "text-align": "right",
      "font-variant-numeric": "tabular-nums",
    },
  },
});

applyGlobalStyle(".apm-row-support", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "8px",
    },
  },
});

applyGlobalStyle(".apm-row-support-chip", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      padding: "4px 9px",
      borderRadius: "999px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-muted)",
      color: "var(--apm-text-tertiary)",
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-footer", {
  "@layer": {
    [layers.features]: {
      "margin-top": "auto",
      paddingTop: "14px",
      borderTop: "1px solid color-mix(in srgb, var(--apm-border-soft) 88%, transparent)",
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "12px",
      "justify-content": "space-between",
    },
  },
});

applyGlobalStyle(".apm-row-footer-time", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-tertiary)",
      "font-variant-numeric": "tabular-nums",
    },
  },
});

applyGlobalStyle(".apm-row--account .apm-row-actions", {
  "@layer": {
    [layers.features]: {
      "grid-column": "auto",
      paddingTop: "0",
      flex: "0 1 auto",
      "justify-content": "flex-end",
      "@media": {
        "(max-width: 720px)": {
          width: "100%",
          "justify-content": "flex-start",
        },
      },
    },
  },
});
