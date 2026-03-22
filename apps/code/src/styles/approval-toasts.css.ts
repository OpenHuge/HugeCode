import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".approval-toasts", {
  "@layer": {
    [layers.features]: {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      width: "min(520px, calc(100vw - 24px))",
      "max-height": "min(620px, calc(100vh - 24px))",
      overflow: "auto",
      "z-index": "60",
      "pointer-events": "none",
      "-webkit-app-region": "no-drag",
      transform: "none",
    },
  },
});
applyGlobalStyle(".approval-toast", {
  "@layer": {
    [layers.features]: {
      "--ds-toast-enter-duration": "0.2s",
      "pointer-events": "auto",
      "border-radius": "16px",
      background:
        "color-mix(in srgb, var(--ds-surface-overlay) 90%, var(--ds-surface-card-base) 10%)",
      "border-color":
        "color-mix(in srgb, var(--ds-border-subtle) 78%, var(--ds-surface-hover) 22%)",
      "backdrop-filter": "blur(14px)",
      "box-shadow":
        "0 16px 36px color-mix(in srgb, var(--ds-brand-background) 46%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 26%, transparent)",
    },
  },
});
applyGlobalStyle(".approval-toast-header", {
  "@layer": {
    [layers.features]: {
      "margin-bottom": "10px",
      display: "grid",
      gap: "10px",
      "align-items": "flex-start",
    },
  },
});
applyGlobalStyle(".approval-toast-headline", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "auto minmax(0, 1fr)",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".approval-toast-icon", {
  "@layer": {
    [layers.features]: {
      width: "30px",
      height: "30px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "999px",
      color: "var(--ds-text-primary)",
      background: "color-mix(in srgb, var(--status-warning) 12%, var(--ds-surface-active))",
      border: "1px solid color-mix(in srgb, var(--status-warning) 26%, var(--ds-border-subtle))",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".approval-toast-copy", {
  "@layer": { [layers.features]: { display: "grid", gap: "4px", "min-width": "0" } },
});
applyGlobalStyle(".approval-toast-meta", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "8px",
      "flex-wrap": "wrap",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".approval-toast-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "620",
      "letter-spacing": "0.04em",
      "text-transform": "uppercase",
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".approval-toast-subtitle", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
      "line-height": "var(--line-height-140)",
    },
  },
});
applyGlobalStyle(".approval-toast-workspace", {
  "@layer": {
    [layers.features]: {
      "flex-shrink": "0",
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      color: "var(--ds-text-subtle)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 90%, var(--ds-surface-hover) 10%)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 90%, transparent)",
      "border-radius": "999px",
      padding: "4px 10px",
    },
  },
});
applyGlobalStyle(".approval-toast-thread", {
  "@layer": {
    [layers.features]: {
      "flex-shrink": "0",
      "font-family": "var(--font-family-code)",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
      background: "color-mix(in srgb, var(--ds-surface-item) 92%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 92%, transparent)",
      "border-radius": "999px",
      padding: "4px 10px",
      "max-width": "100%",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".approval-toast-method", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "max-width": "100%",
      "font-family": "var(--code-font-family)",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
      background: "color-mix(in srgb, var(--ds-surface-item) 92%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 92%, transparent)",
      "border-radius": "999px",
      padding: "4px 8px",
      "overflow-wrap": "anywhere",
      "word-break": "break-word",
    },
  },
});
applyGlobalStyle(".approval-toast-details", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      "margin-bottom": "12px",
      background: "color-mix(in srgb, var(--ds-surface-muted) 70%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      "border-radius": "12px",
      padding: "10px",
    },
  },
});
applyGlobalStyle(".approval-toast-detail", {
  "@layer": { [layers.features]: { display: "grid", gap: "5px" } },
});
applyGlobalStyle(".approval-toast-detail-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      color: "var(--ds-text-muted)",
      "text-transform": "none",
      "letter-spacing": "0",
    },
  },
});
applyGlobalStyle(".approval-toast-detail-value", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      "line-height": "var(--line-height-145)",
      "overflow-wrap": "anywhere",
      "word-break": "break-word",
      color: "var(--ds-text-primary)",
    },
  },
});
applyGlobalStyle(".approval-toast-detail-code", {
  "@layer": {
    [layers.features]: {
      "max-height": "180px",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-primary)",
      background:
        "color-mix(in srgb, var(--ds-surface-card-base) 78%, var(--ds-surface-hover) 22%)",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
    },
  },
});
applyGlobalStyle(".approval-toast-detail-empty", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-muted)" },
  },
});
applyGlobalStyle(".approval-toast-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "flex-end",
      "flex-wrap": "wrap",
      gap: "8px",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".approval-toast-btn", {
  "@layer": {
    [layers.features]: {
      "white-space": "nowrap",
      "border-radius": "10px",
      "min-height": "34px",
      padding: "0 12px",
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
    },
  },
});
applyGlobalStyle(".approval-toast-btn--remember", {
  "@layer": {
    [layers.features]: {
      "margin-right": "auto",
      background: "transparent",
      border: "1px solid transparent",
      color: "var(--ds-text-muted)",
      padding: "0",
      "min-height": "auto",
    },
  },
});
applyGlobalStyle(".approval-toast-btn--remember:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      "text-decoration": "underline",
      "box-shadow": "none",
      transform: "none",
    },
  },
});
applyGlobalStyle(".approval-toast-btn--open-thread", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 78%, transparent)",
    },
  },
});
applyGlobalStyle(".approval-toasts", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 960px)": {
          right: "8px",
          bottom: "8px",
          width: "min(460px, calc(100vw - 16px))",
          "max-height": "min(560px, calc(100vh - 16px))",
        },
      },
    },
  },
});
applyGlobalStyle(".approval-toast-actions", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "justify-content": "stretch" } },
    },
  },
});
applyGlobalStyle(".approval-toast-btn", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 960px)": { width: "100%" } } },
  },
});
applyGlobalStyle(".approval-toast-headline", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 640px)": { "grid-template-columns": "1fr" } },
    },
  },
});
