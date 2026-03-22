import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".apm-overview-grid", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
      gap: "12px",
      "@media": {
        "(max-width: 640px)": { "grid-template-columns": "1fr" },
      },
    },
  },
});
applyGlobalStyle(".apm-overview-card", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      padding: "16px 18px",
      "align-content": "start",
      "min-height": "108px",
      "border-radius": "16px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-bg)",
      "box-shadow": "var(--apm-shadow-sm)",
    },
  },
});
applyGlobalStyle(".apm-overview-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      color: "var(--apm-text-tertiary)",
    },
  },
});
applyGlobalStyle(".apm-overview-value", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-display-sm)",
      "font-weight": "700",
      "line-height": "var(--line-height-100)",
      "font-variant-numeric": "tabular-nums",
      color: "var(--apm-text-primary)",
    },
  },
});
applyGlobalStyle(".apm-callout", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
      padding: "12px 14px",
      "border-radius": "14px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-muted)",
    },
  },
});
applyGlobalStyle(".apm-callout--warning", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-warning) 26%, var(--apm-border-soft))",
      background: "color-mix(in srgb, var(--status-warning) 5%, var(--apm-panel-muted))",
    },
  },
});
applyGlobalStyle(".apm-callout-line", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
      "line-height": "var(--line-height-145)",
    },
  },
});
applyGlobalStyle(".apm-callout-line--warning", {
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-warning) 72%, var(--ds-text-strong))",
    },
  },
});
applyGlobalStyle(".apm-list-shell", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
      padding: "14px",
      "border-radius": "18px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-subtle)",
    },
  },
});
applyGlobalStyle(".apm-toolbar--stack", {
  "@layer": { [layers.features]: { gap: "12px", "align-items": "stretch" } },
});
applyGlobalStyle(".apm-toolbar-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".apm-toolbar-search", {
  "@layer": { [layers.features]: { flex: "1 1 280px", "min-width": "220px" } },
});
applyGlobalStyle(".apm-toolbar-search > *", {
  "@layer": { [layers.features]: { width: "100%" } },
});
applyGlobalStyle(".apm-toolbar-filters", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "flex-wrap": "wrap",
      gap: "10px",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".apm-bulk-banner", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
      padding: "12px 14px",
      "border-radius": "14px",
      border: "1px solid color-mix(in srgb, var(--ds-brand-primary) 18%, var(--apm-border-soft))",
      background: "color-mix(in srgb, var(--ds-brand-primary) 7%, var(--apm-panel-bg))",
    },
  },
});
applyGlobalStyle(".apm-bulk-banner-copy", {
  "@layer": { [layers.features]: { display: "grid", gap: "3px" } },
});
applyGlobalStyle(".apm-bulk-banner-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-label)",
      "font-weight": "650",
      color: "var(--apm-text-primary)",
    },
  },
});
applyGlobalStyle(".apm-bulk-banner-meta", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
    },
  },
});
applyGlobalStyle(".apm-bulk-banner-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "flex-wrap": "wrap",
      gap: "8px",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".apm-row-meta", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "6px",
      "margin-bottom": "2px",
    },
  },
});
applyGlobalStyle(".apm-row-meta > span", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      padding: "3px 8px",
      "border-radius": "999px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      color: "var(--apm-text-tertiary)",
      background: "var(--apm-panel-muted)",
      border: "1px solid var(--apm-border-soft)",
    },
  },
});
