import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".composer-bar", {
  "@layer": {
    [layers.features]: {
      "--composer-meta-control-height": "28px",
      "--composer-select-width-model": "140px",
      "--composer-select-width-collab": "96px",
      "--composer-select-width-accounts": "120px",
      "--composer-select-width-effort": "112px",
      "--composer-select-width-approval": "122px",
      width: "100%",
      "min-width": "0",
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      "justify-content": "flex-start",
      "padding-top": "0",
      "padding-bottom": "0",
      "border-top": "none",
      background: "transparent",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".composer-meta-shell", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
      flex: "1",
      display: "flex",
      "flex-direction": "column",
      gap: "3px",
    },
  },
});
applyGlobalStyle(".composer-meta-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "4px",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".composer-meta-kicker", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.1em",
      color: "var(--ds-text-faint)",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".composer-meta-summary", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "4px",
      "flex-wrap": "wrap",
      "justify-content": "flex-end",
    },
  },
});
applyGlobalStyle(".composer-meta-badge", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "min-height": "20px",
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-item) 82%, transparent)",
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-micro)",
      "line-height": "var(--line-height-100)",
      padding: "0 8px",
      "max-width": "180px",
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
    },
  },
});
applyGlobalStyle(".composer-meta", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      width: "100%",
      "min-width": "0",
      gap: "3px",
      "row-gap": "3px",
      "flex-wrap": "wrap",
      "padding-bottom": "0px",
    },
  },
});
applyGlobalStyle(".composer-meta::-webkit-scrollbar", {
  "@layer": { [layers.features]: { height: "6px" } },
});
applyGlobalStyle(".composer-meta::-webkit-scrollbar-thumb", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-border-muted) 82%, transparent)",
    },
  },
});
applyGlobalStyle(".composer-mode-group", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "min-width": "0",
      "min-height": "var(--composer-meta-control-height)",
      margin: "0",
      "border-radius": "0",
      border: "none",
      background: "transparent",
      padding: "0",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".composer-mode-segment", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
      "border-radius": "999px",
      height: "26px",
      padding: "0 10px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".composer-mode-segment:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-active) 38%, var(--ds-surface-item))",
    },
  },
});
applyGlobalStyle(".composer-mode-segment.is-active", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-active) 56%, var(--ds-surface-item))",
    },
  },
});
applyGlobalStyle(".composer-mode-segment:disabled", {
  "@layer": {
    [layers.features]: { opacity: "var(--ds-state-disabled-opacity, 0.58)", cursor: "not-allowed" },
  },
});
applyGlobalStyle(".composer-access-group", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "min-width": "0",
      "min-height": "var(--composer-meta-control-height)",
      margin: "0",
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-muted) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 90%, var(--ds-surface-control))",
      padding: "2px",
      gap: "2px",
    },
  },
});
applyGlobalStyle(".composer-access-segment", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
      "border-radius": "999px",
      height: "26px",
      padding: "0 9px",
      "font-size": "var(--font-size-micro)",
      "font-weight": "600",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".composer-access-segment:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-active) 36%, var(--ds-surface-item))",
    },
  },
});
applyGlobalStyle(".composer-access-segment.is-active", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-active) 54%, var(--ds-surface-item))",
    },
  },
});
applyGlobalStyle(".composer-access-segment:disabled", {
  "@layer": {
    [layers.features]: { opacity: "var(--ds-state-disabled-opacity, 0.58)", cursor: "not-allowed" },
  },
});
applyGlobalStyle(".composer-plan-toggle-wrap", {
  "@layer": { [layers.features]: { padding: "2px 8px" } },
});
applyGlobalStyle(".composer-plan-toggle", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      cursor: "pointer",
      "user-select": "none",
    },
  },
});
applyGlobalStyle(".composer-plan-toggle-input", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      width: "12px",
      height: "12px",
      "accent-color": "var(--message-link-color)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".composer-plan-toggle-icon", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      width: "16px",
      height: "16px",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".composer-plan-toggle-icon svg", {
  "@layer": { [layers.features]: { width: "16px", height: "16px" } },
});
applyGlobalStyle(".composer-plan-toggle-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      "line-height": "var(--line-height-100)",
    },
  },
});
applyGlobalStyle(
  ".composer-plan-toggle:has(.composer-plan-toggle-input:checked) .composer-plan-toggle-icon,\n.composer-plan-toggle:has(.composer-plan-toggle-input:checked) .composer-plan-toggle-label",
  { "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } } }
);
applyGlobalStyle(".composer-plan-toggle-input:disabled", {
  "@layer": { [layers.features]: { cursor: "not-allowed" } },
});
applyGlobalStyle(
  ".composer-plan-toggle:has(.composer-plan-toggle-input:disabled) .composer-plan-toggle-icon,\n.composer-plan-toggle:has(.composer-plan-toggle-input:disabled) .composer-plan-toggle-label",
  { "@layer": { [layers.features]: { opacity: "0.6" } } }
);
applyGlobalStyle(".app.layout-phone .composer-input", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          "grid-template-columns": "minmax(0, 1fr) auto",
          gap: "8px",
          "align-items": "flex-start",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-input.is-phone-tall", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { "align-items": "end" } } } },
});
applyGlobalStyle(".app.layout-phone .composer-input-row", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { gap: "6px", "align-items": "flex-start" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-input.is-phone-tall .composer-input-row", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { "align-items": "flex-end" } } },
  },
});
applyGlobalStyle(".app.layout-phone .composer-input > .composer-action", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { "align-self": "flex-start", "margin-top": "2px" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-input.is-phone-tall > .composer-action", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { "align-self": "flex-end", "margin-top": "0" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-action--mobile-menu", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { "align-self": "flex-start" } } },
  },
});
applyGlobalStyle(".app.layout-phone .composer-input.is-phone-tall .composer-action--mobile-menu", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { "align-self": "flex-end" } } },
  },
});
applyGlobalStyle(
  ".app.layout-phone .composer-action--expand,\n  .app.layout-phone .composer-action--mic,\n  .app.layout-phone .composer-action--queue",
  {
    "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
  }
);
applyGlobalStyle(".app.layout-phone .composer-mobile-menu", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          display: "inline-flex",
          "align-self": "flex-start",
          "margin-top": "2px",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-input.is-phone-tall .composer-mobile-menu", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { "align-self": "flex-end", "margin-top": "0" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-action--mobile-menu", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { display: "inline-flex" } } },
  },
});
applyGlobalStyle(".app.layout-phone .composer textarea", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          "min-height": "44px",
          "max-height": "148px",
          height: "44px",
          "font-size": "var(--font-size-title)",
          padding: "6px 2px",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-quick-tools", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
});
applyGlobalStyle(".app.layout-phone .composer-runtime-hints", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
});
applyGlobalStyle(".app.layout-phone .composer-action", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { width: "34px", height: "34px" } } },
  },
});
applyGlobalStyle(".app.layout-phone .composer-bar", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": { gap: "6px", "padding-top": "2px", "align-items": "center" },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-meta-shell", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { gap: "3px", width: "100%", "min-width": "0" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-meta-header", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
});
applyGlobalStyle(".app.layout-phone .composer:not(.composer--home) .composer-meta", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          width: "100%",
          "min-width": "0",
          "flex-wrap": "nowrap",
          "overflow-x": "auto",
          gap: "3px",
          "padding-bottom": "2px",
          "scrollbar-width": "none",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-meta::-webkit-scrollbar", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
});
applyGlobalStyle(".app.layout-phone .composer-context", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
});
applyGlobalStyle(".app.layout-phone .composer-mode-segment", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          height: "22px",
          padding: "0 7px",
          "font-size": "var(--font-size-micro)",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-access-segment", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          height: "22px",
          padding: "0 7px",
          "font-size": "var(--font-size-tiny)",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-select-wrap", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { gap: "0", padding: "1px 0" } } },
  },
});
applyGlobalStyle(
  ".app.layout-phone .composer-select-control--approval,\n  .app.layout-phone .composer-select-control--execution",
  {
    "@layer": {
      [layers.features]: { "@media": { "(max-width: 720px)": { "max-width": "88px" } } },
    },
  }
);
applyGlobalStyle(
  ".app.layout-phone .composer-select-caption,\n  .app.layout-phone .composer-icon",
  {
    "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
  }
);
applyGlobalStyle(".app.layout-phone .composer-select-wrap--accounts", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { display: "none" } } } },
});
applyGlobalStyle(".app.layout-phone .composer-select", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { "font-size": "var(--font-size-meta)" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-select-trigger", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { "font-size": "var(--font-size-meta)" } },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-select-menu", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          "min-width": "152px",
          "max-width": "min(280px, calc(100vw - 20px))",
        },
      },
    },
  },
});
applyGlobalStyle(".app.layout-phone .composer-select-option", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": { "min-height": "28px", "font-size": "var(--font-size-fine)" },
      },
    },
  },
});
applyGlobalStyle(".composer-bar", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 480px)": { gap: "4px", "padding-top": "4px" } } },
  },
});
applyGlobalStyle(".composer-meta", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 480px)": {
          "flex-wrap": "nowrap",
          "overflow-x": "auto",
          gap: "4px",
          "padding-bottom": "2px",
          "scrollbar-width": "none",
        },
      },
    },
  },
});
applyGlobalStyle(".composer-meta::-webkit-scrollbar", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 480px)": { display: "none" } } } },
});
applyGlobalStyle(".composer-context", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 480px)": { display: "none" } } } },
});
