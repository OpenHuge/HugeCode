import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
import "./settings-layout-panels.css";
import "./settings-projects-open-apps.css";

applyGlobalStyle(".settings-titlebar", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      padding: "12px 16px",
      "border-bottom": "1px solid var(--ds-border-muted)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-topbar) 88%, transparent),\n    color-mix(in srgb, var(--ds-surface-topbar) 98%, transparent)\n  )",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 36%, transparent)",
    },
  },
});
applyGlobalStyle(".app.reduced-transparency .settings-titlebar", {
  "@layer": {
    [layers.features]: {
      "backdrop-filter": "none",
    },
  },
});
applyGlobalStyle(".settings-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-content)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".settings-close", {
  "@layer": {
    [layers.features]: {
      padding: "4px",
    },
  },
});
applyGlobalStyle(".settings-body", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      display: "grid",
      "grid-template-columns": "200px minmax(0, 1fr)",
      "min-height": "0",
      "@media": {
        "(max-width: 720px)": {
          "grid-template-columns": "1fr",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-master,\n.settings-detail", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
      "min-height": "0",
    },
  },
});
applyGlobalStyle(".settings-master", {
  "@layer": {
    [layers.features]: {
      display: "flex",
    },
  },
});
applyGlobalStyle(".settings-master .settings-sidebar", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "@media": {
        "(max-width: 720px)": {
          "border-right": "none",
          padding: "10px 12px 14px",
          gap: "8px",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-detail", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
    },
  },
});
applyGlobalStyle(".settings-sidebar", {
  "@layer": {
    [layers.features]: {
      padding: "16px",
      "border-right": "1px solid transparent",
      background: "var(--ds-surface-sidebar)",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".settings-nav", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "@media": {
        "(max-width: 720px)": {
          padding: "10px 6px 10px 10px",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-nav svg", {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
    },
  },
});
applyGlobalStyle(".settings-nav-list", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".settings-nav-group", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
      "margin-top": "8px",
      padding: "8px 0 0",
      "border-top": "1px solid color-mix(in srgb, var(--ds-border-muted) 72%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-nav-advanced-toggle", {
  "@layer": {
    [layers.features]: {
      opacity: "0.92",
    },
  },
});
applyGlobalStyle(".settings-nav-advanced-items", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
      margin: "2px 0 0 16px",
      padding: "2px 0 0 12px",
      "border-left": "1px solid color-mix(in srgb, var(--ds-border-muted) 72%, transparent)",
      "@media": {
        "(max-width: 720px)": {
          margin: "2px 0 0 12px",
          padding: "2px 0 0 8px",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-content", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-height": "0",
      padding: "20px 24px",
      "overflow-y": "auto",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-messages) 88%, transparent),\n    color-mix(in srgb, var(--ds-surface-messages) 98%, transparent)\n  )",
      "scrollbar-width": "thin",
      "@media": {
        "(max-width: 720px)": {
          padding: "16px",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-mobile-detail-header", {
  "@layer": {
    [layers.features]: {
      display: "none",
      "@media": {
        "(max-width: 720px)": {
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          gap: "10px",
          padding: "10px 12px",
          "border-bottom": "1px solid var(--ds-border-muted)",
          background: "var(--ds-surface-topbar)",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-mobile-back", {
  "@layer": {
    [layers.features]: {
      border: "1px solid transparent",
      background: "transparent",
      "border-radius": "var(--ds-radius-md)",
      color: "var(--ds-text-strong)",
      padding: "6px 8px",
      display: "inline-flex",
      "align-items": "center",
      gap: "4px",
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
    },
  },
});
applyGlobalStyle(".settings-mobile-back:hover", {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-control)",
      "border-color": "var(--ds-border-muted)",
    },
  },
});
applyGlobalStyle(".settings-mobile-back svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
    },
  },
});
applyGlobalStyle(".settings-mobile-detail-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      color: "var(--ds-text-subtle)",
    },
  },
});
applyGlobalStyle(".settings-field", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      "margin-bottom": "18px",
    },
  },
});
applyGlobalStyle(".settings-field-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".settings-field-label--section", {
  "@layer": {
    [layers.features]: {
      "margin-bottom": "10px",
    },
  },
});
applyGlobalStyle(".settings-field-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "flex-start",
      "flex-wrap": "wrap",
      gap: "10px 12px",
      "min-height": "40px",
      padding: "2px 0",
    },
  },
});
applyGlobalStyle(".settings-field-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "flex-wrap": "wrap",
      gap: "10px 12px",
    },
  },
});
applyGlobalStyle(".settings-field-actions svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
      "margin-right": "6px",
    },
  },
});
applyGlobalStyle(".settings-button-compact", {
  "@layer": {
    [layers.features]: {
      "min-height": "var(--ds-button-height-sm)",
      padding: "var(--ds-button-padding-sm)",
      "font-size": "var(--ds-button-font-sm)",
      gap: "var(--ds-button-gap-sm)",
      "border-radius": "var(--ds-radius-button)",
    },
  },
});
applyGlobalStyle(".settings-profile-button", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px",
      minHeight: "36px",
      padding: "6px 10px",
      borderRadius: "var(--ds-radius-md)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
      color: "var(--ds-text-strong)",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".settings-profile-button:hover", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-default) 78%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-profile-button.is-selected", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-selected) 84%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 84%, transparent)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-profile-button:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
      outlineOffset: "2px",
    },
  },
});
applyGlobalStyle(".settings-profile-badge", {
  "@layer": {
    [layers.features]: {
      maxWidth: "240px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});
applyGlobalStyle(".settings-profile-default-badge", {
  "@layer": { [layers.features]: { flexShrink: "0" } },
});
applyGlobalStyle(".settings-help", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
    },
  },
});
applyGlobalStyle(".settings-help-error", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-danger)",
    },
  },
});
applyGlobalStyle(".settings-help-inline", {
  "@layer": {
    [layers.features]: {
      "margin-right": "4px",
    },
  },
});
applyGlobalStyle(".settings-command-preview", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      padding: "10px 12px",
      "border-radius": "var(--ds-radius-md)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-strong)",
      "font-family": "var(--code-font-family)",
      "font-size": "var(--font-size-fine)",
      "line-height": "var(--line-height-140)",
      "overflow-x": "auto",
      "white-space": "pre-wrap",
      "word-break": "break-word",
    },
  },
});
applyGlobalStyle(".settings-agents-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".settings-agents-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".settings-icon-button", {
  "@layer": {
    [layers.features]: {
      width: "28px",
      height: "28px",
      padding: "0",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "var(--shell-chrome-control-radius, 10px)",
      border: "1px solid var(--ds-shell-control-border)",
      background: "var(--ds-shell-control-bg)",
      color: "var(--ds-text-muted)",
      "box-shadow": "var(--ds-shell-control-shadow)",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    box-shadow var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".settings-icon-button svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
    },
  },
});
applyGlobalStyle(".settings-agents-error", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "color-mix(in srgb, var(--status-error) 78%, white)",
      background: "color-mix(in srgb, var(--status-error) 12%, transparent)",
      "border-radius": "var(--ds-radius-md)",
      padding: "8px 10px",
      border: "1px solid color-mix(in srgb, var(--status-error) 32%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-download-progress", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".settings-download-bar", {
  "@layer": {
    [layers.features]: {
      appearance: "none",
      "-webkit-appearance": "none",
      display: "block",
      width: "100%",
      height: "6px",
      "border-radius": "999px",
      background: "transparent",
      border: "1px solid var(--ds-border-muted)",
      overflow: "hidden",
    },
  },
});
applyGlobalStyle(".settings-download-bar::-webkit-progress-bar", {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-control)",
    },
  },
});
applyGlobalStyle(".settings-download-bar::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background:
        "linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--ds-brand-primary) 78%, white),\n    color-mix(in srgb, var(--ds-brand-secondary) 82%, white)\n  )",
      transition:
        "inline-size var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".settings-download-bar::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      background:
        "linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--ds-brand-primary) 78%, white),\n    color-mix(in srgb, var(--ds-brand-secondary) 82%, white)\n  )",
      transition:
        "inline-size var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".settings-download-meta", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
    },
  },
});
applyGlobalStyle(".settings-group-copies-path:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
      "border-color": "var(--ds-border-accent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 78%, var(--ds-surface-control))",
      "box-shadow": "0 0 0 1px color-mix(in srgb, var(--ds-focus-ring) 36%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-section-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-label)",
      "font-weight": "620",
      color: "var(--ds-text-stronger)",
      "line-height": "var(--line-height-122)",
      "margin-bottom": "6px",
    },
  },
});
applyGlobalStyle(".settings-section-subtitle", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "line-height": "var(--line-height-145)",
      color: "var(--ds-text-faint)",
      "margin-bottom": "18px",
    },
  },
});
applyGlobalStyle(".settings-subsection-title", {
  "@layer": {
    [layers.features]: {
      "margin-top": "22px",
      "margin-bottom": "8px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "620",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      color: "var(--ds-text-subtle)",
    },
  },
});
applyGlobalStyle(".settings-subsection-subtitle", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "line-height": "var(--line-height-145)",
      color: "var(--ds-text-faint)",
      "margin-bottom": "14px",
    },
  },
});
applyGlobalStyle(".settings-divider", {
  "@layer": {
    [layers.features]: {
      height: "1px",
      background: "var(--ds-border-muted)",
      margin: "16px 0",
      "border-radius": "999px",
    },
  },
});
applyGlobalStyle(".settings-projects", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".settings-groups", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".settings-group-create", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".settings-group-error", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--status-error)",
    },
  },
});
applyGlobalStyle(".settings-group-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".settings-group-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "flex-start",
      "justify-content": "space-between",
      gap: "12px",
      padding: "10px 12px",
      "border-radius": "var(--ds-radius-md)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 34%, transparent)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".settings-group-row:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 68%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card) 76%, var(--ds-surface-card-base))",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 28%, transparent),\n    0 4px 9px color-mix(in srgb, var(--ds-brand-background) 8%, transparent)",
    },
  },
});
applyGlobalStyle(".settings-group-fields", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".settings-group-copies", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".settings-group-copies-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".settings-group-copies-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".settings-group-copies-path", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      padding: "8px 10px",
      "border-radius": "var(--ds-radius-md)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-control)",
      color: "var(--ds-text-strong)",
      "font-size": "var(--font-size-fine)",
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
    },
  },
});
applyGlobalStyle(".settings-group-copies-path.empty", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
    },
  },
});
