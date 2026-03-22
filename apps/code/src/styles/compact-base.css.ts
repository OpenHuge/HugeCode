import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".app.layout-compact .sidebar-resizer", {
  "@layer": { [layers.utilities]: { display: "none" } },
});
applyGlobalStyle(".compact-shell", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "flex-direction": "column",
      flex: "1",
      "min-height": "0",
      position: "relative",
    },
  },
});
applyGlobalStyle(".compact-panel", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "flex-direction": "column",
      flex: "1",
      "min-height": "0",
    },
  },
});
applyGlobalStyle(".app.reduced-transparency .compact-panel", {
  "@layer": { [layers.utilities]: { background: "var(--ds-surface-messages)" } },
});
applyGlobalStyle(".compact-panel .sidebar", {
  "@layer": {
    [layers.utilities]: {
      "border-right": "none",
      padding: "32px 16px 16px",
      flex: "1",
      "min-height": "0",
    },
  },
});
applyGlobalStyle(".app.layout-compact .sidebar-corner-actions", {
  "@layer": {
    [layers.utilities]: {
      position: "static",
      left: "auto",
      bottom: "auto",
      "margin-top": "8px",
      "align-self": "flex-start",
    },
  },
});
applyGlobalStyle(".app.layout-compact .sidebar-account-popover", {
  "@layer": { [layers.utilities]: { bottom: "calc(100% + 8px)" } },
});
applyGlobalStyle(".compact-content", {
  "@layer": {
    [layers.utilities]: {
      display: "flex",
      "flex-direction": "column",
      flex: "1",
      "min-height": "0",
    },
  },
});
applyGlobalStyle(".debug-panel.full", {
  "@layer": { [layers.utilities]: { height: "100%", "border-top": "none" } },
});
applyGlobalStyle(".debug-panel.full .debug-list", {
  "@layer": { [layers.utilities]: { flex: "1" } },
});
applyGlobalStyle(".app.layout-compact .sidebar-resizer", {
  "@layer": { [layers.utilities]: { "@media": { "(max-width: 960px)": { display: "none" } } } },
});
