import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
import "./main-content-layers.css";

applyGlobalStyle(".workspace-branch-static-pill", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "max-width": "clamp(10rem, 28vw, 20rem)",
    },
  },
});
applyGlobalStyle(".workspace-branch-static-pill:hover", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".worktree-info-popover", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: "0",
      "min-width": "280px",
      "max-width": "min(360px, 80vw)",
      "z-index": "12",
      "border-radius": "var(--ds-radius-md)",
      padding: "10px",
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".worktree-info-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".worktree-info-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
    },
  },
});
applyGlobalStyle(".worktree-info-command", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".worktree-info-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".worktree-info-code", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-stronger)",
      background: "var(--ds-surface-control)",
      border: "1px solid var(--ds-border-muted)",
      padding: "6px 8px",
      "border-radius": "var(--ds-radius-sm)",
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      flex: "1",
    },
  },
});
applyGlobalStyle(".worktree-info-copy", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-subtle)",
      "border-radius": "var(--ds-radius-sm)",
      width: "28px",
      height: "28px",
      padding: "0",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".worktree-info-copy:hover", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
    },
  },
});
applyGlobalStyle(".worktree-info-copy svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
    },
  },
});
applyGlobalStyle(".worktree-info-subtle", {
  "@layer": {
    [layers.features]: {
      "text-wrap": "auto",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".worktree-info-reveal", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-stronger)",
      "border-radius": "var(--ds-radius-sm)",
      padding: "6px 10px",
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      cursor: "pointer",
      "text-align": "left",
    },
  },
});
applyGlobalStyle(".worktree-info-reveal:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
    },
  },
});
applyGlobalStyle(".worktree-info-rename", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".worktree-info-input", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-stronger)",
      "border-radius": "var(--ds-radius-sm)",
      padding: "6px 8px",
      "font-size": "var(--font-size-meta)",
      flex: "1",
    },
  },
});
applyGlobalStyle(".worktree-info-input:focus", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 56%, transparent)",
    },
  },
});
applyGlobalStyle(".worktree-info-confirm", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-stronger)",
      "border-radius": "var(--ds-radius-sm)",
      width: "28px",
      height: "28px",
      padding: "0",
    },
  },
});
applyGlobalStyle(".worktree-info-confirm:hover:not(:disabled)", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
    },
  },
});
applyGlobalStyle(".worktree-info-error", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-danger)",
    },
  },
});
applyGlobalStyle(".worktree-info-upstream", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".worktree-info-upstream-button", {
  "@layer": {
    [layers.features]: {
      "align-self": "flex-start",
      padding: "6px 10px",
      "font-size": "var(--font-size-meta)",
      "font-weight": "600",
      "border-radius": "8px",
    },
  },
});
applyGlobalStyle(".workspace-branch-menu", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "inline-flex",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".workspace-branch-pill", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      "max-width": "clamp(10rem, 24vw, 18rem)",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".workspace-branch-pill:hover", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".workspace-branch-caret", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      display: "inline-flex",
      transform: "rotate(90deg)",
      "align-items": "center",
      "line-height": "var(--line-height-100)",
      "margin-top": "1px",
    },
  },
});
applyGlobalStyle(".workspace-branch-dropdown", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "calc(100% + 6px)",
      left: "0",
      "min-width": "220px",
      "max-width": "320px",
      "z-index": "10",
      "border-radius": "var(--ds-radius-md)",
      padding: "6px",
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".branch-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".branch-search", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "6px",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".branch-search .branch-input", {
  "@layer": {
    [layers.features]: {
      flex: "1",
    },
  },
});
applyGlobalStyle(".branch-action", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "8px",
      padding: "6px 8px",
      "border-radius": "var(--ds-radius-sm)",
      border: "1px dashed var(--ds-border-muted)",
      background: "transparent",
      color: "var(--ds-text-quiet)",
      cursor: "pointer",
      "font-size": "var(--font-size-meta)",
    },
  },
});
applyGlobalStyle(".branch-action:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".branch-action-icon", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "16px",
      height: "16px",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card)",
      color: "var(--ds-text-stronger)",
      "font-weight": "600",
    },
  },
});
applyGlobalStyle(".branch-create", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".branch-input", {
  "@layer": {
    [layers.features]: {
      border: "1px solid var(--ds-border-muted)",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-stronger)",
      padding: "6px 8px",
      "font-size": "var(--font-size-meta)",
    },
  },
});
applyGlobalStyle(".branch-input:focus", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 56%, transparent)",
    },
  },
});
applyGlobalStyle(".branch-create-button", {
  "@layer": {
    [layers.features]: {
      border: "none",
      "border-radius": "var(--ds-radius-sm)",
      background: "var(--ds-surface-card)",
      color: "var(--ds-text-stronger)",
      padding: "6px 8px",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".branch-create-button:hover", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 74%, var(--ds-surface-item))",
    },
  },
});
applyGlobalStyle(".branch-create-button:disabled", {
  "@layer": {
    [layers.features]: {
      cursor: "not-allowed",
      opacity: "0.6",
      background: "var(--ds-surface-card-base)",
    },
  },
});
applyGlobalStyle(".branch-create-hint", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      padding: "2px 8px 0",
    },
  },
});
applyGlobalStyle(".branch-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
      "max-height": "220px",
      "overflow-y": "auto",
      "scrollbar-width": "thin",
    },
  },
});
applyGlobalStyle(".branch-item", {
  "@layer": {
    [layers.features]: {
      "text-align": "left",
      border: "1px solid transparent",
      background: "transparent",
      padding: "6px 8px",
      "border-radius": "var(--ds-radius-sm)",
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-meta)",
      cursor: "pointer",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".branch-item:hover,\n.branch-item.is-active", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 74%, var(--ds-surface-item))",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      color: "var(--ds-text-stronger)",
    },
  },
});
applyGlobalStyle(".branch-empty", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      padding: "4px 8px",
    },
  },
});
applyGlobalStyle(".branch-error", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "color-mix(in srgb, var(--status-error) 70%, var(--ds-text-strong))",
      padding: "6px 8px 2px",
      "white-space": "pre-wrap",
    },
  },
});
