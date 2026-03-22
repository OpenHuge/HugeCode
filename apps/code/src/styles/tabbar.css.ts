import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".tabbar", {
  "@layer": {
    [layers.components]: {
      display: "grid",
      "grid-template-columns": "repeat(5, minmax(0, 1fr))",
      gap: "2px",
      margin: "0 12px 8px",
      padding: "4px 6px calc(4px + env(safe-area-inset-bottom))",
      "border-radius": "22px",
      background: "color-mix(in srgb, var(--ds-surface-card) 90%, var(--ds-surface-canvas))",
      "backdrop-filter": "blur(16px) saturate(1.02)",
      "-webkit-app-region": "no-drag",
      "min-height": "var(--tabbar-height, 48px)",
      "flex-shrink": "0",
      position: "relative",
      "z-index": "3",
      "box-shadow": "0 8px 24px color-mix(in srgb, var(--ds-shadow-color) 9%, transparent)",
      transition:
        "max-height var(--duration-fast) var(--ease-smooth),\n    min-height var(--duration-fast) var(--ease-smooth),\n    padding var(--duration-fast) var(--ease-smooth),\n    border-top-width var(--duration-fast) var(--ease-smooth),\n    opacity var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle('html[data-mobile-composer-focus="true"] .app.layout-phone .tabbar', {
  "@layer": {
    [layers.components]: {
      "max-height": "0",
      "min-height": "0",
      "padding-top": "0",
      "padding-bottom": "0",
      "border-top-width": "0",
      opacity: "0",
      overflow: "hidden",
      "pointer-events": "none",
    },
  },
});
applyGlobalStyle(".app.reduced-transparency .tabbar", {
  "@layer": { [layers.components]: { "backdrop-filter": "none" } },
});
applyGlobalStyle(".tabbar-item", {
  "@layer": {
    [layers.components]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
      padding: "5px 2px 4px",
      "border-radius": "14px",
      "font-size": "var(--font-size-micro)",
      "font-weight": "600",
      "letter-spacing": "0.01em",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      gap: "3px",
      "min-height": "38px",
      position: "relative",
      cursor: "pointer",
      transition:
        "color var(--duration-fast) var(--ease-smooth),\n    border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth),\n    transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".tabbar-item:hover", {
  "@layer": {
    [layers.components]: {
      color: "var(--ds-text-stronger)",
      background: "transparent",
      transform: "none",
    },
  },
});
applyGlobalStyle('.tabbar-item[data-gated="true"]', {
  "@layer": {
    [layers.components]: {
      opacity: "0.46",
      transform: "none",
    },
  },
});
applyGlobalStyle('.tabbar-item[data-gated="true"]:hover', {
  "@layer": {
    [layers.components]: {
      color: "var(--ds-text-muted)",
      background: "transparent",
      transform: "none",
    },
  },
});
applyGlobalStyle(".tabbar-item.active", {
  "@layer": {
    [layers.components]: {
      color: "var(--ds-text-stronger)",
      background: "transparent",
      "box-shadow": "none",
      transform: "none",
    },
  },
});
applyGlobalStyle(".tabbar-item:focus-visible", {
  "@layer": {
    [layers.components]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
    },
  },
});
applyGlobalStyle(".tabbar-label", {
  "@layer": {
    [layers.components]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-micro)",
      "font-weight": "610",
      "line-height": "var(--line-height-100)",
      "text-wrap": "balance",
      "white-space": "nowrap",
      transition:
        "letter-spacing var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".tabbar-item.active .tabbar-label", {
  "@layer": {
    [layers.components]: {
      "font-weight": "660",
      "letter-spacing": "0",
    },
  },
});
applyGlobalStyle(".tabbar-icon-wrap", {
  "@layer": {
    [layers.components]: {
      position: "relative",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "26px",
      height: "26px",
      "border-radius": "999px",
      background: "transparent",
      color: "inherit",
      transition:
        "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".tabbar-item:hover .tabbar-icon-wrap", {
  "@layer": {
    [layers.components]: {
      background: "color-mix(in srgb, var(--ds-surface-item) 52%, transparent)",
    },
  },
});
applyGlobalStyle(".tabbar-item.active .tabbar-icon-wrap", {
  "@layer": {
    [layers.components]: {
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-active) 56%, var(--ds-surface-card)), color-mix(in srgb, var(--ds-surface-active) 32%, var(--ds-surface-item)))",
      "box-shadow": "0 3px 8px color-mix(in srgb, var(--ds-shadow-color) 8%, transparent)",
    },
  },
});
applyGlobalStyle(".tabbar-icon", {
  "@layer": {
    [layers.components]: {
      width: "17px",
      height: "17px",
    },
  },
});
applyGlobalStyle(".tabbar-lock", {
  "@layer": {
    [layers.components]: {
      position: "absolute",
      top: "-2px",
      right: "-2px",
      width: "10px",
      height: "10px",
      padding: "1px",
      "border-radius": "999px",
      background: "var(--ds-surface-card)",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".tabbar-hint", {
  "@layer": {
    [layers.components]: {
      position: "absolute",
      left: "50%",
      bottom: "calc(100% + 10px)",
      transform: "translateX(-50%)",
      width: "min(280px, calc(100vw - 32px))",
      padding: "8px 12px",
      borderRadius: "14px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 96%, var(--ds-surface-canvas))",
      "box-shadow": "0 8px 24px color-mix(in srgb, var(--ds-shadow-color) 12%, transparent)",
      color: "var(--ds-text-subtle)",
      "text-align": "center",
    },
  },
});
