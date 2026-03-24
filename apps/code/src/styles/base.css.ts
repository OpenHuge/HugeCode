import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".app.reduced-transparency", {
  "@layer": {
    [layers.reset]: {
      "--reduced-surface-core":
        "color-mix(in srgb, var(--ds-brand-background) 92%, var(--ds-text-primary))",
      "--reduced-surface-elevated":
        "color-mix(in srgb, var(--ds-brand-background) 88%, var(--ds-text-primary))",
      "--reduced-surface-accent":
        "color-mix(in srgb, var(--ds-brand-background) 84%, var(--ds-text-primary))",
      "--surface-sidebar": "color-mix(in srgb, var(--reduced-surface-core) 98%, transparent)",
      "--surface-sidebar-opaque": "var(--reduced-surface-core)",
      "--surface-topbar": "color-mix(in srgb, var(--reduced-surface-core) 96%, transparent)",
      "--surface-right-panel": "color-mix(in srgb, var(--reduced-surface-core) 95%, transparent)",
      "--surface-composer": "color-mix(in srgb, var(--reduced-surface-core) 96%, transparent)",
      "--surface-messages": "color-mix(in srgb, var(--reduced-surface-core) 95%, transparent)",
      "--surface-card": "color-mix(in srgb, var(--reduced-surface-elevated) 95%, transparent)",
      "--surface-card-strong": "color-mix(in srgb, var(--reduced-surface-accent) 97%, transparent)",
      "--surface-card-muted":
        "color-mix(in srgb, var(--reduced-surface-elevated) 94%, transparent)",
      "--surface-item": "color-mix(in srgb, var(--reduced-surface-elevated) 92%, transparent)",
      "--surface-control": "color-mix(in srgb, var(--reduced-surface-accent) 70%, transparent)",
      "--surface-control-hover":
        "color-mix(in srgb, var(--reduced-surface-accent) 80%, transparent)",
      "--surface-control-disabled":
        "color-mix(in srgb, var(--reduced-surface-accent) 50%, transparent)",
      "--surface-hover": "color-mix(in srgb, var(--reduced-surface-accent) 72%, transparent)",
      "--surface-active": "color-mix(in srgb, var(--ds-color-white) 16%, transparent)",
      "--surface-approval": "color-mix(in srgb, var(--reduced-surface-core) 92%, transparent)",
      "--surface-debug": "color-mix(in srgb, var(--reduced-surface-core) 92%, transparent)",
      "--surface-command": "color-mix(in srgb, var(--reduced-surface-core) 95%, transparent)",
      "--surface-diff-card": "color-mix(in srgb, var(--reduced-surface-elevated) 90%, transparent)",
      "--surface-bubble": "color-mix(in srgb, var(--reduced-surface-accent) 90%, transparent)",
      "--surface-bubble-user": "color-mix(in srgb, var(--ds-color-white) 24%, transparent)",
      "--surface-context-core": "color-mix(in srgb, var(--reduced-surface-core) 98%, transparent)",
      "--surface-popover": "color-mix(in srgb, var(--reduced-surface-core) 99.5%, transparent)",
    },
  },
});
applyGlobalStyle("*", {
  "@layer": {
    [layers.reset]: {
      "box-sizing": "border-box",
      "scrollbar-width": "thin",
      "scrollbar-color":
        "var(\n      --scrollbar-thumb,\n      color-mix(in srgb, var(--ds-border-stronger) 70%, var(--ds-surface-control))\n    )\n    var(--scrollbar-track, transparent)",
    },
  },
});
applyGlobalStyle("*::-webkit-scrollbar", {
  "@layer": { [layers.reset]: { width: "10px", height: "10px" } },
});
applyGlobalStyle("*::-webkit-scrollbar-track", {
  "@layer": {
    [layers.reset]: { background: "var(--scrollbar-track, transparent)", "border-radius": "999px" },
  },
});
applyGlobalStyle("*::-webkit-scrollbar-thumb", {
  "@layer": {
    [layers.reset]: {
      "border-radius": "999px",
      border: "2px solid transparent",
      "background-clip": "padding-box",
      "background-color":
        "var(\n    --scrollbar-thumb,\n    color-mix(in srgb, var(--ds-border-stronger) 70%, var(--ds-surface-control))\n  )",
    },
  },
});
applyGlobalStyle("*::-webkit-scrollbar-thumb:hover", {
  "@layer": {
    [layers.reset]: {
      "background-color":
        "var(\n    --scrollbar-thumb-hover,\n    color-mix(in srgb, var(--ds-border-accent-soft) 48%, var(--ds-surface-control-hover))\n  )",
    },
  },
});
applyGlobalStyle("*::-webkit-scrollbar-thumb:active", {
  "@layer": {
    [layers.reset]: {
      "background-color":
        "var(\n    --scrollbar-thumb-hover,\n    color-mix(in srgb, var(--ds-border-accent-soft) 48%, var(--ds-surface-control-hover))\n  )",
    },
  },
});
applyGlobalStyle("*::-webkit-scrollbar-corner", {
  "@layer": { [layers.reset]: { background: "transparent" } },
});
applyGlobalStyle("html,\nbody", {
  "@layer": {
    [layers.reset]: {
      margin: "0",
      background: "var(--ds-brand-background)",
      overflow: "hidden",
      width: "100%",
      height: "100%",
      "-webkit-font-smoothing": "antialiased",
      "-moz-osx-font-smoothing": "grayscale",
    },
  },
});
applyGlobalStyle("#root", {
  "@layer": {
    [layers.reset]: {
      height: "var(--app-height, 100dvh)",
      "min-height": "var(--app-height, 100dvh)",
      overflow: "hidden",
    },
  },
});
applyGlobalStyle(".app", {
  "@layer": {
    [layers.reset]: {
      height: "var(--app-height, 100dvh)",
      "min-height": "var(--app-height, 100dvh)",
      width: "100vw",
      display: "grid",
      "grid-template-columns": "var(--sidebar-width, 260px) 1fr",
      background: "var(--ds-surface-messages)",
      "border-radius": "0",
      overflow: "hidden",
      position: "relative",
      "--main-topbar-height": "44px",
      "--shell-chrome-inset-x": "16px",
      "--shell-chrome-inset-top": "10px",
      "--shell-chrome-row-bottom": "6px",
      "--shell-chrome-control-size": "44px",
      "--shell-chrome-control-radius": "10px",
      "--shell-chrome-compact-control-size": "28px",
      "--shell-chrome-compact-control-radius": "6px",
      "--shell-chrome-control-gap": "12px",
      "--shell-chrome-toolbar-border":
        "color-mix(in srgb, var(--ds-border-subtle) 54%, transparent)",
      "--shell-chrome-toolbar-bg":
        "color-mix(in srgb, var(--ds-surface-shell) 92%, var(--ds-surface-topbar))",
      "--shell-chrome-toolbar-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
      "--shell-chrome-pill-border": "color-mix(in srgb, var(--ds-border-subtle) 58%, transparent)",
      "--shell-chrome-pill-bg":
        "color-mix(in srgb, var(--ds-surface-shell) 90%, var(--ds-surface-item))",
      "--shell-chrome-pill-bg-hover":
        "color-mix(in srgb, var(--ds-surface-hover) 74%, var(--ds-surface-shell))",
      "--shell-chrome-pill-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
      "--shell-chrome-pill-live-border":
        "color-mix(in srgb, var(--status-success) 32%, transparent)",
      "--shell-chrome-pill-live-bg":
        "color-mix(in srgb, var(--status-success) 10%, var(--ds-surface-item))",
      "--shell-chrome-pill-live-text":
        "color-mix(in srgb, var(--status-success) 78%, var(--ds-text-stronger))",
      "--shell-chrome-pill-attention-border":
        "color-mix(in srgb, var(--status-warning) 32%, transparent)",
      "--shell-chrome-pill-attention-bg":
        "color-mix(in srgb, var(--status-warning) 10%, var(--ds-surface-item))",
      "--shell-chrome-pill-attention-text":
        "color-mix(in srgb, var(--status-warning) 78%, var(--ds-text-stronger))",
      "--sidebar-icon-button-size": "40px",
      "--sidebar-icon-size": "18px",
      transition:
        "grid-template-columns var(--duration-slow, 240ms) var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1))",
      "font-family": "var(--ui-font-family)",
    },
  },
});
applyGlobalStyle(".app.sidebar-collapsed", {
  "@layer": { [layers.reset]: { "grid-template-columns": "0px 1fr" } },
});
applyGlobalStyle(".app.layout-desktop", {
  "@layer": {
    [layers.reset]: {
      "--app-shell-gutter": "0px",
      width: "100vw",
      height: "var(--app-height, 100dvh)",
      "min-height": "var(--app-height, 100dvh)",
      margin: "0",
      "border-radius": "0",
      border: "none",
      background: "var(--ds-surface-messages)",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".app.layout-desktop.reduced-transparency", {
  "@layer": {
    [layers.reset]: {
      "box-shadow":
        "0 14px 30px color-mix(in srgb, var(--ds-brand-background) 28%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 16%, transparent)",
    },
  },
});
applyGlobalStyle('body[data-resizing="sidebar"] .app,\nbody[data-resizing="sidebar"] .main', {
  "@layer": { [layers.overrides]: { transition: "none" } },
});
applyGlobalStyle('body[data-resizing="right-panel"] .main', {
  "@layer": { [layers.overrides]: { transition: "none" } },
});
applyGlobalStyle(
  'body[data-resizing="debug-panel"] .debug-panel,\nbody[data-resizing="debug-panel"] .debug-panel-resizer,\nbody[data-resizing="debug-panel"] .debug-panel-resizer::after',
  { "@layer": { [layers.overrides]: { transition: "none" } } }
);
applyGlobalStyle(".drag-strip", {
  "@layer": {
    [layers.reset]: {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      height: "var(--titlebar-height, 24px)",
      "z-index": "2",
    },
  },
});
applyGlobalStyle(':root body [data-tauri-drag-region="false"]', {
  "@layer": { [layers.reset]: { "-webkit-app-region": "no-drag" } },
});
applyGlobalStyle(".titlebar-controls", {
  "@layer": {
    [layers.reset]: {
      position: "absolute",
      top: "calc(var(--shell-chrome-inset-top, 10px) + 3px)",
      left: "0",
      right: "0",
      height: "var(--main-topbar-height, 44px)",
      "z-index": "4",
      "pointer-events": "none",
    },
  },
});
applyGlobalStyle(".titlebar-toggle", {
  "@layer": {
    [layers.reset]: {
      position: "absolute",
      top: "50%",
      "-webkit-app-region": "no-drag",
      "pointer-events": "auto",
      transform: "translateY(calc(-50% + var(--titlebar-toggle-offset, 0px)))",
      transition:
        "opacity var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".titlebar-control-group", {
  "@layer": {
    [layers.reset]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "flex-end",
      "flex-wrap": "nowrap",
      gap: "6px",
      "max-width": "min(48vw, 640px)",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".titlebar-toggle-left", {
  "@layer": {
    [layers.reset]: {
      left: "max(10px, calc(var(--shell-chrome-inset-x, 16px) + var(--titlebar-inset-left, 0px)))",
    },
  },
});
applyGlobalStyle(".titlebar-toggle-right", {
  "@layer": { [layers.reset]: { right: "var(--shell-chrome-inset-x, 16px)" } },
});
applyGlobalStyle(".app:not(.right-panel-collapsed) .titlebar-toggle-right", {
  "@layer": {
    [layers.reset]: {
      right:
        "calc(var(--shell-chrome-inset-x, 16px) + var(--right-panel-width-live, var(--right-panel-width, 360px)) + 12px)",
    },
  },
});
applyGlobalStyle(
  ".app.right-panel-collapsed:has(.main-header .main-header-actions .sidebar-toggle-button)\n  .titlebar-toggle-right",
  {
    "@layer": { [layers.reset]: { opacity: "0", "pointer-events": "none" } },
  }
);
applyGlobalStyle(".sidebar-resizer", {
  "@layer": {
    [layers.reset]: {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: "calc(var(--sidebar-width, 272px) - 6px)",
      width: "12px",
      margin: "0",
      padding: "0",
      border: "0",
      background: "transparent",
      "-webkit-appearance": "none",
      appearance: "none",
      cursor: "col-resize",
      "z-index": "3",
      "touch-action": "none",
      transition:
        "opacity var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".sidebar-resizer::before", {
  "@layer": { [layers.reset]: { content: "none" } },
});
applyGlobalStyle(".sidebar-resizer::after", {
  "@layer": {
    [layers.reset]: {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "2px",
      height: "34px",
      "border-radius": "var(--ds-radius-full)",
      transform: "translate(-50%, -50%) scaleY(0.78)",
      background: "var(--ds-border-accent-soft)",
      opacity: "0",
      transition:
        "opacity var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), transform var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(
  '.sidebar-resizer:hover::before,\n.sidebar-resizer:focus-visible::before,\nbody[data-resizing="sidebar"] .sidebar-resizer::before',
  { "@layer": { [layers.reset]: { content: "none" } } }
);
applyGlobalStyle(".sidebar-resizer:hover::after", {
  "@layer": { [layers.reset]: { opacity: "1", transform: "translate(-50%, -50%) scaleY(1)" } },
});
applyGlobalStyle(
  '.sidebar-resizer:focus-visible::after,\nbody[data-resizing="sidebar"] .sidebar-resizer::after',
  {
    "@layer": {
      [layers.reset]: {
        opacity: "1",
        transform: "translate(-50%, -50%) scaleY(1)",
        background: "var(--ds-border-accent)",
      },
    },
  }
);
applyGlobalStyle(".sidebar-resizer:focus-visible", {
  "@layer": { [layers.reset]: { outline: "none" } },
});
applyGlobalStyle(".app", {
  "@layer": {
    [layers.reset]: { "@media": { "(max-width: 960px)": { "grid-template-columns": "1fr" } } },
  },
});
applyGlobalStyle(".app.layout-desktop", {
  "@layer": {
    [layers.reset]: {
      "@media": {
        "(max-width: 960px)": {
          width: "100vw",
          height: "var(--app-height, 100dvh)",
          "min-height": "var(--app-height, 100dvh)",
          margin: "0",
          "border-radius": "0",
          border: "0",
          "box-shadow": "none",
        },
      },
    },
  },
});
applyGlobalStyle(".app > .sidebar", {
  "@layer": {
    [layers.reset]: {
      "@media": {
        "(max-width: 960px)": {
          "flex-direction": "row",
          "align-items": "center",
          "overflow-x": "auto",
        },
      },
    },
  },
});
applyGlobalStyle(".sidebar-resizer", {
  "@layer": { [layers.reset]: { "@media": { "(max-width: 960px)": { display: "none" } } } },
});
applyGlobalStyle(':root[data-tauri-runtime="false"] .drag-strip', {
  "@layer": { [layers.reset]: { display: "none" } },
});
applyGlobalStyle(':root[data-tauri-runtime="false"] body *', {
  "@layer": { [layers.reset]: { "-webkit-app-region": "no-drag" } },
});
applyGlobalStyle("*,\n  *::before,\n  *::after", {
  "@layer": {
    [layers.reset]: {
      "@media": {
        "(prefers-reduced-motion: reduce)": {
          "animation-duration": "0.01ms",
          "animation-iteration-count": "1",
          "transition-duration": "0.01ms",
          "scroll-behavior": "auto",
        },
      },
    },
  },
});
