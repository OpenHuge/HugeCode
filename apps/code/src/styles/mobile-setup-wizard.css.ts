import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".mobile-setup-wizard-overlay", {
  "@layer": { [layers.features]: { "z-index": "120" } },
});
applyGlobalStyle(".mobile-setup-wizard-overlay .ds-modal-backdrop", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-context-core) 78%, transparent)",
      "backdrop-filter": "blur(14px) saturate(1.15)",
      "-webkit-backdrop-filter": "blur(14px) saturate(1.15)",
    },
  },
});
applyGlobalStyle(".app.reduced-transparency .mobile-setup-wizard-overlay .ds-modal-backdrop", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-context-core) 92%, transparent)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-card", {
  "@layer": {
    [layers.features]: {
      width: "min(520px, 92vw)",
      "border-radius": "20px",
      overflow: "hidden",
      border: "1px solid var(--ds-border-strong)",
      "box-shadow": [
        "0 28px 64px color-mix(in srgb, var(--ds-color-black) 55%, transparent)",
        "0 28px 64px color-mix(in srgb, var(--ds-color-black) 55%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
      ],
      background:
        "radial-gradient(\n      120% 120% at 100% 0%,\n      color-mix(in srgb, var(--ds-brand-secondary) 24%, transparent),\n      transparent 46%\n    ),\n    linear-gradient(\n      170deg,\n      color-mix(in srgb, var(--ds-color-white) 6%, transparent),\n      color-mix(in srgb, var(--ds-color-white) 2%, transparent)\n    ),\n    var(--ds-surface-context-core)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-header", {
  "@layer": { [layers.features]: { padding: "20px 22px 12px" } },
});
applyGlobalStyle(".mobile-setup-wizard-kicker", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-brand-secondary) 35%, transparent)",
      background: "color-mix(in srgb, var(--ds-brand-secondary) 14%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "4px 10px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "700",
      "letter-spacing": "0.04em",
      "text-transform": "uppercase",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-title", {
  "@layer": {
    [layers.features]: {
      margin: "10px 0 6px",
      "font-size": "var(--font-size-display)",
      "line-height": "var(--line-height-120)",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-subtitle", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-chrome)",
      "line-height": "var(--line-height-145)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-body", {
  "@layer": { [layers.features]: { display: "grid", gap: "10px", padding: "10px 22px 22px" } },
});
applyGlobalStyle(".mobile-setup-wizard-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-input", {
  "@layer": {
    [layers.features]: {
      "border-radius": "10px",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      padding: "10px 11px",
      "font-size": "var(--font-size-chrome)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-input:focus", {
  "@layer": {
    [layers.features]: {
      outline: "none",
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 76%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 72%, var(--ds-surface-control))",
      "box-shadow":
        "0 0 0 3px color-mix(in srgb, var(--ds-brand-secondary) 18%, transparent),\n    0 0 0 1px color-mix(in srgb, var(--ds-border-accent-soft) 34%, transparent)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-action", {
  "@layer": {
    [layers.features]: {
      "margin-top": "4px",
      width: "100%",
      "justify-content": "center",
      "font-weight": "600",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-status", {
  "@layer": {
    [layers.features]: {
      "border-radius": "10px",
      border: "1px solid color-mix(in srgb, var(--status-success) 40%, transparent)",
      background: "color-mix(in srgb, var(--status-success) 12%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "9px 10px",
      "font-size": "var(--font-size-meta)",
      "line-height": "var(--line-height-140)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 20%, transparent)",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-status-error", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-error) 45%, transparent)",
      background: "color-mix(in srgb, var(--status-error) 12%, transparent)",
      color: "color-mix(in srgb, var(--status-error) 58%, var(--ds-color-white))",
    },
  },
});
applyGlobalStyle(".mobile-setup-wizard-hint", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-fine)",
      "line-height": "var(--line-height-145)",
    },
  },
});
