import { globalKeyframes } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";
import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".sidebar", {
  "@layer": {
    [layers.features]: {
      "--sidebar-padding": "var(--shell-chrome-inset-x, 16px)",
      "--sidebar-logo-button-size": "var(--shell-chrome-control-size, 40px)",
      "--sidebar-logo-icon-size": "24px",
      "--sidebar-icon-button-size": "40px",
      "--sidebar-icon-size": "18px",
      "--sidebar-linear-row-hover":
        "color-mix(in srgb, var(--ds-surface-hover) 64%, var(--ds-surface-sidebar))",
      "--sidebar-linear-row-active":
        "color-mix(in srgb, var(--ds-surface-active) 40%, var(--ds-surface-sidebar))",
      "--sidebar-linear-border": "color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      "--sidebar-toolbar-button-hover":
        "color-mix(in srgb, var(--ds-surface-control-hover) 74%, var(--ds-surface-item))",
      "--sidebar-toolbar-button-active":
        "color-mix(in srgb, var(--ds-surface-active) 68%, var(--ds-surface-control))",
      "--sidebar-thread-row-radius": "8px",
      padding: "var(--shell-chrome-inset-top, 16px) 12px 0",
      background: "var(--ds-surface-sidebar)",
      display: "flex",
      flexDirection: "column",
      "box-shadow": "none",
      gap: "6px",
      "-webkit-app-region": "no-drag",
      "min-height": "0",
      overflow: "hidden",
      position: "relative",
      transition:
        "opacity var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    transform var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle('[data-sidebar-frame="true"].sidebar', {
  "@layer": {
    [layers.features]: {
      paddingTop: "calc(var(--shell-chrome-inset-top, 10px) + 3px)",
      gap: "8px",
      boxSizing: "border-box",
    },
  },
});
applyGlobalStyle('.app-shell-frame[data-sidebar-frame="true"].sidebar', {
  "@layer": {
    [layers.features]: {
      display: "flex !important",
      flexDirection: "column !important",
      minHeight: "0 !important",
      height: "100%",
    },
  },
});
applyGlobalStyle('[data-sidebar-surface="kanna-card"].sidebar', {
  "@layer": {
    [layers.features]: {
      padding: "12px 10px 10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
      borderRadius: "24px",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-sidebar) 96%, white 4%), color-mix(in srgb, var(--ds-surface-shell) 98%, transparent))",
      boxShadow: "0 10px 24px color-mix(in srgb, var(--ds-brand-background) 5%, transparent)",
    },
  },
});
applyGlobalStyle(':root[data-theme="light"] .sidebar', {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-sidebar)",
      "border-right-color": "color-mix(in srgb, var(--ds-border-subtle) 36%, transparent)",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 22%, transparent),\n    1px 0 0 color-mix(in srgb, var(--ds-border-subtle) 58%, transparent)",
    },
  },
});
applyGlobalStyle(":root:not([data-theme]) .sidebar", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(prefers-color-scheme: light)": {
          background: "var(--ds-surface-sidebar)",
          "border-right-color": "color-mix(in srgb, var(--ds-border-subtle) 36%, transparent)",
          "box-shadow":
            "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 22%, transparent),\n    1px 0 0 color-mix(in srgb, var(--ds-border-subtle) 58%, transparent)",
        },
      },
    },
  },
});
applyGlobalStyle(".sidebar,\n.sidebar *", {
  "@layer": { [layers.features]: { "-webkit-user-select": "none", "user-select": "none" } },
});
applyGlobalStyle('.sidebar input,\n.sidebar textarea,\n.sidebar [contenteditable="true"]', {
  "@layer": { [layers.features]: { "-webkit-user-select": "text", "user-select": "text" } },
});
applyGlobalStyle(".workspace-drop-overlay", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      inset: "0",
      "z-index": "8",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      background: "color-mix(in srgb, var(--ds-color-black) 40%, transparent)",
      opacity: "0",
      "pointer-events": "none",
      transition: "opacity var(--duration-normal) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".workspace-drop-overlay.is-active", {
  "@layer": { [layers.features]: { opacity: "1", "backdrop-filter": "blur(10px)" } },
});
applyGlobalStyle(".workspace-drop-overlay-text", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-title)",
      "font-weight": "600",
      "letter-spacing": "0.02em",
      color: "var(--ds-text-strong)",
      display: "inline-flex",
      "align-items": "center",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".workspace-drop-overlay-icon", {
  "@layer": { [layers.features]: { width: "18px", height: "18px", opacity: "0.8" } },
});
applyGlobalStyle(".workspace-drop-overlay-text.is-busy", {
  "@layer": {
    [layers.features]: {
      color: "transparent",
      background:
        "linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--ds-color-white) 25%, transparent),\n    color-mix(in srgb, var(--ds-color-white) 85%, transparent),\n    color-mix(in srgb, var(--ds-color-white) 25%, transparent)\n  )",
      "background-size": "200% 100%",
      "background-clip": "text",
      "-webkit-background-clip": "text",
      animation: "drop-text-shimmer var(--ds-motion-shimmer-duration, 1.2s) ease-in-out infinite",
    },
  },
});
globalKeyframes("drop-text-shimmer", {
  "0%": { backgroundPosition: "200% 0" },
  "100%": { backgroundPosition: "-200% 0" },
});
applyGlobalStyle(".sidebar-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      gap: "10px",
      padding: "0 2px",
      "margin-top": "0",
      "margin-bottom": "0",
      "min-height": "var(--main-topbar-height, 44px)",
      "-webkit-app-region": "no-drag",
      position: "relative",
      "z-index": "2",
    },
  },
});
applyGlobalStyle('[data-sidebar-header-surface="kanna-card"]', {
  "@layer": {
    [layers.features]: {
      borderBottom: "none",
      paddingBottom: "6px",
    },
  },
});
applyGlobalStyle(".sidebar-header-start", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      "min-height": "var(--main-topbar-height, 44px)",
      paddingLeft: "2px",
    },
  },
});
applyGlobalStyle(".sidebar-section-label", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "font-size": "var(--font-size-content)",
      "font-weight": "650",
      "letter-spacing": "-0.02em",
      lineHeight: typographyValues.content.lineHeight,
    },
  },
});
applyGlobalStyle(".sidebar-brand-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      "min-height": "var(--sidebar-logo-button-size)",
      "margin-bottom": "var(--shell-chrome-row-bottom, 8px)",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle(".sidebar-brand-mark", {
  "@layer": {
    [layers.features]: {
      width: "var(--sidebar-logo-button-size)",
      height: "var(--sidebar-logo-button-size)",
      padding: "0",
      "border-radius": "var(--shell-chrome-control-radius, 10px)",
      border: "1px solid var(--ds-shell-control-border)",
      background: "var(--ds-shell-control-bg)",
      color: "var(--ds-text-stronger)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "box-shadow": "var(--ds-shell-control-shadow)",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".sidebar-brand-mark svg", {
  "@layer": {
    [layers.features]: {
      width: "var(--sidebar-logo-icon-size)",
      height: "var(--sidebar-logo-icon-size)",
      "stroke-width": "1.7",
    },
  },
});
applyGlobalStyle(".sidebar-brand-mark:hover,\n.sidebar-brand-mark:focus-visible", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "var(--ds-shell-control-bg-hover)",
      "border-color": "var(--ds-shell-control-border-hover)",
      "box-shadow": "var(--ds-shell-control-shadow-hover)",
    },
  },
});
applyGlobalStyle(".sidebar-brand-toggle", {
  "@layer": {
    [layers.features]: {
      width: "var(--sidebar-logo-button-size)",
      height: "var(--sidebar-logo-button-size)",
      padding: "0",
      "border-radius": "var(--shell-chrome-control-radius, 10px)",
      border: "1px solid var(--ds-shell-control-border)",
      background: "var(--ds-shell-control-bg)",
      color: "var(--ds-text-muted)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "box-shadow": "var(--ds-shell-control-shadow)",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".sidebar-brand-toggle:hover,\n.sidebar-brand-toggle:focus-visible", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "var(--ds-shell-control-bg-hover)",
      "border-color": "var(--ds-shell-control-border-hover)",
      "box-shadow": "var(--ds-shell-control-shadow-hover)",
    },
  },
});
applyGlobalStyle(".sidebar-brand-toggle svg", {
  "@layer": { [layers.features]: { width: "22px", height: "22px" } },
});
applyGlobalStyle(".sidebar-header-title", {
  "@layer": {
    [layers.features]: { display: "flex", "align-items": "center", gap: "8px", "min-width": "0" },
  },
});
applyGlobalStyle(".sidebar-title-group", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "7px",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".sidebar-title-button", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
      "min-height": "32px",
      padding: "0 8px",
      "border-radius": "7px",
    },
  },
});
applyGlobalStyle(".sidebar-new-project-button svg", {
  "@layer": { [layers.features]: { width: "18px", height: "18px", "stroke-width": "2.2" } },
});
applyGlobalStyle(".sidebar-title-button:hover,\n.sidebar-title-button:focus-visible", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 82%, transparent)",
    },
  },
});
applyGlobalStyle(".sidebar-title-add", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "var(--sidebar-icon-button-size)",
      height: "var(--sidebar-icon-button-size)",
      padding: "0",
      border: "1px solid var(--ds-shell-control-border)",
      background: "var(--ds-shell-control-bg)",
      color: "var(--ds-text-muted)",
      "border-radius": "var(--shell-chrome-control-radius, 10px)",
      "box-shadow": "var(--ds-shell-control-shadow)",
      transition:
        "color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".sidebar-title-add svg", {
  "@layer": {
    [layers.features]: { width: "var(--sidebar-icon-size)", height: "var(--sidebar-icon-size)" },
  },
});
applyGlobalStyle(".sidebar-title-add:hover,\n.sidebar-title-add:focus-visible", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "var(--ds-shell-control-bg-hover)",
      "border-color": "var(--ds-shell-control-border-hover)",
      "box-shadow": "var(--ds-shell-control-shadow-hover)",
    },
  },
});
applyGlobalStyle(".sidebar-header-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "flex-end",
      gap: "6px",
      "margin-left": "auto",
    },
  },
});
applyGlobalStyle(".sidebar-action-wrapper", {
  "@layer": { [layers.features]: { position: "relative" } },
});
applyGlobalStyle(".sidebar-filter-menu", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: "0",
      "z-index": "1200",
      width: "220px",
      padding: "8px",
      "border-radius": "14px",
      border: "1px solid var(--sidebar-linear-border)",
      background: "color-mix(in srgb, var(--ds-surface-popover) 96%, var(--ds-surface-sidebar))",
      "box-shadow": "0 10px 30px color-mix(in srgb, var(--ds-brand-background) 18%, transparent)",
      "backdrop-filter": "blur(12px)",
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".sidebar-filter-menu-label", {
  "@layer": {
    [layers.features]: {
      padding: "3px 10px 5px",
      color: "var(--ds-text-faint)",
      "font-size": "var(--font-size-fine)",
      "font-weight": "560",
      "letter-spacing": "0.01em",
    },
  },
});
applyGlobalStyle(".sidebar-filter-menu-divider", {
  "@layer": {
    [layers.features]: {
      height: "1px",
      margin: "4px 10px",
      background: "var(--sidebar-linear-border)",
    },
  },
});
applyGlobalStyle(".sidebar-filter-menu", {
  "@layer": {
    [layers.features]: {
      "--ds-popover-item-radius": "10px",
      "--ds-popover-item-padding-block": "10px",
      "--ds-popover-item-padding-inline": "12px",
      "--ds-popover-item-hit-area": "40px",
      "--ds-popover-item-gap": "11px",
      "--ds-popover-item-text": "var(--ds-text-strong)",
      "--ds-popover-item-text-active": "var(--ds-text-stronger)",
      "--ds-popover-item-font-size": "var(--font-size-title-sm)",
      "--ds-popover-item-font-weight": "540",
      "--ds-popover-item-hover": "var(--sidebar-linear-row-hover)",
      "--ds-popover-item-hover-border":
        "color-mix(in srgb, var(--sidebar-linear-border) 82%, transparent)",
      "--ds-popover-item-active": "var(--sidebar-linear-row-active)",
      "--ds-popover-item-active-border":
        "color-mix(in srgb, var(--sidebar-linear-border) 82%, transparent)",
      "--ds-popover-item-icon-size": "18px",
      "--ds-popover-item-icon-color": "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".sidebar-filter-menu .ds-popover-item:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "0.45",
      color: "var(--ds-text-fainter)",
      background: "transparent",
    },
  },
});
applyGlobalStyle(".sidebar-action", {
  "@layer": {
    [layers.features]: {
      width: "28px",
      height: "28px",
      "min-width": "28px",
      padding: "0",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-surface-item) 72%, transparent)",
      border: "1px solid transparent",
      color: "var(--ds-text-muted)",
      opacity: "1",
      "box-shadow": "none",
      transition:
        "color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    transform var(--duration-fast) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".sidebar-action svg", {
  "@layer": { [layers.features]: { width: "16px", height: "16px", "stroke-width": "1.75" } },
});
applyGlobalStyle(".sidebar-action [data-panel-split-side]", {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      display: "block",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".sidebar-action:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 72%, var(--ds-surface-item))",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 26%, transparent)",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".sidebar-action.is-active", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "transparent",
      "border-color": "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".sidebar-action:focus-visible,\n.sidebar-action-btn:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "var(--ds-shell-control-focus-outline)",
      "outline-offset": "2px",
    },
  },
});
applyGlobalStyle(".sidebar-action:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "0.45",
      color: "var(--ds-text-fainter)",
      background: "transparent",
      border: "1px solid transparent",
      cursor: "not-allowed",
    },
  },
});
applyGlobalStyle(".sidebar-action.is-spinning svg", {
  "@layer": { [layers.features]: { animation: "sidebar-refresh-spin 0.88s linear infinite" } },
});
applyGlobalStyle(".sidebar-action-btn", {
  "@layer": {
    [layers.features]: {
      width: "var(--sidebar-icon-button-size)",
      height: "var(--sidebar-icon-button-size)",
      padding: "0",
      "border-radius": "var(--shell-chrome-control-radius, 10px)",
      border: "1px solid var(--ds-shell-control-border)",
      background: "var(--ds-shell-control-bg)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      color: "var(--ds-text-muted)",
      "box-shadow": "var(--ds-shell-control-shadow)",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    transform var(--duration-fast) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(
  ".sidebar-action-btn:hover:not(:disabled),\n.sidebar-action-btn:focus-visible,\n.sidebar-action-btn.is-active",
  {
    "@layer": {
      [layers.features]: {
        color: "var(--ds-text-stronger)",
        background: "var(--ds-shell-control-bg-hover)",
        "border-color": "var(--ds-shell-control-border-hover)",
        "box-shadow": "var(--ds-shell-control-shadow-hover)",
        transform: "none",
      },
    },
  }
);
applyGlobalStyle(".sidebar-action-btn svg", {
  "@layer": {
    [layers.features]: { width: "var(--sidebar-icon-size)", height: "var(--sidebar-icon-size)" },
  },
});
applyGlobalStyle(".sidebar-action-btn:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "var(--ds-state-disabled-opacity, 0.58)",
      color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
      border: "1px solid var(--ds-state-disabled-border, transparent)",
      background: "var(--ds-state-disabled-bg, var(--ds-surface-control-disabled))",
      "box-shadow": "none",
      cursor: "not-allowed",
    },
  },
});
applyGlobalStyle('.sidebar-action-btn[aria-busy="true"]', {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      background:
        "var(\n    --ds-state-loading-bg,\n    color-mix(in srgb, var(--ds-surface-active) 38%, var(--ds-surface-control))\n  )",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".sidebar-sort-menu", {
  "@layer": { [layers.features]: { position: "relative" } },
});
applyGlobalStyle(
  ".sidebar-sort-toggle:focus-visible,\n.sidebar-search-toggle:focus-visible,\n.sidebar-refresh-toggle:focus-visible,\n.sidebar-brand-mark:focus-visible,\n.sidebar-brand-toggle:focus-visible",
  {
    "@layer": {
      [layers.features]: {
        outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
        "outline-offset": "2px",
      },
    },
  }
);
applyGlobalStyle(".sidebar-sort-dropdown", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "calc(100% + 8px)",
      right: "0",
      "min-width": "140px",
      "border-radius": "12px",
      border: "1px solid var(--ds-border-subtle)",
      background: "color-mix(in srgb, var(--ds-surface-popover) 98%, var(--ds-surface-card-base))",
      "box-shadow":
        "0 8px 16px color-mix(in srgb, var(--ds-brand-background) 14%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 14%, transparent)",
      padding: "6px",
      "z-index": "10",
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
      "backdrop-filter": "blur(12px)",
    },
  },
});
applyGlobalStyle(".sidebar-sort-option", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      border: "1px solid transparent",
      "border-radius": "8px",
      background: "transparent",
      color: "var(--ds-text-muted)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "flex-start",
      gap: "8px",
      "min-height": "30px",
      padding: "6px 9px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "560",
      "text-align": "left",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".sidebar-sort-option svg", {
  "@layer": { [layers.features]: { width: "13px", height: "13px", "flex-shrink": "0" } },
});
applyGlobalStyle(
  ".sidebar-sort-option:hover,\n.sidebar-sort-option:focus-visible,\n.sidebar-sort-option.is-active",
  {
    "@layer": {
      [layers.features]: {
        color: "var(--ds-text-stronger)",
        background:
          "color-mix(in srgb, var(--ds-surface-control-hover) 76%, var(--ds-surface-item))",
        "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
        transform: "none",
        "box-shadow": "none",
      },
    },
  }
);
applyGlobalStyle(".sidebar-refresh-icon.spinning", {
  "@layer": {
    [layers.features]: {
      animation: "sidebar-refresh-spin var(--ds-motion-spin-duration, 0.88s) linear infinite",
    },
  },
});
globalKeyframes("sidebar-refresh-spin", {
  to: { transform: "rotate(360deg)" },
});
applyGlobalStyle(".sidebar-search", {
  "@layer": {
    [layers.features]: { position: "sticky", top: "0", "z-index": "4", padding: "0 4px 8px" },
  },
});
applyGlobalStyle(".sidebar.search-open .sidebar-header", {
  "@layer": { [layers.features]: { "margin-bottom": "0" } },
});
applyGlobalStyle(".sidebar.search-open", {
  "@layer": { [layers.features]: { gap: "8px" } },
});
applyGlobalStyle(".sidebar.search-open .sidebar-search", {
  "@layer": { [layers.features]: { padding: "0 4px 8px" } },
});
applyGlobalStyle(".sidebar-search:not(.is-open)", {
  "@layer": { [layers.features]: { display: "none" } },
});
applyGlobalStyle(".sidebar-search-input", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      padding: "9px 32px 9px 12px",
      "border-radius": "10px",
      border: "1px solid transparent",
      background: "var(--sidebar-linear-row-hover)",
      color: "var(--ds-text-strong)",
      "font-size": "var(--font-size-fine)",
      outline: "none",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".sidebar-search-input::placeholder", {
  "@layer": { [layers.features]: { color: "var(--ds-text-muted)" } },
});
applyGlobalStyle(".sidebar-search-input:focus", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-focus-ring) 44%, transparent)",
      background: "var(--sidebar-linear-row-active)",
      "box-shadow": "0 0 0 1px color-mix(in srgb, var(--ds-focus-ring) 18%, transparent)",
    },
  },
});
applyGlobalStyle(".sidebar-search-clear", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      right: "11px",
      top: "50%",
      transform: "translateY(-49%)",
      width: "22px",
      height: "22px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-title)",
      cursor: "pointer",
      padding: "0",
      "border-radius": "0",
      "font-weight": "600",
      transition: "none",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(
  "button.sidebar-search-clear:hover:not(:disabled),\nbutton.sidebar-search-clear:active:not(:disabled)",
  {
    "@layer": {
      [layers.features]: {
        background: "transparent",
        color: "var(--ds-text-strong)",
        transform: "translateY(-49%)",
        "box-shadow": "none",
      },
    },
  }
);
applyGlobalStyle(".sidebar-search-clear:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "1px solid var(--ds-focus-ring)",
      "outline-offset": "2px",
    },
  },
});
applyGlobalStyle(".subtitle", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-title-lg)",
      "font-weight": "650",
      "margin-top": "4px",
      display: "inline-flex",
      "align-items": "center",
      gap: "7px",
    },
  },
});
applyGlobalStyle(".sidebar-header .subtitle", {
  "@layer": {
    [layers.features]: { "margin-top": "0", lineHeight: typographyValues.fine.lineHeight },
  },
});
applyGlobalStyle(".subtitle-button", {
  "@layer": {
    [layers.features]: {
      background: "none",
      border: "none",
      padding: "0",
      color: "inherit",
      "font-family": "inherit",
      cursor: "pointer",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle(".sidebar-nav-icon", {
  "@layer": { [layers.features]: { width: "15px", height: "15px" } },
});
applyGlobalStyle(".sidebar .empty", {
  "@layer": {
    [layers.features]: {
      margin: "2px 2px 0",
      border: "1px solid var(--ds-border-subtle)",
      "border-radius": "12px",
      padding: "12px 11px",
      background: "var(--ds-surface-card-base)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 14%, transparent)",
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-fine)",
      lineHeight: typographyValues.fine.lineHeight,
      "letter-spacing": "0.01em",
      "text-wrap": "pretty",
    },
  },
});
applyGlobalStyle(".sidebar-empty-action", {
  "@layer": {
    [layers.features]: {
      display: "block",
      width: "100%",
      padding: "0",
      border: "none",
      background: "transparent",
      boxShadow: "none",
      borderRadius: "0",
      "text-align": "left",
      cursor: "pointer",
      transition:
        "transform var(--duration-normal) var(--ease-smooth),\n    filter var(--duration-normal) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".sidebar-empty-action:hover", {
  "@layer": {
    [layers.features]: {
      background: "transparent",
      color: "inherit",
      transform: "translateY(-1px)",
      filter: "brightness(1.02)",
    },
  },
});
applyGlobalStyle(".sidebar-empty-action:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "4px",
    },
  },
});
applyGlobalStyle(".sidebar-body", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-height": "0",
      "overflow-y": "auto",
      "overflow-x": "hidden",
      "padding-top": "2px",
      "padding-bottom": "8px",
      "scroll-padding-top": "16px",
      "-webkit-app-region": "no-drag",
      "margin-right": "0",
      "padding-right": "0",
      "-webkit-mask-repeat": "no-repeat",
      "mask-repeat": "no-repeat",
      "-webkit-mask-size": "100% 100%",
      "mask-size": "100% 100%",
    },
  },
});
applyGlobalStyle(".sidebar-body.fade-top.fade-bottom", {
  "@layer": {
    [layers.features]: {
      "-webkit-mask-image":
        "linear-gradient(\n    to bottom,\n    transparent 0,\n    var(--ds-color-black) 12px,\n    var(--ds-color-black) calc(100% - 12px),\n    transparent 100%\n  )",
      "mask-image":
        "linear-gradient(\n    to bottom,\n    transparent 0,\n    var(--ds-color-black) 12px,\n    var(--ds-color-black) calc(100% - 12px),\n    transparent 100%\n  )",
    },
  },
});
applyGlobalStyle(".sidebar-body.fade-top:not(.fade-bottom)", {
  "@layer": {
    [layers.features]: {
      "-webkit-mask-image":
        "linear-gradient(\n    to bottom,\n    transparent 0,\n    var(--ds-color-black) 12px,\n    var(--ds-color-black) 100%\n  )",
      "mask-image":
        "linear-gradient(\n    to bottom,\n    transparent 0,\n    var(--ds-color-black) 12px,\n    var(--ds-color-black) 100%\n  )",
    },
  },
});
applyGlobalStyle(".sidebar-body.fade-bottom:not(.fade-top)", {
  "@layer": {
    [layers.features]: {
      "-webkit-mask-image":
        "linear-gradient(\n    to bottom,\n    var(--ds-color-black) 0,\n    var(--ds-color-black) calc(100% - 12px),\n    transparent 100%\n  )",
      "mask-image":
        "linear-gradient(\n    to bottom,\n    var(--ds-color-black) 0,\n    var(--ds-color-black) calc(100% - 12px),\n    transparent 100%\n  )",
    },
  },
});
applyGlobalStyle(".workspace-row-title", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      "min-width": "0",
    },
  },
});
