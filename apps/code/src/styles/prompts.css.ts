import { type GlobalStyleRule, globalKeyframes, globalStyle } from "@vanilla-extract/css";
import { layers } from "./system/layers.css";

globalStyle(".prompt-panel", {
  "@layer": { [layers.features]: { gap: "12px" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-section", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "8px" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-section-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "8px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-section-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      color: "var(--ds-text-muted)",
      "font-weight": "600",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-section-add svg", {
  "@layer": { [layers.features]: { width: "14px", height: "14px" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-list", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "10px" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      padding: "10px",
      "border-radius": "12px",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-control) 86%, transparent),\n    color-mix(in srgb, var(--ds-surface-card-base) 92%, transparent)\n  )",
      border: "1px solid var(--ds-border-subtle)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
      transition:
        "background var(--duration-normal) var(--ease-smooth),\n    border-color var(--duration-normal) var(--ease-smooth),\n    box-shadow var(--duration-normal) var(--ease-smooth),\n    transform var(--duration-normal) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-row:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-strong) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-control))",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 34%, transparent),\n    0 10px 22px color-mix(in srgb, var(--ds-brand-background) 18%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-row-header", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "4px" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-name", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      "font-weight": "600",
      color: "var(--ds-text-emphasis)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-description", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-subtle)" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-hint", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      "flex-wrap": "wrap",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-args-input", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "160px",
      "border-radius": "8px",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-emphasis)",
      padding: "6px 8px",
      "font-size": "var(--font-size-meta)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-args-input::placeholder", {
  "@layer": { [layers.features]: { color: "var(--ds-text-dim)" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-args-input:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 76%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 82%, var(--ds-surface-card-base))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-action", {
  "@layer": {
    [layers.features]: {
      padding: "6px 10px",
      "font-size": "var(--font-size-fine)",
      "letter-spacing": "0.04em",
      "text-transform": "uppercase",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-action-menu svg", {
  "@layer": { [layers.features]: { width: "14px", height: "14px" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-context-menu", {
  "@layer": {
    [layers.features]: {
      position: "fixed",
      top: "var(--prompt-context-menu-top, 0px)",
      left: "var(--prompt-context-menu-left, 0px)",
      "z-index": "50",
      width: "200px",
      padding: "6px",
      "border-radius": "10px",
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-context-option", {
  "@layer": { [layers.features]: { width: "100%", "justify-content": "flex-start" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-delete-confirm", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
      "padding-top": "2px",
      animation: "prompt-fade-in 180ms ease-out",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-delete-confirm span", {
  "@layer": { [layers.features]: { flex: "1" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-row.is-highlight", {
  "@layer": { [layers.features]: { animation: "prompt-row-flash 650ms ease-out" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-card", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "12px",
      padding: "12px",
      "border-radius": "12px",
      border: "1px dashed var(--ds-border-subtle)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-faint)",
      animation: "prompt-fade-in 220ms ease-out",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 22%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-icon", {
  "@layer": { [layers.features]: { width: "24px", height: "24px", opacity: "0.6" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-subtle)",
      "font-weight": "600",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-subtitle", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-faint)" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-link", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "none",
      padding: "0",
      margin: "0",
      font: "inherit",
      color: "var(--ds-text-accent)",
      cursor: "pointer",
      "text-decoration": "underline",
      "text-underline-offset": "2px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-link:hover", {
  "@layer": { [layers.features]: { color: "var(--ds-text-emphasis)" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-empty-link.is-disabled", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
      cursor: "default",
      "text-decoration": "none",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      padding: "12px",
      "border-radius": "12px",
      background: "var(--ds-surface-card-base)",
      border: "1px solid var(--ds-border-subtle)",
      animation: "prompt-editor-in 240ms ease-out",
      "box-shadow":
        "var(--ds-elevation-1),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor-row", {
  "@layer": { [layers.features]: { display: "flex", gap: "12px", "flex-wrap": "wrap" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor-label", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      flex: "1",
      "min-width": "160px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor-textarea", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "border-radius": "8px",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-emphasis)",
      padding: "8px",
      "font-size": "var(--font-size-meta)",
      resize: "vertical",
      "min-height": "120px",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-scope-select", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-emphasis)",
      "font-size": "var(--font-size-meta)",
      "border-radius": "8px",
      padding: "6px 8px",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor-textarea:focus-visible,\n.prompt-scope-select:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 76%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 82%, var(--ds-surface-card-base))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor-actions", {
  "@layer": { [layers.features]: { display: "flex", gap: "8px", "justify-content": "flex-end" } },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-editor-error", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--status-error)" },
  },
} as unknown as GlobalStyleRule);
globalKeyframes("prompt-row-flash", {
  "0%": {
    background: "color-mix(in srgb, var(--ds-surface-active) 65%, var(--ds-surface-control))",
    borderColor: "var(--ds-border-accent)",
    boxShadow: "0 0 0 1px var(--ds-border-accent-soft)",
    transform: "translateY(-2px)",
  },
  "100%": {
    background: "var(--ds-surface-control)",
    borderColor: "var(--ds-border-subtle)",
    boxShadow: "none",
    transform: "translateY(0)",
  },
});
globalKeyframes("prompt-editor-in", {
  "0%": { opacity: "0", transform: "translateY(-4px)" },
  "100%": { opacity: "1", transform: "translateY(0)" },
});
globalKeyframes("prompt-fade-in", {
  "0%": { opacity: "0", transform: "translateY(4px)" },
  "100%": { opacity: "1", transform: "translateY(0)" },
});
globalStyle(".prompt-panel-scroll", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
      flex: "1",
      "min-height": "0",
      "overflow-y": "auto",
      "padding-right": "2px",
      "padding-bottom": "12px",
      "scrollbar-width": "thin",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".prompt-row,\n  .prompt-empty-card,\n  .prompt-editor", {
  "@layer": {
    [layers.features]: {
      "@media": { "(prefers-reduced-motion: reduce)": { animation: "none", transition: "none" } },
    },
  },
} as unknown as GlobalStyleRule);
