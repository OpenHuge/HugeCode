import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "./system/layers.css";

globalStyle(".terminal-panel", {
  "@layer": {
    [layers.features]: {
      "border-top": "1px solid color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-debug) 86%, transparent),\n    color-mix(in srgb, var(--ds-surface-debug) 97%, transparent)\n  )",
      display: "flex",
      "flex-direction": "column",
      "grid-column": "1",
      "grid-row": "4",
      height: "var(--terminal-panel-height, 220px)",
      "-webkit-app-region": "no-drag",
      "--terminal-background": "var(--ds-surface-debug)",
      "--terminal-foreground": "var(--ds-text-stronger)",
      "--terminal-cursor": "var(--ds-text-stronger)",
      "--terminal-selection": "color-mix(in srgb, var(--ds-brand-secondary) 25%, transparent)",
      "--terminal-font-family": "var(--code-font-family)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
      "backdrop-filter": "blur(10px)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-panel-resizer", {
  "@layer": {
    [layers.features]: {
      height: "8px",
      cursor: "row-resize",
      position: "relative",
      "flex-shrink": "0",
      margin: "0",
      border: "0",
      background: "transparent",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-panel-resizer::after", {
  "@layer": {
    [layers.features]: {
      content: '""',
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "40px",
      height: "2px",
      transform: "translate(-50%, -50%)",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
      opacity: "0.5",
      transition:
        "opacity var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-panel-resizer:hover::after", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      background: "color-mix(in srgb, var(--ds-border-accent-soft) 78%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
      padding: "6px 12px",
      "font-size": "var(--font-size-meta)",
      "border-bottom": "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-muted) 72%, transparent),\n    color-mix(in srgb, var(--ds-surface-muted) 62%, transparent)\n  )",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tabs", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "6px",
      flex: "1",
      "min-width": "0",
      "overflow-x": "auto",
      padding: "2px 0",
      "scrollbar-width": "thin",
      "scrollbar-color":
        "color-mix(in srgb, var(--ds-border-stronger) 70%, var(--ds-surface-control-hover))\n    color-mix(in srgb, var(--ds-surface-item) 84%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tabs::-webkit-scrollbar", {
  "@layer": { [layers.features]: { height: "6px" } },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tabs::-webkit-scrollbar-track", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-surface-item) 84%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tabs::-webkit-scrollbar-thumb", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background:
        "color-mix(in srgb, var(--ds-border-stronger) 70%, var(--ds-surface-control-hover))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "4px",
      border: "1px solid transparent",
      background: "transparent",
      padding: "2px 6px 2px 10px",
      "border-radius": "999px",
      "white-space": "nowrap",
      transition:
        "border-color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab.active", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-hover) 76%, transparent),\n    color-mix(in srgb, var(--ds-surface-active) 40%, transparent)\n  )",
      "box-shadow":
        "0 6px 12px color-mix(in srgb, var(--ds-brand-background) 12%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 22%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab-select", {
  "@layer": {
    [layers.features]: {
      border: "0",
      background: "transparent",
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-fine)",
      "letter-spacing": "0.04em",
      "text-transform": "uppercase",
      cursor: "pointer",
      padding: "2px 0",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(
  ".terminal-tab-select:focus-visible,\n.terminal-tab-close:focus-visible,\n.terminal-tab-add:focus-visible,\n.terminal-header-action:focus-visible",
  {
    "@layer": {
      [layers.features]: {
        outline: "2px solid var(--ds-focus-ring)",
        "outline-offset": "1px",
      },
    },
  } as unknown as GlobalStyleRule
);
globalStyle(".terminal-tab.active .terminal-tab-select", {
  "@layer": { [layers.features]: { color: "var(--ds-text-stronger)" } },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab-label", {
  "@layer": {
    [layers.features]: { "max-width": "140px", overflow: "hidden", "text-overflow": "ellipsis" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab-close", {
  "@layer": {
    [layers.features]: {
      border: "0",
      background: "transparent",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "16px",
      height: "16px",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-faint)",
      cursor: "pointer",
      "border-radius": "999px",
      padding: "0",
      transition:
        "color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab-close:hover", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 72%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab-add", {
  "@layer": {
    [layers.features]: {
      border: "1px dashed color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background: "transparent",
      color: "var(--ds-text-muted)",
      padding: "4px 12px",
      "border-radius": "999px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
      transition:
        "border-color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-tab-add:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 62%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 72%, transparent)",
      color: "var(--ds-text-stronger)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-header-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      flex: "0 0 auto",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-header-action", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 78%, transparent)",
      color: "var(--ds-text-muted)",
      padding: "3px 10px",
      "border-radius": "999px",
      "font-size": "var(--font-size-fine)",
      "letter-spacing": "0.03em",
      cursor: "pointer",
      transition:
        "border-color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--ds-motion-fast, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-header-action:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 74%, transparent)",
      "box-shadow": "0 4px 8px color-mix(in srgb, var(--ds-brand-background) 10%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-header-action:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "var(--ds-state-disabled-opacity, 0.58)",
      color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
      "border-color": "var(--ds-state-disabled-border, var(--ds-border-subtle))",
      background: "var(--ds-state-disabled-bg, var(--ds-surface-control-disabled))",
      cursor: "default",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-status-badge", {
  "@layer": {
    [layers.features]: {
      "min-width": "72px",
      justifyContent: "center",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-body", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-height": "0",
      display: "flex",
      overflow: "hidden",
      padding: "0",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-body > .terminal-shell", {
  "@layer": { [layers.features]: { flex: "1", "min-height": "0" } },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-shell", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "flex",
      flex: "1",
      "min-height": "0",
      height: "100%",
      padding: "0",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-surface", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-height": "0",
      height: "100%",
      "border-radius": "0",
      overflow: "hidden",
      background: "var(--terminal-background)",
      "border-top": "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      "box-sizing": "border-box",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(
  ".terminal-surface .xterm,\n.terminal-surface .xterm-screen,\n.terminal-surface .xterm-viewport",
  {
    "@layer": { [layers.features]: { background: "var(--terminal-background)" } },
  } as unknown as GlobalStyleRule
);
globalStyle(".terminal-surface .xterm", {
  "@layer": {
    [layers.features]: {
      height: "100%",
      width: "100%",
      "box-sizing": "border-box",
      padding: "8px 12px 8px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-surface .xterm-viewport", {
  "@layer": { [layers.features]: { height: "100%" } },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-surface .composition-view", {
  "@layer": {
    [layers.features]: {
      background: "var(--terminal-background)",
      color: "var(--terminal-foreground)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-overlay", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      inset: "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "10px",
      color: "var(--ds-text-muted)",
      "pointer-events": "none",
      "text-align": "center",
      "font-size": "var(--font-size-meta)",
      padding: "16px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".terminal-status", {
  "@layer": {
    [layers.features]: {
      "max-width": "280px",
      background: "var(--ds-surface-card-base)",
      border: "1px solid var(--ds-border-subtle)",
      "border-radius": "10px",
      padding: "8px 12px",
      "box-shadow":
        "var(--ds-elevation-1),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 26%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
