import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".app.layout-phone", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "flex-direction": "column",
      "grid-template-columns": "none",
      "grid-template-rows": "none",
      "--phone-tabbar-offset": "calc(var(--tabbar-height, 54px) + env(safe-area-inset-bottom))",
    },
  },
});
applyGlobalStyle(
  ".app.layout-phone.reduced-transparency,\n.app.layout-phone.reduced-transparency .compact-shell,\n.app.layout-phone.reduced-transparency .compact-panel",
  {
    "@layer": { [layers.utilities]: { background: "var(--ds-surface-messages)" } },
  }
);
applyGlobalStyle(".app.layout-phone .drag-strip", {
  "@layer": { [layers.utilities]: { height: "22px" } },
});
applyGlobalStyle(".app.layout-phone .sidebar", {
  "@layer": {
    [layers.utilities]: {
      "flex-direction": "column",
      "align-items": "stretch",
      "overflow-x": "hidden",
      "padding-top": "calc(32px + env(safe-area-inset-top))",
      "padding-bottom": "16px",
    },
  },
});
applyGlobalStyle(".app.layout-phone .home", {
  "@layer": { [layers.utilities]: { "padding-top": "calc(20px + env(safe-area-inset-top))" } },
});
applyGlobalStyle(".app.layout-phone .messages-full", {
  "@layer": { [layers.utilities]: { padding: "10px 12px 8px" } },
});
applyGlobalStyle(".app.layout-phone .composer", {
  "@layer": {
    [layers.utilities]: {
      position: "sticky",
      bottom: "var(--phone-tabbar-offset, 0px)",
      "z-index": "2",
      padding: "6px 8px calc(6px + var(--phone-composer-safe-bottom, 0px))",
      "border-top": "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      "backdrop-filter": "blur(14px) saturate(1.06)",
    },
  },
});
applyGlobalStyle('html[data-mobile-composer-focus="true"] .app.layout-phone', {
  "@layer": {
    [layers.utilities]: {
      "--phone-composer-safe-bottom": "env(safe-area-inset-bottom)",
      "--phone-tabbar-offset": "0px",
    },
  },
});
applyGlobalStyle("[data-compact-empty='true']", {
  "@layer": {
    [layers.utilities]: {
      flex: "1",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      gap: "10px",
      color: "var(--ds-text-muted)",
      "text-align": "center",
      padding: "0 24px",
    },
  },
});
applyGlobalStyle(".compact-git", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
      flex: "1",
      "min-height": "0",
    },
  },
});
applyGlobalStyle(".compact-git-list", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "flex-direction": "column",
      flex: "1",
      "min-height": "0",
      overflow: "hidden",
    },
  },
});
applyGlobalStyle(".compact-git-list > .ds-panel", {
  "@layer": { [layers.utilities]: { flex: "1", "min-height": "0" } },
});
applyGlobalStyle(".compact-git-viewer", {
  "@layer": { [layers.utilities]: { flex: "1", "min-height": "0", overflow: "hidden" } },
});
applyGlobalStyle(".compact-git-viewer .diff-viewer", {
  "@layer": { [layers.utilities]: { height: "100%" } },
});
applyGlobalStyle(".compact-git-back", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "align-items": "center",
      gap: "6px",
      padding: "8px 12px 6px",
      "border-bottom": "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-topbar)",
    },
  },
});
applyGlobalStyle(".app.layout-phone .compact-panel > .compact-git-back:first-child", {
  "@layer": { [layers.utilities]: { "padding-top": "calc(8px + env(safe-area-inset-top))" } },
});
applyGlobalStyle(".compact-git-tabs", {
  "@layer": {
    [layers.utilities]: {
      width: "100%",
      background: "transparent",
      border: "none",
      padding: "0",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".compact-git-switch-button", {
  "@layer": {
    [layers.utilities]: {
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      "border-radius": "999px",
      padding: "6px 12px",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth),\n    border-color var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".compact-git-switch-button[data-state='active']", {
  "@layer": {
    [layers.utilities]: {
      color: "var(--ds-text-strong)",
      "border-color": "var(--ds-border-accent-soft)",
      background: "var(--ds-surface-active)",
    },
  },
});
applyGlobalStyle(".compact-git-switch-button:disabled", {
  "@layer": { [layers.utilities]: { opacity: "0.45", cursor: "default" } },
});
