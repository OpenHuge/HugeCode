import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".composer-suggestions.review-inline-suggestions", {
  "@layer": {
    [layers.features]: {
      "max-height": "min(360px, 55vh)",
      width: "min(620px, calc(100vw - 48px))",
      padding: "12px",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      "box-shadow":
        "0 10px 20px color-mix(in srgb, var(--ds-brand-background) 20%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 26%, transparent)",
    },
  },
});
applyGlobalStyle(".review-inline", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "10px" } },
});
applyGlobalStyle(".review-inline-header", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "2px" } },
});
applyGlobalStyle(".review-inline-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-label)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".review-inline-subtitle", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-subtle)" },
  },
});
applyGlobalStyle(".review-inline-section", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "8px" } },
});
applyGlobalStyle(".review-inline-option", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-md)",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-muted)",
      color: "var(--ds-text-strong)",
      padding: "10px 12px",
      "font-size": "var(--font-size-chrome)",
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      gap: "2px",
      "text-align": "left",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".review-inline-option:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-muted))",
    },
  },
});
applyGlobalStyle(".review-inline-option:disabled", {
  "@layer": { [layers.features]: { opacity: "0.6" } },
});
applyGlobalStyle(".review-inline-option.is-selected", {
  "@layer": {
    [layers.features]: {
      "border-color":
        "color-mix(in srgb, var(--ds-border-accent-soft) 64%, var(--ds-border-subtle))",
      "box-shadow":
        "0 0 0 1px color-mix(in srgb, var(--ds-brand-primary) 22%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 22%, transparent)",
    },
  },
});
applyGlobalStyle(".review-inline-option-title", {
  "@layer": { [layers.features]: { "font-weight": "600" } },
});
applyGlobalStyle(".review-inline-option-subtitle", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".review-inline-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".review-inline-label", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".review-inline-input,\n.review-inline-textarea", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-md)",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-muted)",
      color: "var(--ds-text-strong)",
      padding: "9px 11px",
      "font-size": "var(--font-size-chrome)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".review-inline-input:focus,\n.review-inline-textarea:focus", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
      "border-color":
        "color-mix(in srgb, var(--ds-border-accent-soft) 60%, var(--ds-border-subtle))",
    },
  },
});
applyGlobalStyle(".review-inline-textarea", {
  "@layer": { [layers.features]: { resize: "vertical", "min-height": "110px" } },
});
applyGlobalStyle(".review-inline-hint", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-subtle)" },
  },
});
applyGlobalStyle(".review-inline-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
      "max-height": "200px",
      overflow: "auto",
      "padding-right": "2px",
    },
  },
});
applyGlobalStyle(".review-inline-list-item", {
  "@layer": {
    [layers.features]: {
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-muted)",
      color: "var(--ds-text-strong)",
      padding: "8px 10px",
      "font-size": "var(--font-size-chrome)",
      "text-align": "left",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".review-inline-list-item:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-muted))",
    },
  },
});
applyGlobalStyle(".review-inline-list-item.is-selected", {
  "@layer": {
    [layers.features]: {
      "border-color":
        "color-mix(in srgb, var(--ds-border-accent-soft) 64%, var(--ds-border-subtle))",
      "box-shadow":
        "0 0 0 1px color-mix(in srgb, var(--ds-brand-primary) 22%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 20%, transparent)",
    },
  },
});
applyGlobalStyle(".review-inline-commit", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "2px" } },
});
applyGlobalStyle(".review-inline-commit-title", {
  "@layer": { [layers.features]: { "font-weight": "600" } },
});
applyGlobalStyle(".review-inline-commit-meta", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".review-inline-empty", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-subtle)",
      padding: "4px 2px",
    },
  },
});
applyGlobalStyle(".review-inline-error", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "color-mix(in srgb, var(--status-error) 80%, white)",
      background: "color-mix(in srgb, var(--status-error) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--status-error) 30%, transparent)",
      padding: "7px 9px",
      "border-radius": "var(--ds-radius-sm)",
    },
  },
});
applyGlobalStyle(".review-inline-actions", {
  "@layer": { [layers.features]: { display: "flex", "justify-content": "flex-end", gap: "8px" } },
});
applyGlobalStyle(".review-inline-button,\n.review-inline-back,\n.review-inline-confirm", {
  "@layer": { [layers.features]: { "min-width": "88px" } },
});
