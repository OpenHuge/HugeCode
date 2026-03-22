import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "12px",
      "flex-shrink": "0",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle(".content", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "min-height": "0",
      "min-width": "0",
      "-webkit-app-region": "no-drag",
      background: "var(--ds-surface-messages)",
      padding: "0",
      "grid-column": "1",
      "grid-row": "1 / 3",
      position: "relative",
      "@media": {
        "(max-width: 960px)": {
          "grid-template-columns": "1fr",
        },
      },
    },
  },
});
applyGlobalStyle(".content-split", {
  "@layer": {
    [layers.features]: {
      position: "relative",
    },
  },
});
applyGlobalStyle(".content-layer", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "0px",
      right: "0px",
      bottom: "0px",
      top: "calc(var(--main-topbar-height) + 8px)",
      display: "flex",
      "min-height": "0",
      "min-width": "0",
      isolation: "isolate",
      background: "transparent",
      overflow: "hidden",
    },
  },
});
applyGlobalStyle(".content-layer-split", {
  "@layer": {
    [layers.features]: {
      top: "calc(var(--main-topbar-height) + 8px)",
      bottom: "10px",
    },
  },
});
applyGlobalStyle(".content-layer-chat", {
  "@layer": {
    [layers.features]: {
      left: "10px",
      right: "calc(50% + 6px)",
      "border-right": "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
    },
  },
});
applyGlobalStyle(".content-layer-diff", {
  "@layer": {
    [layers.features]: {
      left: "calc(50% + 6px)",
      right: "10px",
    },
  },
});
applyGlobalStyle(".content-layer.is-hidden", {
  "@layer": {
    [layers.features]: {
      opacity: "0",
      "pointer-events": "none",
      visibility: "hidden",
      position: "absolute",
      "z-index": "-1",
      contain: "layout style paint",
    },
  },
});
applyGlobalStyle(".content-layer.is-active", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      "pointer-events": "auto",
      visibility: "visible",
      "z-index": "0",
      contain: "layout style paint",
    },
  },
});
