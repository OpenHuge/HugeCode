import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
applyGlobalStyle(".apm-field--flex-1", { "@layer": { [layers.features]: { flex: "1" } } });
applyGlobalStyle(".apm-field--width-200", { "@layer": { [layers.features]: { width: "200px" } } });
applyGlobalStyle(".apm-field--min-width-240", {
  "@layer": { [layers.features]: { "min-width": "240px" } },
});
applyGlobalStyle(".apm-field--min-width-180", {
  "@layer": { [layers.features]: { "min-width": "180px" } },
});
applyGlobalStyle(".apm-form-row--align-start", {
  "@layer": { [layers.features]: { "align-items": "flex-start" } },
});
applyGlobalStyle(".account-pools-redesign", {
  "@layer": {
    [layers.features]: {
      "--account-pools-accent":
        "color-mix(in srgb, var(--ds-brand-primary) 76%, var(--ds-color-white))",
      "--account-pools-track":
        "color-mix(in srgb, var(--ds-border-subtle) 72%, var(--ds-surface-control))",
      "--account-pools-fill":
        "color-mix(in srgb, var(--status-warning) 58%, var(--ds-brand-primary))",
      "--apm-sidebar-w": "220px",
      "--apm-content-pad": "24px",
      "--apm-ctrl-radius": "12px",
      "--apm-nav-radius": "14px",
      "--apm-panel-bg":
        "color-mix(in srgb, var(--ds-surface-card) 98%, var(--ds-surface-card-base))",
      "--apm-panel-muted":
        "color-mix(in srgb, var(--ds-surface-control) 78%, var(--ds-surface-card-base))",
      "--apm-panel-subtle":
        "color-mix(in srgb, var(--ds-surface-canvas) 94%, var(--ds-surface-card-base))",
      "--apm-panel-hover":
        "color-mix(in srgb, var(--ds-surface-card) 92%, var(--ds-surface-active))",
      "--apm-border-soft": "color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
      "--apm-border-strong": "color-mix(in srgb, var(--ds-border-strong) 42%, transparent)",
      "--apm-text-primary": "var(--ds-text-strong)",
      "--apm-text-secondary": "var(--ds-text-subtle)",
      "--apm-text-tertiary": "var(--ds-text-faint)",
      "--apm-shadow-sm":
        "0 1px 2px color-mix(in srgb, var(--ds-color-black) 4%, transparent), 0 8px 24px color-mix(in srgb, var(--ds-color-black) 4%, transparent)",
      "--apm-shadow-md":
        "0 1px 2px color-mix(in srgb, var(--ds-color-black) 5%, transparent), 0 14px 36px color-mix(in srgb, var(--ds-color-black) 7%, transparent)",
      "--apm-nav-active-bg":
        "color-mix(in srgb, var(--ds-brand-primary) 10%, var(--ds-surface-card-base))",
      "--apm-nav-active-border":
        "color-mix(in srgb, var(--ds-brand-primary) 22%, var(--ds-border-subtle))",
      "--apm-separator": "1px solid var(--apm-border-soft)",
    },
  },
});
applyGlobalStyle(".account-pools-management.account-pools-redesign", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "14px",
      height: "100%",
      "min-height": "0",
      "align-items": "stretch",
    },
  },
});
applyGlobalStyle(".apm-nav", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "stretch",
      gap: "10px",
      padding: "16px",
      background: "var(--apm-panel-subtle)",
      border: "1px solid var(--apm-border-soft)",
      "border-radius": "20px",
      "box-shadow": "0 1px 2px color-mix(in srgb, var(--ds-color-black) 3%, transparent)",
    },
  },
});
applyGlobalStyle(".apm-nav-header", {
  "@layer": {
    [layers.features]: {
      flex: "1 1 100%",
      "min-width": "0",
      padding: "2px 2px 8px",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".apm-nav-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-title)",
      "font-weight": "660",
      "line-height": "var(--line-height-125)",
      color: "var(--apm-text-primary)",
    },
  },
});
applyGlobalStyle(".apm-nav-subtitle", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
      "line-height": "var(--line-height-140)",
    },
  },
});
applyGlobalStyle(".apm-nav-overview", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".apm-nav-stat:last-child", {
  "@layer": {
    [layers.features]: {
      "grid-column": "1 / -1",
    },
  },
});
applyGlobalStyle(".apm-nav-stat", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      padding: "10px 11px 11px",
      "border-radius": "12px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-bg)",
      "box-shadow": "0 1px 2px color-mix(in srgb, var(--ds-color-black) 3%, transparent)",
    },
  },
});
applyGlobalStyle(".apm-nav-stat-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--apm-text-tertiary)",
      "text-transform": "uppercase",
      "letter-spacing": "0.06em",
      "font-weight": "600",
    },
  },
});
applyGlobalStyle(".apm-nav-stat-value", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-title)",
      "font-weight": "700",
      color: "var(--apm-text-primary)",
      "font-variant-numeric": "tabular-nums",
      "line-height": "var(--line-height-100)",
    },
  },
});
applyGlobalStyle(".apm-nav-item", {
  "@layer": {
    [layers.features]: {
      flex: "1 1 150px",
      "min-width": "0",
      appearance: "none",
      border: "1px solid transparent",
      background: "transparent",
      display: "flex",
      "align-items": "center",
      gap: "10px",
      padding: "11px 12px",
      "border-radius": "var(--apm-nav-radius)",
      "font-size": "var(--font-size-label)",
      "font-weight": "560",
      color: "var(--apm-text-secondary)",
      cursor: "pointer",
      transition:
        "background-color var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth),\n    border-color var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
      "text-align": "left",
    },
  },
});
applyGlobalStyle(".apm-nav-item:hover", {
  "@layer": {
    [layers.features]: {
      background: "var(--apm-panel-bg)",
      borderColor: "var(--apm-border-soft)",
      color: "var(--apm-text-primary)",
    },
  },
});
applyGlobalStyle(".apm-nav-item.is-active", {
  "@layer": {
    [layers.features]: {
      background: "var(--apm-nav-active-bg)",
      color: "var(--apm-text-primary)",
      borderColor: "var(--apm-nav-active-border)",
      "font-weight": "620",
      "box-shadow": "var(--apm-shadow-sm)",
    },
  },
});
applyGlobalStyle(".apm-nav-icon", {
  "@layer": {
    [layers.features]: { width: "18px", height: "18px", "flex-shrink": "0", opacity: "0.7" },
  },
});
applyGlobalStyle(".apm-nav-item.is-active .apm-nav-icon", {
  "@layer": { [layers.features]: { opacity: "1" } },
});
applyGlobalStyle(".apm-nav-label", {
  "@layer": { [layers.features]: { flex: "1", "min-width": "0" } },
});
applyGlobalStyle(".apm-nav-badge", {
  "@layer": {
    [layers.features]: {
      color: "var(--apm-text-tertiary)",
      "font-variant-numeric": "tabular-nums",
      flexShrink: "0",
    },
  },
});
applyGlobalStyle(".apm-nav-item.is-active .apm-nav-badge", {
  "@layer": {
    [layers.features]: {
      color: "var(--apm-text-primary)",
    },
  },
});
applyGlobalStyle(".apm-pane", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "min-height": "0",
      display: "flex",
      "flex-direction": "column",
      "overflow-y": "auto",
      padding: "20px 22px 22px",
      gap: "18px",
      border: "1px solid var(--apm-border-soft)",
      "border-radius": "20px",
      background: "var(--apm-panel-bg)",
      "box-shadow": "var(--apm-shadow-md)",
    },
  },
});
applyGlobalStyle(".apm-error", {
  "@layer": {
    [layers.features]: {
      padding: "10px 14px",
      "border-radius": "var(--apm-ctrl-radius)",
      border: "1px solid var(--ds-state-error-border)",
      background: "var(--ds-state-error-bg)",
      color: "var(--ds-state-error-text)",
      "font-size": "var(--font-size-chrome)",
      "line-height": "var(--line-height-145)",
    },
  },
});
applyGlobalStyle(".apm-tab-content", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "16px" } },
});
applyGlobalStyle(".apm-section-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
      "padding-bottom": "8px",
      "border-bottom": "1px solid var(--apm-border-soft)",
    },
  },
});
applyGlobalStyle(".apm-section-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-title)",
      "font-weight": "620",
      color: "var(--apm-text-primary)",
      "line-height": "var(--line-height-130)",
    },
  },
});
applyGlobalStyle(".apm-section-desc", {
  "@layer": {
    [layers.features]: {
      "margin-top": "2px",
      "font-size": "var(--font-size-chrome)",
      color: "var(--apm-text-secondary)",
      "line-height": "var(--line-height-145)",
      "max-width": "42ch",
    },
  },
});
applyGlobalStyle(".apm-section-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "8px",
      "flex-shrink": "0",
    },
  },
});
applyGlobalStyle(".apm-form-section", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "14px",
      padding: "18px",
      "border-radius": "18px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-bg)",
      "box-shadow": "0 1px 2px color-mix(in srgb, var(--ds-color-black) 3%, transparent)",
    },
  },
});
applyGlobalStyle(".apm-form-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      "font-weight": "600",
      color: "var(--apm-text-primary)",
      "letter-spacing": "0.01em",
    },
  },
});
applyGlobalStyle(".apm-form-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "flex-end",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".apm-field", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "5px" } },
});
applyGlobalStyle(".apm-field-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "560",
      color: "var(--apm-text-secondary)",
      "letter-spacing": "0.01em",
    },
  },
});
applyGlobalStyle(".apm-checklist", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      border: "1px solid transparent",
      "border-radius": "var(--apm-ctrl-radius)",
      background: "color-mix(in srgb, var(--ds-surface-control) 70%, var(--ds-surface-card-base))",
      "max-height": "200px",
      "overflow-y": "auto",
      padding: "6px",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".apm-checklist-item", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      padding: "6px 8px",
      "border-radius": "6px",
      cursor: "pointer",
      transition: "background-color var(--duration-fast) var(--ease-smooth)",
      "user-select": "none",
    },
  },
});
applyGlobalStyle(".apm-checklist-item:hover", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-active) 14%, transparent)",
    },
  },
});
applyGlobalStyle('.apm-checklist-item input[type="checkbox"]', {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      "accent-color": "var(--ds-brand-primary)",
      margin: "0",
    },
  },
});
applyGlobalStyle(".apm-checklist-avatar", {
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      "border-radius": "6px",
      background: "color-mix(in srgb, var(--ds-surface-card) 80%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-muted) 60%, transparent)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-micro)",
      "font-weight": "700",
      color: "var(--ds-text-subtle)",
      "flex-shrink": "0",
    },
  },
});
applyGlobalStyle(".apm-checklist-info", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      "min-width": "0",
      flex: "1",
      "line-height": "var(--line-height-130)",
    },
  },
});
applyGlobalStyle(".apm-checklist-name", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      "font-weight": "500",
      color: "var(--ds-text-strong)",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".apm-checklist-sub", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-subtle)",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".apm-toolbar", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "10px",
      padding: "12px",
      "border-radius": "16px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-bg)",
      "box-shadow": "0 1px 2px color-mix(in srgb, var(--ds-color-black) 3%, transparent)",
      position: "sticky",
      top: "0",
      "z-index": "2",
    },
  },
});
applyGlobalStyle(".apm-list", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "10px" } },
});
applyGlobalStyle(".apm-health-hint", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-faint)",
      "font-style": "italic",
    },
  },
});
applyGlobalStyle(".apm-hint", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
      "line-height": "var(--line-height-150)",
    },
  },
});
applyGlobalStyle(".apm-hint--warning", {
  "@layer": {
    [layers.features]: {
      color: "color-mix(in srgb, var(--status-warning) 72%, var(--ds-text-strong))",
    },
  },
});
applyGlobalStyle(".apm-close", {
  "@layer": {
    [layers.features]: {
      width: "30px",
      height: "30px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "999px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-muted)",
      color: "var(--apm-text-primary)",
      cursor: "pointer",
      "flex-shrink": "0",
      transition:
        "background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".apm-close:hover", {
  "@layer": {
    [layers.features]: {
      background: "var(--apm-panel-bg)",
      color: "var(--apm-text-primary)",
    },
  },
});
applyGlobalStyle(".apm-close svg", {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      "min-width": "16px",
      "stroke-width": "2px",
    },
  },
});
applyGlobalStyle(".settings-overlay .ds-modal-backdrop", {
  "@layer": { [layers.features]: { "border-radius": "0" } },
});
applyGlobalStyle(".apm-row", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "auto auto minmax(0, 1fr) auto",
      "align-items": "start",
      gap: "16px",
      padding: "20px",
      "border-radius": "18px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-bg)",
      "box-shadow": "var(--apm-shadow-sm)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
      "@media": {
        "(max-width: 720px)": {
          "grid-template-columns": "auto minmax(0, 1fr)",
          padding: "16px",
        },
      },
    },
  },
});
applyGlobalStyle(".apm-row:hover", {
  "@layer": {
    [layers.features]: {
      borderColor: "var(--apm-border-strong)",
      background: "var(--apm-panel-hover)",
      "box-shadow": "var(--apm-shadow-md)",
    },
  },
});
applyGlobalStyle(".apm-row-check", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "10px 0 0",
    },
  },
});
applyGlobalStyle('.apm-row-check input[type="checkbox"]', {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      margin: "0",
      "accent-color": "var(--ds-brand-primary)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".apm-row.is-selected", {
  "@layer": {
    [layers.features]: {
      borderColor: "var(--apm-nav-active-border)",
      background: "color-mix(in srgb, var(--ds-brand-primary) 6%, var(--apm-panel-bg))",
      "box-shadow":
        "0 0 0 1px color-mix(in srgb, var(--ds-brand-primary) 10%, transparent), var(--apm-shadow-md)",
    },
  },
});
applyGlobalStyle(".apm-row--health.is-ready", {
  "@layer": {
    [layers.features]: {
      "border-left": "3px solid color-mix(in srgb, var(--status-success) 54%, transparent)",
    },
  },
});
applyGlobalStyle(".apm-row--health.is-warning", {
  "@layer": {
    [layers.features]: {
      "border-left": "3px solid color-mix(in srgb, var(--status-warning) 54%, transparent)",
    },
  },
});
applyGlobalStyle(".apm-row-avatar", {
  "@layer": {
    [layers.features]: {
      width: "40px",
      height: "40px",
      "border-radius": "12px",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-muted)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-chrome)",
      "font-weight": "700",
      color: "var(--apm-text-secondary)",
      "flex-shrink": "0",
      "letter-spacing": "0.02em",
    },
  },
});
applyGlobalStyle(".apm-row-info", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".apm-row-name", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-label)",
      "font-weight": "650",
      color: "var(--apm-text-primary)",
      "line-height": "var(--line-height-130)",
    },
  },
});
applyGlobalStyle(".apm-row-detail", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
      "line-height": "var(--line-height-150)",
    },
  },
});
applyGlobalStyle(".apm-row-detail--usage", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)", "font-weight": "520" } },
});
applyGlobalStyle(".apm-row-detail--usage-meta", {
  "@layer": { [layers.features]: { color: "var(--ds-text-faint)" } },
});
applyGlobalStyle(".apm-row-workspace-editor", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "margin-top": "4px",
    },
  },
});
applyGlobalStyle(".apm-row-workspace-field", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".apm-pool-config", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "12px",
      width: "100%",
      "margin-top": "8px",
    },
  },
});
applyGlobalStyle(".apm-status-chip", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      padding: "5px 10px",
      "border-radius": "999px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      "line-height": "var(--line-height-130)",
      "white-space": "nowrap",
      border: "1px solid var(--apm-border-soft)",
      background: "var(--apm-panel-muted)",
      color: "var(--apm-text-secondary)",
      "align-self": "start",
      "@media": {
        "(max-width: 980px)": {
          "grid-column": "3",
          "justify-self": "start",
        },
        "(max-width: 720px)": {
          "grid-column": "2",
        },
      },
    },
  },
});
applyGlobalStyle(".apm-status-chip.is-enabled", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-success) 30%, var(--ds-border-muted))",
      background: "color-mix(in srgb, var(--status-success) 8%, var(--ds-surface-card-base))",
      color: "color-mix(in srgb, var(--status-success) 68%, var(--ds-color-white))",
    },
  },
});
applyGlobalStyle(".apm-status-chip.is-disabled", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-strong) 20%, var(--ds-border-muted))",
      background: "color-mix(in srgb, var(--ds-surface-canvas) 92%, var(--apm-panel-muted))",
      color: "var(--apm-text-secondary)",
    },
  },
});
applyGlobalStyle(".apm-status-chip.is-muted", {
  "@layer": {
    [layers.features]: {
      color: "var(--apm-text-tertiary)",
    },
  },
});
applyGlobalStyle(".apm-status-chip.is-warning", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--status-warning) 30%, var(--ds-border-muted))",
      background: "color-mix(in srgb, var(--status-warning) 8%, var(--ds-surface-card-base))",
      color: "color-mix(in srgb, var(--status-warning) 66%, var(--ds-color-white))",
    },
  },
});
applyGlobalStyle(".apm-row-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      "justify-content": "flex-start",
      gap: "8px",
      "grid-column": "3 / -1",
      "align-self": "start",
      "padding-top": "4px",
      "@media": {
        "(max-width: 720px)": {
          "grid-column": "1 / -1",
        },
      },
    },
  },
});
applyGlobalStyle(".apm-row-actions > button", {
  "@layer": {
    [layers.features]: {
      "min-height": "30px",
      "border-radius": "10px",
    },
  },
});
applyGlobalStyle(".apm-toolbar-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "flex-wrap": "wrap",
      "align-items": "center",
      gap: "8px",
      "margin-left": "auto",
    },
  },
});
applyGlobalStyle(".apm-toolbar-divider", {
  "@layer": {
    [layers.features]: {
      width: "1px",
      "align-self": "stretch",
      background: "var(--apm-border-soft)",
      margin: "0 2px",
    },
  },
});
applyGlobalStyle(".apm-meta-line", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".apm-meta-line > span", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      padding: "4px 9px",
      "border-radius": "999px",
      "font-size": "var(--font-size-fine)",
      "font-weight": "600",
      color: "var(--apm-text-tertiary)",
      background: "var(--apm-panel-muted)",
      border: "1px solid var(--apm-border-soft)",
    },
  },
});
applyGlobalStyle(".apm-empty", {
  "@layer": {
    [layers.features]: {
      padding: "28px 20px",
      "border-radius": "18px",
      border: "1px dashed var(--apm-border-strong)",
      background: "var(--apm-panel-bg)",
      color: "var(--apm-text-secondary)",
      "font-size": "var(--font-size-chrome)",
      "text-align": "center",
    },
  },
});
applyGlobalStyle(".apm-health-score", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-display-sm)",
      "font-weight": "700",
      color: "var(--ds-text-strong)",
      "font-variant-numeric": "tabular-nums",
      "line-height": "var(--line-height-100)",
      "flex-shrink": "0",
    },
  },
});
applyGlobalStyle(".apm-health-meters", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "grid",
      "grid-template-columns": "repeat(3, 1fr)",
      gap: "12px",
      "margin-top": "4px",
    },
  },
});
applyGlobalStyle(".apm-health-meter", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "5px" } },
});
applyGlobalStyle(".apm-health-meter-head", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      gap: "4px",
      "font-size": "var(--font-size-meta)",
      "font-weight": "560",
      color: "var(--ds-text-subtle)",
    },
  },
});
applyGlobalStyle(".apm-health-track", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      width: "100%",
      height: "5px",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-border-muted) 40%, var(--ds-surface-control))",
      overflow: "hidden",
    },
  },
});
applyGlobalStyle(".apm-health-progress", {
  "@layer": {
    [layers.features]: {
      appearance: "none",
      "-webkit-appearance": "none",
      display: "block",
      width: "100%",
      height: "100%",
      border: "none",
      background: "transparent",
    },
  },
});
applyGlobalStyle(".apm-health-progress::-webkit-progress-bar", {
  "@layer": { [layers.features]: { background: "transparent" } },
});
applyGlobalStyle(".apm-health-progress::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      "border-radius": "inherit",
      background: "color-mix(in srgb, var(--status-success) 68%, var(--ds-color-white))",
      transition:
        "inline-size var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".apm-health-progress::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      "border-radius": "inherit",
      background: "color-mix(in srgb, var(--status-success) 68%, var(--ds-color-white))",
      transition:
        "inline-size var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".apm-row--health.is-warning .apm-health-progress::-webkit-progress-value", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--status-warning) 66%, var(--ds-color-white))",
    },
  },
});
applyGlobalStyle(".apm-row--health.is-warning .apm-health-progress::-moz-progress-bar", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--status-warning) 66%, var(--ds-color-white))",
    },
  },
});
applyGlobalStyle(".apm-pool-member-policy-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "padding-top": "12px",
      "margin-top": "12px",
      "border-top": "1px solid var(--apm-border-soft)",
      width: "100%",
    },
  },
});
applyGlobalStyle(".apm-pool-member-policy-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "16px",
      padding: "10px 12px",
      "border-radius": "14px",
      background: "var(--apm-panel-muted)",
      border: "1px solid var(--apm-border-soft)",
    },
  },
});
applyGlobalStyle(".apm-pool-member-policy-account", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      "font-size": "var(--font-size-chrome)",
      color: "var(--apm-text-primary)",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".apm-member-policy-enabled", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "6px",
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
      cursor: "pointer",
      "user-select": "none",
    },
  },
});
applyGlobalStyle('.apm-member-policy-enabled input[type="checkbox"]', {
  "@layer": {
    [layers.features]: {
      margin: "0",
      "accent-color": "var(--ds-brand-primary)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".apm-member-policy-field", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      "font-size": "var(--font-size-meta)",
      color: "var(--apm-text-secondary)",
    },
  },
});
applyGlobalStyle(".apm-member-policy-input", {
  "@layer": {
    [layers.features]: {
      width: "60px",
      "text-align": "center",
      "padding-left": "4px",
      "padding-right": "4px",
    },
  },
});
applyGlobalStyle(".apm-member-policy-empty", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-chrome)",
      color: "var(--apm-text-tertiary)",
      "font-style": "italic",
      padding: "8px 0",
    },
  },
});
applyGlobalStyle(".account-pools-management.account-pools-redesign", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 960px)": {
          "flex-direction": "column",
        },
      },
    },
  },
});
applyGlobalStyle(".apm-nav", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 960px)": {
          padding: "14px",
        },
      },
    },
  },
});
applyGlobalStyle(".apm-nav-overview", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 560px)": {
          "grid-template-columns": "1fr",
        },
      },
    },
  },
});
applyGlobalStyle(".apm-pane", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          padding: "18px",
        },
      },
    },
  },
});
