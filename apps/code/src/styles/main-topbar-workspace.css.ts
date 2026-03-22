import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".main-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "flex-start",
      "align-items": "center",
      gap: "16px",
      padding:
        "12px calc(var(--main-panel-padding) + var(--main-header-right-overlay-gutter, 0px)) 10px var(--main-panel-padding)",
      background: "transparent",
      "-webkit-app-region": "drag",
      "grid-column": "1 / -1",
      "grid-row": "1",
      position: "sticky",
      top: "0",
      "z-index": "3",
      "backdrop-filter": "none",
      "min-height": "var(--main-topbar-height)",
      border: "none",
      borderRadius: "0",
      "box-shadow": "none",
      overflow: "visible",
    },
  },
});
applyGlobalStyle(".app.sidebar-collapsed .main-header", {
  "@layer": {
    [layers.features]: {
      "padding-left":
        "calc(\n    var(--main-panel-padding) +\n    var(--titlebar-toggle-size, 28px) +\n    var(--titlebar-toggle-side-gap, 12px)\n  )",
    },
  },
});
applyGlobalStyle(".app.sidebar-collapsed [data-home-page='true'] .main-header", {
  "@layer": {
    [layers.features]: {
      "padding-left": "var(--main-panel-padding)",
    },
  },
});
applyGlobalStyle(".app.layout-compact.sidebar-collapsed .main-header", {
  "@layer": {
    [layers.features]: {
      "padding-left": "var(--topbar-compact-padding, 16px)",
    },
  },
});
applyGlobalStyle(".app.reduced-transparency .main-header", {
  "@layer": {
    [layers.features]: {
      "backdrop-filter": "none",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 12%, transparent),\n    0 2px 8px color-mix(in srgb, var(--ds-brand-background) 10%, transparent)",
    },
  },
});
applyGlobalStyle(".main-header-leading", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "12px",
      "min-width": "0",
      flex: "1 1 auto",
      overflow: "hidden",
      "-webkit-app-region": "no-drag",
      position: "relative",
      "z-index": "1",
    },
  },
});
applyGlobalStyle(".main-header-leading .back-button", {
  "@layer": {
    [layers.features]: {
      "margin-left": "-4px",
      padding: "0",
      border: "1px solid var(--ds-shell-control-border)",
      background: "var(--ds-shell-control-bg)",
      color: "var(--ds-text-muted)",
      "box-shadow": "var(--ds-shell-control-shadow)",
    },
  },
});
applyGlobalStyle(".workspace-title-line", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      "min-height": "28px",
      "min-width": "0",
      "white-space": "nowrap",
      flex: "1",
    },
  },
});
applyGlobalStyle(".workspace-title-stack", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "min-width": "0",
      flex: "1",
    },
  },
});
applyGlobalStyle(".workspace-thread-strip", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      flex: "0 1 auto",
      "min-width": "0",
      "max-width": "min(18vw, 180px)",
      "@media": {
        "(max-width: 960px)": {
          "max-width": "min(26vw, 160px)",
        },
      },
    },
  },
});
applyGlobalStyle(
  '.workspace-title-line [data-workspace-chrome="pill"],\n.workspace-thread-strip [data-workspace-chrome="pill"]',
  {
    "@layer": {
      [layers.features]: {
        "border-radius": "999px",
        "box-shadow": "none",
        transition:
          "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
      },
    },
  }
);
applyGlobalStyle(".workspace-thread-summary-pill", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "min-width": "0",
      "max-width": "100%",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".workspace-thread-summary-label", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".workspace-thread-summary-count", {
  "@layer": {
    [layers.features]: {
      flex: "0 0 auto",
      color: "var(--ds-text-faint)",
      "font-variant-numeric": "tabular-nums",
    },
  },
});
applyGlobalStyle(".workspace-thread-chip", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "max-width": "min(170px, 22vw)",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "@media": {
        "(max-width: 960px)": {
          "max-width": "min(160px, 34vw)",
        },
      },
    },
  },
});
applyGlobalStyle('.workspace-thread-chip[data-workspace-chrome="pill"]', {
  "@layer": {
    [layers.features]: {
      "padding-inline": "10px",
      "min-height": "24px",
    },
  },
});
applyGlobalStyle(
  ".workspace-thread-summary-pill:focus-visible,\n.workspace-thread-chip:focus-visible,\n.workspace-thread-overflow-button:focus-visible,\n.workspace-thread-overflow-option:focus-visible",
  {
    "@layer": {
      [layers.features]: {
        outline: "var(--ds-shell-control-focus-outline)",
        "outline-offset": "2px",
      },
    },
  }
);
applyGlobalStyle(".workspace-thread-chip-status", {
  "@layer": {
    [layers.features]: {
      width: "6px",
      height: "6px",
      "border-radius": "999px",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle('.workspace-thread-chip-status[data-status-tone="warning"]', {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--status-warning) 88%, var(--ds-surface-approval))",
      "box-shadow": "0 0 6px color-mix(in srgb, var(--status-warning) 46%, transparent)",
    },
  },
});
applyGlobalStyle('.workspace-thread-chip-status[data-status-tone="progress"]', {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-brand-primary) 86%, white 14%)",
      "box-shadow": "0 0 6px color-mix(in srgb, var(--ds-brand-primary) 42%, transparent)",
    },
  },
});
applyGlobalStyle('.workspace-thread-chip-status[data-status-tone="success"]', {
  "@layer": {
    [layers.features]: {
      background: "var(--status-success)",
      "box-shadow": "0 0 6px color-mix(in srgb, var(--status-success) 32%, transparent)",
    },
  },
});
applyGlobalStyle(
  ".workspace-thread-chip-status.processing,\n.workspace-thread-chip-status.awaitingApproval,\n.workspace-thread-chip-status.awaitingInput",
  {
    "@layer": {
      [layers.features]: {
        animation: "pulse 1.35s ease-in-out infinite",
      },
    },
  }
);
applyGlobalStyle(".workspace-thread-chip-label", {
  "@layer": {
    [layers.features]: {
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".workspace-thread-overflow", {
  "@layer": {
    [layers.features]: {
      position: "relative",
    },
  },
});
applyGlobalStyle(".workspace-thread-overflow-button", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "min-width": "30px",
      height: "20px",
      padding: "0 7px",
      "border-radius": "999px",
      border: "1px dashed var(--ds-border-subtle)",
      color: "var(--ds-text-faint)",
      "font-size": "var(--font-size-micro)",
      "letter-spacing": "0.04em",
      background: "transparent",
    },
  },
});
applyGlobalStyle(".workspace-thread-overflow-button:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 76%, var(--ds-surface-item))",
      transform: "none",
    },
  },
});
applyGlobalStyle(".workspace-thread-overflow-popover", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: "0",
      "min-width": "220px",
      "max-width": "min(280px, 72vw)",
      "--ds-popover-item-radius": "10px",
      "--ds-popover-item-padding-block": "10px",
      "--ds-popover-item-padding-inline": "12px",
      "--ds-popover-item-hit-area": "42px",
      "--ds-popover-item-gap": "10px",
      "--ds-popover-item-font-size": "var(--font-size-title-sm)",
      "--ds-popover-item-font-weight": "530",
      "--ds-popover-item-text": "var(--ds-text-strong)",
      "--ds-popover-item-text-active": "var(--ds-text-stronger)",
      "--ds-popover-item-hover":
        "color-mix(in srgb, var(--ds-surface-control-hover) 78%, var(--ds-surface-item))",
      "--ds-popover-item-hover-border":
        "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      "--ds-popover-item-active":
        "color-mix(in srgb, var(--ds-surface-hover) 82%, var(--ds-surface-item))",
      "--ds-popover-item-active-border":
        "color-mix(in srgb, var(--ds-border-accent-soft) 68%, transparent)",
      "--ds-popover-item-icon-size": "16px",
      "--ds-popover-item-icon-color": "var(--ds-text-muted)",
      "border-radius": "calc(var(--ds-popover-radius) + 2px)",
      padding: "8px",
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
      "z-index": "14",
    },
  },
});
applyGlobalStyle(".workspace-thread-overflow-option", {
  "@layer": {
    [layers.features]: {
      width: "100%",
    },
  },
});
applyGlobalStyle(".workspace-thread-overflow-label", {
  "@layer": {
    [layers.features]: {
      display: "block",
      width: "100%",
    },
  },
});
applyGlobalStyle(".workspace-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "clamp(1rem, 0.92rem + 0.2vw, 1.125rem)",
      "font-weight": "680",
      "line-height": "var(--line-height-title-lg)",
      "letter-spacing": "-0.02em",
      "max-width": "min(32vw, 420px)",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".workspace-branch", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-meta)",
      "font-weight": "500",
      "line-height": "var(--line-height-meta)",
      "min-width": "0",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      display: "block",
    },
  },
});
applyGlobalStyle(".workspace-branch-static-row", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
    },
  },
});
