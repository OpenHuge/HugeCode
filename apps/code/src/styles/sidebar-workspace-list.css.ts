import { globalKeyframes } from "@vanilla-extract/css";
import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

globalKeyframes("workspace-thread-reveal", {
  "0%": {
    opacity: "0.01",
    transform: "translateY(-2px)",
  },
  "100%": {
    opacity: "1",
    transform: "translateY(0)",
  },
});

applyGlobalStyle(".workspace-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "0",
      "padding-top": "0",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle(
  ".workspace-list > .sidebar-empty-action:first-child,\n.workspace-list > .empty:first-child",
  {
    "@layer": {
      [layers.features]: {
        "margin-top": "24px",
      },
    },
  }
);
applyGlobalStyle(".workspace-group", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "1px" } },
});
applyGlobalStyle(".workspace-group + .workspace-group", {
  "@layer": { [layers.features]: { "margin-top": "1px" } },
});
applyGlobalStyle(".workspace-group-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "8px",
      padding: "0 8px 0 10px",
    },
  },
});
applyGlobalStyle(".workspace-group-header.is-toggleable", {
  "@layer": { [layers.features]: { cursor: "pointer" } },
});
applyGlobalStyle(".workspace-group-header.is-toggleable:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "2px",
      "border-radius": "6px",
    },
  },
});
applyGlobalStyle(".workspace-group-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "font-weight": "600",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      color: "var(--ds-text-faint)",
      "padding-left": "0",
    },
  },
});
applyGlobalStyle(".workspace-group-list", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-rows": "1fr",
      "margin-top": "0",
      transition: "margin-top var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".workspace-group-content", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "0",
      overflow: "hidden",
      "min-height": "0",
    },
  },
});
applyGlobalStyle(".workspace-group-list.collapsed", {
  "@layer": {
    [layers.features]: {
      "margin-top": "0",
      "grid-template-rows": "0fr",
    },
  },
});
applyGlobalStyle(".group-toggle", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-faint)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-meta)",
      padding: "0 2px",
      "-webkit-app-region": "no-drag",
      opacity: "0",
      "pointer-events": "none",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".group-toggle:hover", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});
applyGlobalStyle(".workspace-group-header:hover .group-toggle,\n.group-toggle:focus-visible", {
  "@layer": { [layers.features]: { opacity: "1", "pointer-events": "auto" } },
});
applyGlobalStyle(".group-toggle-icon", {
  "@layer": {
    [layers.features]: {
      display: "inline-block",
      transition: "transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".group-toggle.expanded .group-toggle-icon", {
  "@layer": { [layers.features]: { transform: "rotate(90deg)" } },
});
applyGlobalStyle(".workspace-card", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "0",
      "overflow-x": "hidden",
      border: "none",
      "border-radius": "0",
      padding: "0",
      background: "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".workspace-drop-slot", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      height: "0",
      "margin-top": "0",
      "margin-bottom": "0",
      "flex-shrink": "0",
      "-webkit-app-region": "no-drag",
      transition:
        "height var(--duration-fast) var(--ease-smooth),\n    margin var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".workspace-drop-slot::after", {
  "@layer": {
    [layers.features]: {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "10px",
      right: "10px",
      height: "2px",
      "border-radius": "999px",
      background: "var(--accent-solid)",
      "box-shadow": "0 0 0 1px color-mix(in srgb, var(--accent-solid) 28%, transparent)",
      opacity: "0",
      transform: "translateY(-50%)",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
      "pointer-events": "none",
    },
  },
});
applyGlobalStyle('.workspace-list[data-workspace-dragging="true"] .workspace-drop-slot', {
  "@layer": {
    [layers.features]: {
      height: "12px",
      "margin-top": "-2px",
      "margin-bottom": "-2px",
    },
  },
});
applyGlobalStyle('.workspace-list[data-workspace-dragging="true"] .workspace-drop-slot::after', {
  "@layer": {
    [layers.features]: {
      opacity: "0.22",
      transform: "translateY(-50%) scaleX(0.985)",
    },
  },
});
applyGlobalStyle('.workspace-drop-slot[data-active="true"]::after', {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      transform: "translateY(-50%) scaleX(1)",
      "box-shadow":
        "0 0 0 1px color-mix(in srgb, var(--accent-solid) 34%, transparent), 0 0 14px color-mix(in srgb, var(--accent-solid) 24%, transparent)",
    },
  },
});
applyGlobalStyle('.workspace-card[data-sidebar-section="workspace"]', {
  "@layer": {
    [layers.features]: {
      gap: "0",
    },
  },
});
applyGlobalStyle(".workspace-card-content", {
  "@layer": {
    [layers.features]: {
      display: "block",
      transition: "none",
    },
  },
});
applyGlobalStyle(".workspace-card-content-inner", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "1px",
      overflow: "hidden",
      "min-height": "0",
      padding: "0 0 0 16px",
    },
  },
});
applyGlobalStyle(".workspace-card-content:not(.collapsed) .workspace-card-content-inner", {
  "@layer": {
    [layers.features]: {
      animation: "workspace-thread-reveal 140ms var(--ease-smooth) both",
      "transform-origin": "top center",
      "will-change": "opacity, transform",
      "@media": {
        "(prefers-reduced-motion: reduce)": {
          animation: "none",
          "will-change": "auto",
        },
      },
    },
  },
});
applyGlobalStyle(".workspace-card-content.collapsed", {
  "@layer": {
    [layers.features]: {
      display: "none",
      "pointer-events": "none",
    },
  },
});
applyGlobalStyle(".workspace-row", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) auto",
      gap: "8px",
      padding: "3px 6px 3px 8px",
      "border-radius": "10px",
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
      "text-align": "left",
      cursor: "pointer",
      transition:
        "color var(--duration-normal) var(--ease-smooth),\n    background var(--duration-normal) var(--ease-smooth),\n    transform var(--duration-fast) var(--ease-smooth),\n    opacity var(--duration-fast) var(--ease-smooth)",
      "-webkit-app-region": "no-drag",
      "overflow-x": "hidden",
      position: "relative",
      isolation: "isolate",
    },
  },
});
applyGlobalStyle('.workspace-row[data-draggable="true"]', {
  "@layer": {
    [layers.features]: {
      cursor: "grab",
      "user-select": "none",
      "-webkit-user-select": "none",
    },
  },
});
applyGlobalStyle(".workspace-row:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
    },
  },
});
applyGlobalStyle(".workspace-row::before", {
  "@layer": {
    [layers.features]: {
      content: '""',
      position: "absolute",
      inset: "0",
      "border-radius": "inherit",
      background: "transparent",
      border: "1px solid transparent",
      transition:
        "background var(--duration-normal) var(--ease-smooth),\n    border-color var(--duration-normal) var(--ease-smooth),\n    box-shadow var(--duration-normal) var(--ease-smooth)",
      "z-index": "-2",
    },
  },
});
applyGlobalStyle(".workspace-row:hover::before", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 26%, transparent)",
      "border-color": "transparent",
    },
  },
});
applyGlobalStyle(".workspace-row:hover", {
  "@layer": { [layers.features]: { transform: "none" } },
});
applyGlobalStyle(".workspace-row.is-dragging", {
  "@layer": {
    [layers.features]: {
      opacity: "0.78",
      cursor: "grabbing",
      "z-index": "2",
    },
  },
});
applyGlobalStyle(
  '.workspace-list[data-workspace-dragging="true"] .workspace-row:not(.is-dragging)',
  {
    "@layer": {
      [layers.features]: {
        opacity: "0.7",
      },
    },
  }
);
applyGlobalStyle(
  '.workspace-list[data-workspace-dragging="true"] .workspace-card[data-drop-position] .workspace-row',
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
      },
    },
  }
);
applyGlobalStyle(".workspace-row.is-dragging::before", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--accent-solid) 10%, var(--ds-surface-raised))",
      "border-color": "transparent",
      "box-shadow": "0 8px 18px color-mix(in srgb, var(--ds-shadow-color) 10%, transparent)",
    },
  },
});
applyGlobalStyle(".workspace-row.active::before", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 18%, transparent)",
      "border-color": "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(
  '.workspace-card[data-drop-position="before"] .workspace-row::before,\n.workspace-card[data-drop-position="after"] .workspace-row::before',
  {
    "@layer": {
      [layers.features]: {
        background: "color-mix(in srgb, var(--accent-solid) 5%, transparent)",
        "border-color": "transparent",
      },
    },
  }
);
applyGlobalStyle(
  '.workspace-card[data-drop-position="before"] .workspace-row::after,\n.workspace-card[data-drop-position="after"] .workspace-row::after',
  {
    "@layer": {
      [layers.features]: {
        content: '""',
        position: "absolute",
        left: "10px",
        right: "10px",
        height: "2px",
        "border-radius": "999px",
        background: "var(--accent-solid)",
        "box-shadow": "0 0 10px color-mix(in srgb, var(--accent-solid) 16%, transparent)",
        "z-index": "-1",
      },
    },
  }
);
applyGlobalStyle('.workspace-card[data-drop-position="before"] .workspace-row::after', {
  "@layer": {
    [layers.features]: {
      top: "-1px",
    },
  },
});
applyGlobalStyle('.workspace-card[data-drop-position="after"] .workspace-row::after', {
  "@layer": {
    [layers.features]: {
      bottom: "-1px",
    },
  },
});
applyGlobalStyle(".workspace-row.active", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});
applyGlobalStyle(".workspace-row.active .workspace-name", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});
applyGlobalStyle(".workspace-row.active .workspace-name-row", {
  "@layer": { [layers.features]: { "padding-left": "0" } },
});
applyGlobalStyle(".workspace-name", {
  "@layer": {
    [layers.features]: {
      "font-weight": "460",
      "font-size": "var(--font-size-meta)",
      color: "inherit",
      "min-width": "0",
      display: "inline-flex",
      "align-items": "center",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".workspace-row-title", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      width: "100%",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".workspace-name-text", {
  "@layer": {
    [layers.features]: {
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".workspace-name-icon", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      width: "14px",
      height: "14px",
      "border-radius": "0",
      background: "transparent",
      color: "var(--ds-text-faint)",
      border: "none",
      "box-shadow": "none",
      transition: "color var(--duration-normal) var(--ease-smooth)",
      "flex-shrink": "0",
    },
  },
});
applyGlobalStyle(".workspace-caret", {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      color: "var(--ds-text-faint)",
      "flex-shrink": "0",
    },
  },
});
applyGlobalStyle(".workspace-row-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "flex-end",
      gap: "0",
      "margin-left": "auto",
      width: "42px",
      "min-width": "42px",
      "flex-shrink": "0",
      "padding-top": "0",
      position: "relative",
      "z-index": "1",
    },
  },
});
applyGlobalStyle(".workspace-row.active .workspace-name-icon", {
  "@layer": {
    [layers.features]: {
      background: "transparent",
      color: "var(--ds-text-strong)",
      "border-color": "transparent",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".workspace-name-match", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      background: "var(--ds-border-accent-soft)",
      "border-radius": "4px",
      padding: "0 2px",
    },
  },
});
applyGlobalStyle(".connect", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      "align-self": "center",
      "flex-shrink": "0",
      padding: "3px 7px",
      "border-radius": "6px",
      border: "1px solid transparent",
      background: "color-mix(in srgb, var(--ds-surface-hover) 24%, transparent)",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle(".workspace-add,\nbutton.workspace-add", {
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      padding: "0",
      "border-radius": "7px",
      border: "none",
      background: "transparent",
      "box-shadow": "none",
      color: "var(--ds-text-faint)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-display-sm)",
      "font-weight": "500",
      "-webkit-app-region": "no-drag",
      opacity: "0",
      "pointer-events": "none",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth),\n    background-color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".workspace-icon-action,\nbutton.workspace-icon-action", {
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      padding: "0",
      "border-radius": "7px",
      border: "none",
      background: "transparent",
      "box-shadow": "none",
      color: "var(--ds-text-faint)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "-webkit-app-region": "no-drag",
      opacity: "0",
      "pointer-events": "none",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth),\n    background-color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle("button.workspace-add:hover,\nbutton.workspace-add:focus-visible", {
  "@layer": {
    [layers.features]: {
      "border-radius": "7px",
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 24%, transparent)",
      "box-shadow": "none",
      transform: "none",
    },
  },
});
applyGlobalStyle(
  "button.workspace-icon-action:hover,\nbutton.workspace-icon-action:focus-visible",
  {
    "@layer": {
      [layers.features]: {
        "border-radius": "7px",
        color: "var(--ds-text-strong)",
        background: "color-mix(in srgb, var(--ds-surface-hover) 24%, transparent)",
        "box-shadow": "none",
        transform: "none",
      },
    },
  }
);
applyGlobalStyle(
  ".workspace-row:hover .workspace-add,\n.workspace-row:hover .workspace-icon-action,\n.worktree-row:hover .workspace-add,\n.workspace-row:focus-within .workspace-add,\n.workspace-row:focus-within .workspace-icon-action,\n.worktree-row:focus-within .workspace-add",
  {
    "@layer": { [layers.features]: { opacity: "1", "pointer-events": "auto" } },
  }
);
applyGlobalStyle(
  ".workspace-row:focus-within button.workspace-add,\n.workspace-row:focus-within button.workspace-icon-action,\n.worktree-row:focus-within button.workspace-add,\n.worktree-row:focus-within button.workspace-icon-action",
  {
    "@layer": { [layers.features]: { opacity: "1", "pointer-events": "auto" } },
  }
);
applyGlobalStyle(".workspace-name-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      "justify-content": "space-between",
      "min-width": "0",
      width: "100%",
    },
  },
});
applyGlobalStyle(".workspace-add-menu", {
  "@layer": {
    [layers.features]: {
      position: "fixed",
      top: "var(--workspace-add-menu-top, 0px)",
      left: "var(--workspace-add-menu-left, 0px)",
      width: "var(--workspace-add-menu-width, 200px)",
      isolation: "isolate",
      "border-radius": "10px",
      padding: "6px",
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
      "min-width": "160px",
      "z-index": "9999",
    },
  },
});
applyGlobalStyle(".workspace-add-option", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-strong)",
      "font-size": "var(--font-size-meta)",
      "text-align": "left",
      padding: "6px 8px",
      "border-radius": "6px",
      cursor: "pointer",
    },
  },
});
applyGlobalStyle(".workspace-add-option:hover", {
  "@layer": { [layers.features]: { background: "var(--ds-surface-hover)" } },
});
applyGlobalStyle(".sidebar-context-menu", {
  "@layer": {
    [layers.features]: {
      position: "fixed",
      top: "var(--sidebar-context-menu-top, 0px)",
      left: "var(--sidebar-context-menu-left, 0px)",
      "z-index": "1200",
      padding: "6px",
      "border-radius": "10px",
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".sidebar-context-option", {
  "@layer": { [layers.features]: { width: "100%", "justify-content": "flex-start" } },
});
