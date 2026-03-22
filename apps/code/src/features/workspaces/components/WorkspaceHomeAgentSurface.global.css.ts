import { applyGlobalStyle } from "../../../styles/system/globalStyleHelpers";
import { layers } from "../../../styles/system/layers.css";

applyGlobalStyle(".workspace-home-code-runtime-summary", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "8px",
      "align-items": "center",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-summary button", {
  "@layer": {
    [layers.features]: {
      "margin-left": "auto",
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "6px 10px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-toolbar", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) minmax(0, 1fr) auto",
      gap: "8px",
      "align-items": "end",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-toolbar label", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "5px",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(
  ".workspace-home-code-runtime-toolbar select,\n.workspace-home-code-runtime-toolbar input",
  {
    "@layer": {
      [layers.features]: {
        "border-radius": "var(--ds-radius-sm)",
        border: "1px solid var(--ds-border-muted)",
        background: "var(--ds-surface-card-base)",
        color: "var(--ds-text-strong)",
        padding: "7px 9px",
        "font-size": "var(--font-size-meta)",
      },
    },
  }
);
applyGlobalStyle(".workspace-home-code-runtime-toolbar button", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid color-mix(in srgb, var(--status-error) 35%, var(--ds-border-muted))",
      background: "color-mix(in srgb, var(--status-error) 9%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "7px 10px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-create", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "8px" } },
});
applyGlobalStyle(
  ".workspace-home-code-runtime-create input,\n.workspace-home-code-runtime-create textarea,\n.workspace-home-code-runtime-create select",
  {
    "@layer": {
      [layers.features]: {
        "border-radius": "var(--ds-radius-sm)",
        border: "1px solid var(--ds-border-muted)",
        background: "var(--ds-surface-card-base)",
        color: "var(--ds-text-strong)",
        padding: "7px 9px",
        "font-size": "var(--font-size-meta)",
      },
    },
  }
);
applyGlobalStyle(".workspace-home-code-runtime-create textarea", {
  "@layer": { [layers.features]: { resize: "vertical", "min-height": "54px" } },
});
applyGlobalStyle(".workspace-home-code-runtime-create-meta", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr)) auto",
      gap: "8px",
      "align-items": "end",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-create-meta label", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "5px",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-create-meta button", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "7px 10px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-list", {
  "@layer": { [layers.features]: { display: "grid", gap: "8px" } },
});
applyGlobalStyle(".workspace-home-code-runtime-item", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "8px",
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-item-main", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "8px 12px",
      "align-items": "center",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-item-main strong", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)", "margin-right": "8px" } },
});
applyGlobalStyle(".workspace-home-code-runtime-item-actions", {
  "@layer": { [layers.features]: { display: "flex", gap: "6px", "flex-wrap": "wrap" } },
});
applyGlobalStyle(".workspace-home-code-runtime-item-actions button", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "5px 9px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-toolbar", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      "flex-wrap": "wrap",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-mode", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      gap: "6px",
      "align-items": "center",
      margin: "0",
      padding: "0",
      border: "0",
      "min-inline-size": "0",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-mode-button", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-muted)",
      padding: "5px 9px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
      "font-weight": "520",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-mode-button--active", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-success) 35%, var(--ds-border-muted))",
      background: "color-mix(in srgb, var(--status-success) 11%, transparent)",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-mode-button:disabled", {
  "@layer": { [layers.features]: { opacity: "0.6", cursor: "not-allowed" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-toolbar button", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "6px 10px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-warning", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-warning) 45%, var(--ds-border-muted))",
      "border-radius": "var(--ds-radius-sm)",
      background: "color-mix(in srgb, var(--status-warning) 10%, transparent)",
      color: "var(--ds-text-strong)",
      "font-size": "var(--font-size-meta)",
      padding: "7px 9px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-warning--metrics", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-error) 45%, var(--ds-border-muted))",
      background: "color-mix(in srgb, var(--status-error) 10%, transparent)",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-guidance", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-success) 35%, var(--ds-border-muted))",
      "border-radius": "var(--ds-radius-sm)",
      background: "color-mix(in srgb, var(--status-success) 8%, transparent)",
      color: "var(--ds-text-strong)",
      "font-size": "var(--font-size-meta)",
      padding: "7px 9px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-status", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "6px",
      "align-items": "center",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-chip", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      maxWidth: "100%",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-grid", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-card", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 92%, var(--ds-surface-muted))",
      padding: "8px",
      "align-content": "start",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-metrics-card", {
  "@layer": { [layers.features]: { gap: "10px" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-metrics-grid", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(3, minmax(0, 1fr))",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-metric", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "7px 8px",
      display: "grid",
      gap: "3px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-metric span", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-metric strong", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-content)", color: "var(--ds-text-strong)" },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-metric small", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-muted)" },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-card > button", {
  "@layer": {
    [layers.features]: {
      "justify-self": "start",
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "6px 10px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-card > button:disabled", {
  "@layer": { [layers.features]: { opacity: "0.6", cursor: "not-allowed" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-input", {
  "@layer": { [layers.features]: { "min-height": "124px" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-schema-preview", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-muted)",
      padding: "8px",
      "font-size": "var(--font-size-fine)",
      lineHeight: "var(--line-height-fine)",
      "max-height": "180px",
      overflow: "auto",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-validation-list", {
  "@layer": {
    [layers.features]: {
      margin: "6px 0 0",
      padding: "0 0 0 18px",
      display: "grid",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-list", {
  "@layer": { [layers.features]: { display: "grid", gap: "6px" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-list pre", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-muted)",
      padding: "8px",
      "font-size": "var(--font-size-fine)",
      lineHeight: "var(--line-height-fine)",
      "max-height": "220px",
      overflow: "auto",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-output", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "8px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-output pre", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      "max-height": "260px",
      overflow: "auto",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      lineHeight: "var(--line-height-fine)",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-history", {
  "@layer": { [layers.features]: { display: "grid", gap: "8px" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-list", {
  "@layer": { [layers.features]: { display: "grid", gap: "6px" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-item", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      gap: "8px",
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "7px 9px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-main", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "6px 10px",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-main strong", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)", "font-weight": "560" } },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-item button", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "5px 9px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-context", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-context-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "6px",
      "align-items": "center",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-summary button", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 640px)": { "margin-left": "0" } } } },
});
applyGlobalStyle(".workspace-home-code-runtime-toolbar", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 640px)": { "grid-template-columns": "1fr" } } },
  },
});
applyGlobalStyle(".workspace-home-code-runtime-create-meta", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 640px)": { "grid-template-columns": "1fr" } } },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-grid", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 820px)": { "grid-template-columns": "1fr" } } },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-metrics-grid", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 640px)": { "grid-template-columns": "1fr" } } },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-history-item", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 640px)": {
          "flex-direction": "column",
          "align-items": "stretch",
        },
      },
    },
  },
});
applyGlobalStyle(".workspace-home-webmcp-console-mode", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 640px)": {
          width: "100%",
          "justify-content": "space-between",
        },
      },
    },
  },
});
