import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
import { workspaceThreadLaneWidthVar } from "./conversation-layout.css";

applyGlobalStyle(".composer--home,\n.composer--workspace", {
  "@layer": { [layers.features]: { background: "transparent", padding: "0", gap: "8px" } },
});
applyGlobalStyle(".composer--home .composer-bar,\n.composer--workspace .composer-bar", {
  "@layer": {
    [layers.features]: {
      "--composer-meta-control-height": "26px",
      position: "relative",
      "z-index": "40",
      "padding-top": "0",
      gap: "4px",
    },
  },
});
applyGlobalStyle(
  ".composer--home .composer-meta-shell,\n.composer--workspace .composer-meta-shell",
  {
    "@layer": { [layers.features]: { gap: "3px" } },
  }
);
applyGlobalStyle(
  ".composer--home .composer-meta-header,\n.composer--workspace .composer-meta-header",
  {
    "@layer": { [layers.features]: { display: "none" } },
  }
);
applyGlobalStyle(".composer--home .composer-meta,\n.composer--workspace .composer-meta", {
  "@layer": {
    [layers.features]: {
      gap: "4px",
      "row-gap": "3px",
      "flex-wrap": "wrap",
      overflow: "visible",
      "scrollbar-width": "none",
      "padding-bottom": "0",
    },
  },
});
applyGlobalStyle(
  ".composer--home .composer-select-wrap,\n.composer--workspace .composer-select-wrap",
  {
    "@layer": { [layers.features]: { "min-height": "26px", gap: "0", padding: "1px 7px" } },
  }
);
applyGlobalStyle(
  ".composer--home .composer-select-caption,\n.composer--workspace .composer-select-caption",
  { "@layer": { [layers.features]: { display: "none" } } }
);
applyGlobalStyle(".composer--home .composer-icon,\n.composer--workspace .composer-icon", {
  "@layer": { [layers.features]: { display: "none" } },
});
applyGlobalStyle(".composer--home .composer-context,\n.composer--workspace .composer-context", {
  "@layer": { [layers.features]: { display: "none" } },
});
applyGlobalStyle(
  ".composer--home .composer-mode-segment,\n.composer--workspace .composer-mode-segment",
  {
    "@layer": {
      [layers.features]: {
        height: "22px",
        padding: "0 8px",
        "font-size": "var(--font-size-micro)",
      },
    },
  }
);
applyGlobalStyle(
  ".composer--home .composer-access-segment,\n.composer--workspace .composer-access-segment",
  {
    "@layer": {
      [layers.features]: { height: "22px", padding: "0 7px", "font-size": "var(--font-size-tiny)" },
    },
  }
);
applyGlobalStyle(".composer--home .composer-input-area", {
  "@layer": { [layers.features]: { "padding-left": "12px" } },
});
applyGlobalStyle(".composer-surface", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      boxSizing: "border-box",
      "--composer-surface-inline-padding": "0px",
    },
  },
});
applyGlobalStyle(".composer-surface--thread-lane", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "max-width": `calc(${workspaceThreadLaneWidthVar} + (var(--composer-surface-inline-padding) * 2))`,
      margin: "0 auto",
    },
  },
});
applyGlobalStyle(".composer-surface--home", {
  "@layer": {
    [layers.features]: {
      "--composer-surface-inline-padding": "24px",
      position: "relative",
      "z-index": "40",
      padding: "0 var(--composer-surface-inline-padding) 12px",
    },
  },
});
applyGlobalStyle(".composer-surface--workspace", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      "z-index": "40",
      padding: "0",
      background: "transparent",
    },
  },
});
applyGlobalStyle(".composer-surface--home,\n  .composer-surface--workspace", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 768px)": {
          "--composer-surface-inline-padding": "16px",
          padding: "12px var(--composer-surface-inline-padding) 16px",
        },
      },
    },
  },
});
applyGlobalStyle(".composer--home .composer-bar,\n.composer--workspace .composer-bar", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 768px)": {
          "--composer-select-width-model": "100px",
          "--composer-select-width-accounts": "108px",
          "--composer-select-width-effort": "82px",
          "--composer-select-width-approval": "100px",
        },
      },
    },
  },
});
