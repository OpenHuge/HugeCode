import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
import { conversationOptimalWidth, conversationOptimalWidthVar } from "./conversation-layout.css";
import "./main-workspace-overlays.css";
import "./main-topbar-workspace.css";

applyGlobalStyle(".main", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "0",
      padding: "0",
      position: "relative",
      "-webkit-app-region": "no-drag",
      "min-height": "0",
      "min-width": "0",
      "--main-panel-padding": "18px",
      "--conversation-optimal-width": conversationOptimalWidth,
      "--workspace-thread-lane-width": conversationOptimalWidthVar,
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-messages) 98%, white 2%), color-mix(in srgb, var(--ds-surface-app) 100%, transparent))",
      "border-left": "none",
    },
  },
});
applyGlobalStyle(".app.reduced-transparency .main", {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-messages)",
    },
  },
});
applyGlobalStyle(".main-header", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      gap: "16px",
      "min-width": "0",
      overflow: "visible",
      "-webkit-app-region": "drag",
      padding:
        "calc(var(--shell-chrome-inset-top, 10px) - 1px) calc(var(--main-panel-padding, 12px) + var(--main-header-right-overlay-gutter, 0px)) calc(var(--shell-chrome-row-bottom, 6px) + 3px) var(--main-panel-padding, 12px)",
      border: "none",
      borderRadius: "0",
      background: "transparent",
      boxShadow: "none",
    },
  },
});
applyGlobalStyle(".workspace-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "min-width": "0",
      flex: "1",
      gap: "12px",
    },
  },
});
applyGlobalStyle(".main-header-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "align-self": "flex-start",
      "flex-wrap": "wrap",
      "justify-content": "flex-end",
      margin: "0 0 0 auto",
      gap: "6px",
      "-webkit-app-region": "no-drag",
      "flex-shrink": "0",
      "max-width": "min(100%, 420px)",
      padding: "0",
      "border-radius": "0",
      border: "0",
      background: "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".diff-view-toggle", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "4px",
      border: "none",
      "border-radius": "0",
      background: "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".diff-view-toggle-button", {
  "@layer": {
    [layers.features]: {
      border: "none",
      "border-radius": "var(--shell-chrome-compact-control-radius)",
      background: "transparent",
      color: "var(--ds-text-muted)",
      padding: "0",
      width: "var(--shell-chrome-compact-control-size)",
      height: "var(--shell-chrome-compact-control-size)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      cursor: "pointer",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".diff-view-toggle-button:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      transform: "none",
      "box-shadow": "none",
      background: "var(--ds-shell-control-bg-hover)",
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".diff-view-toggle-button.is-active", {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-shell-control-bg-active)",
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".open-app-menu", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "inline-flex",
    },
  },
});
applyGlobalStyle(".open-app-button", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "4px",
      border: "none",
      "border-radius": "0",
      overflow: "visible",
      background: "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle('.open-app-button [data-workspace-shell-action="true"]', {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".open-app-label", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "7px",
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      "line-height": "var(--line-height-meta)",
    },
  },
});
applyGlobalStyle(".open-app-icon", {
  "@layer": {
    [layers.features]: {
      width: "18px",
      height: "18px",
      "flex-shrink": "0",
      display: "block",
      "object-fit": "contain",
      "transform-origin": "center",
      overflow: "visible",
    },
  },
});
applyGlobalStyle(".open-app-icon--trigger", {
  "@layer": {
    [layers.features]: {
      width: "18px",
      height: "18px",
    },
  },
});
applyGlobalStyle(".open-app-icon--menu", {
  "@layer": {
    [layers.features]: {
      width: "18px",
      height: "18px",
    },
  },
});
applyGlobalStyle(
  '.open-app-button [data-workspace-shell-action="true"][data-segment="trailing"] svg',
  {
    "@layer": {
      [layers.features]: {
        opacity: "0.8",
        transition:
          "transform var(--duration-fast) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    opacity var(--duration-fast) var(--ds-motion-ease-standard, var(--ease-smooth))",
      },
    },
  }
);
applyGlobalStyle(
  '.open-app-button [data-workspace-shell-action="true"][data-segment="icon"][data-active="true"] svg',
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
        transform: "rotate(180deg)",
      },
    },
  }
);
applyGlobalStyle(".open-app-picker", {
  "@layer": {
    [layers.features]: {
      width: "auto",
      display: "inline-flex",
      "flex-shrink": "0",
      "--ds-select-trigger-leading-gap": "11px",
    },
  },
});
applyGlobalStyle(".open-app-picker-trigger", {
  "@layer": {
    [layers.features]: {
      "min-width": "var(--shell-chrome-compact-control-size)",
    },
  },
});
applyGlobalStyle(".open-app-button.is-disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
    },
  },
});
applyGlobalStyle(
  '.open-app-button [data-workspace-shell-action="true"][data-segment="leading"]:disabled',
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
        color: "var(--ds-state-disabled-text, var(--ds-text-fainter))",
      },
    },
  }
);
applyGlobalStyle(".open-app-dropdown", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      "min-width": "160px",
      padding: "4px",
      "--ds-select-menu-padding": "4px",
      "--ds-select-option-leading-gap": "11px",
      "--ds-select-option-min-height": "32px",
      "--ds-select-option-padding": "4px 8px",
      border: "1px solid var(--ds-border-subtle)",
      "box-shadow":
        "0 8px 16px color-mix(in srgb, var(--ds-brand-background) 14%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 14%, transparent)",
    },
  },
});
applyGlobalStyle(".open-app-picker .ds-select-trigger-leading", {
  "@layer": {
    [layers.features]: {
      width: "21px",
      "min-width": "21px",
    },
  },
});
applyGlobalStyle(".open-app-dropdown .ds-select-option-leading", {
  "@layer": {
    [layers.features]: {
      width: "21px",
      "min-width": "21px",
    },
  },
});
applyGlobalStyle(".open-app-option", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "letter-spacing": "0.01em",
    },
  },
});
applyGlobalStyle(".open-app-option:hover,\n.open-app-option.is-active", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".launch-script-menu", {
  "@layer": {
    [layers.features]: {
      position: "relative",
    },
  },
});
applyGlobalStyle(".launch-script-buttons", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "2px",
    },
  },
});
applyGlobalStyle(".launch-script-button-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "500",
      "line-height": "var(--line-height-meta)",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".launch-script-popover", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      right: "0",
      top: "calc(100% + 8px)",
      "min-width": "240px",
      padding: "12px",
      "border-radius": "var(--ds-radius-md)",
      "z-index": "5",
      border: "1px solid var(--ds-border-subtle)",
      "box-shadow":
        "0 8px 16px color-mix(in srgb, var(--ds-brand-background) 14%, transparent),\n    inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 14%, transparent)",
    },
  },
});
applyGlobalStyle(".launch-script-help", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".launch-script-cluster", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "4px",
    },
  },
});
