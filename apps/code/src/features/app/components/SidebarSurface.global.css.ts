import { typographyValues } from "@ku0/design-system";
import { applyGlobalStyle } from "../../../styles/system/globalStyleHelpers";
import { layers } from "../../../styles/system/layers.css";

const MAX_THREAD_DEPTH = 12;

applyGlobalStyle(".thread-list", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
      "margin-left": "0",
    },
  },
});

applyGlobalStyle(".pinned-section", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
      "margin-bottom": "6px",
    },
  },
});

applyGlobalStyle(".thread-list-nested", {
  "@layer": { [layers.features]: { "margin-left": "0" } },
});

applyGlobalStyle(".thread-loading", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
      padding: "6px 2px 4px",
    },
  },
});

applyGlobalStyle(".thread-loading-nested", {
  "@layer": { [layers.features]: { "margin-left": "6px" } },
});

applyGlobalStyle(".thread-skeleton", {
  "@layer": {
    [layers.features]: {
      display: "block",
      height: "9px",
      width: "62%",
      "border-radius": "7px",
      background:
        "linear-gradient(\n    110deg,\n    color-mix(in srgb, var(--ds-surface-control) 84%, transparent) 12%,\n    color-mix(in srgb, var(--ds-color-white) 10%, var(--ds-surface-control)) 28%,\n    color-mix(in srgb, var(--ds-surface-control) 84%, transparent) 46%\n  )",
      "background-size": "180% 100%",
      animation: "shimmer 1.6s var(--ease-smooth) infinite",
      opacity: "0.9",
    },
  },
});

applyGlobalStyle(".thread-skeleton-wide", {
  "@layer": { [layers.features]: { width: "78%" } },
});

applyGlobalStyle(".thread-skeleton-short", {
  "@layer": { [layers.features]: { width: "44%" } },
});

applyGlobalStyle(".thread-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      padding: "0 8px 0 calc(8px + var(--thread-indent, 0px))",
      "min-height": "28px",
      "border-radius": "var(--sidebar-thread-row-radius, 8px)",
      border: "none",
      background: "transparent",
      color: "var(--ds-text-primary)",
      "font-size": "var(--font-size-title-sm)",
      "font-weight": "500",
      "text-align": "left",
      cursor: "pointer",
      "-webkit-app-region": "no-drag",
      "min-width": "0",
      position: "relative",
      transition:
        "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
      "box-shadow": "none",
      appearance: "none",
    },
  },
});

applyGlobalStyle(".thread-row:active:not(.active)", {
  "@layer": {
    [layers.features]: {
      transform: "scale(0.995)",
    },
  },
});

for (let depth = 1; depth <= MAX_THREAD_DEPTH; depth += 1) {
  applyGlobalStyle(`.thread-row[data-thread-depth="${depth}"]`, {
    "@layer": {
      [layers.features]: {
        "--thread-indent": `${depth * 14}px`,
      },
    },
  });

  applyGlobalStyle(`.thread-list-nested .thread-row[data-thread-depth="${depth}"]`, {
    "@layer": {
      [layers.features]: {
        "--thread-indent": `${depth * 10}px`,
      },
    },
  });
}

applyGlobalStyle(".thread-row-main", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      width: "100%",
      "min-width": "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "flex-start",
      gap: "8px",
      padding: "3px 0",
      border: "none",
      background: "transparent",
      "box-shadow": "none",
      appearance: "none",
      outline: "none",
      color: "inherit",
      cursor: "pointer",
      "text-align": "left",
    },
  },
});
applyGlobalStyle(".thread-row-main:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "none",
      "box-shadow": "0 0 0 2px color-mix(in srgb, var(--ds-focus-ring) 28%, transparent)",
    },
  },
});

applyGlobalStyle(".thread-leading", {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      position: "relative",
      flex: "0 0 16px",
    },
  },
});

applyGlobalStyle(".thread-leading-control", {
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      flex: "0 0 16px",
      padding: "0",
      border: "none",
      background: "transparent",
      "box-shadow": "none",
      appearance: "none",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      position: "relative",
      color: "var(--ds-text-muted)",
      cursor: "pointer",
      "border-radius": "6px",
      "align-self": "center",
    },
  },
});

applyGlobalStyle(".thread-leading-control:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 44%, transparent)",
      "outline-offset": "2px",
    },
  },
});

applyGlobalStyle(".thread-leading-visual,\n.thread-leading-action-icon", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      inset: "0",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-leading-visual", {
  "@layer": { [layers.features]: { opacity: "1", transform: "scale(1)" } },
});

applyGlobalStyle(".thread-leading-action-icon", {
  "@layer": {
    [layers.features]: {
      opacity: "0",
      transform: "rotate(-24deg) scale(0.82)",
      color: "var(--ds-text-muted)",
      "pointer-events": "none",
    },
  },
});

applyGlobalStyle(
  ".thread-row:hover .thread-leading-visual,\n.thread-row:focus-within .thread-leading-visual",
  {
    "@layer": { [layers.features]: { opacity: "0", transform: "scale(0.82)" } },
  }
);

applyGlobalStyle(
  ".thread-row:hover .thread-leading-action-icon,\n.thread-row:focus-within .thread-leading-action-icon",
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
        transform: "rotate(-24deg) scale(1)",
        color: "var(--ds-text-primary)",
      },
    },
  }
);

applyGlobalStyle(".thread-status", {
  "@layer": {
    [layers.features]: {
      width: "10px",
      height: "10px",
      "border-radius": "999px",
      display: "inline-block",
      "box-sizing": "border-box",
      border: "1.25px solid color-mix(in srgb, var(--ds-text-faint) 58%, transparent)",
      background:
        "radial-gradient(circle at center, color-mix(in srgb, var(--ds-text-faint) 16%, transparent) 0 32%, transparent 36%)",
      "box-shadow": "0 0 0 1px color-mix(in srgb, var(--ds-surface-card-base) 80%, transparent)",
      flex: "0 0 auto",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-pin-icon", {
  "@layer": {
    [layers.features]: {
      width: "9px",
      height: "9px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      position: "absolute",
      left: "-1px",
      top: "-1px",
      opacity: "1",
      color: "var(--ds-text-subtle)",
      background: "var(--ds-surface-sidebar)",
      "border-radius": "999px",
      "box-shadow":
        "0 0 0 1px color-mix(in srgb, var(--ds-border-subtle) 68%, transparent), 0 0 0 2px var(--ds-surface-sidebar)",
      flex: "0 0 auto",
      transition:
        "color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-row:hover .thread-pin-icon", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-muted)",
      "box-shadow":
        "0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 58%, transparent), 0 0 0 2px var(--ds-surface-sidebar)",
    },
  },
});

applyGlobalStyle(".thread-row:hover", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 16%, transparent)",
      color: "var(--ds-text-primary)",
    },
  },
});

applyGlobalStyle(".thread-row.active", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-active) 28%, var(--ds-surface-sidebar))",
      color: "var(--ds-text-primary)",
      fontWeight: "520",
      boxShadow:
        "inset 0 0 0 1px color-mix(in srgb, var(--ds-border-subtle) 42%, transparent), inset 0 1px 2px color-mix(in srgb, var(--ds-shadow-color, rgba(0,0,0,0.1)) 6%, transparent)",
    },
  },
});

applyGlobalStyle(".thread-row.active::before", {
  "@layer": {
    [layers.features]: {
      content: "none",
    },
  },
});

applyGlobalStyle(
  '.thread-row[data-thread-state="processing"]:not(.active) .thread-name,\n.thread-row[data-thread-state="awaitingApproval"]:not(.active) .thread-name,\n.thread-row[data-thread-state="awaitingInput"]:not(.active) .thread-name,\n.thread-row[data-thread-state="planReady"]:not(.active) .thread-name,\n.thread-row[data-thread-state="reviewing"]:not(.active) .thread-name',
  {
    "@layer": { [layers.features]: { color: "var(--ds-text-emphasis)" } },
  }
);

applyGlobalStyle(".thread-row:hover .thread-name,\n.thread-row:focus-within .thread-name", {
  "@layer": { [layers.features]: { color: "var(--ds-text-primary)" } },
});

applyGlobalStyle(".thread-row.active .thread-name", {
  "@layer": { [layers.features]: { color: "var(--ds-text-primary)" } },
});

applyGlobalStyle(".thread-name", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-width": "0",
      display: "block",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      lineHeight: typographyValues.ui.lineHeight,
      color: "var(--ds-text-secondary)",
      "font-size": "var(--font-size-ui)",
      "font-weight": "500",
      "letter-spacing": "-0.01em",
      "text-align": "left",
    },
  },
});

applyGlobalStyle(".thread-content", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      width: "100%",
      "min-width": "0",
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "justify-content": "center",
      gap: "0",
      "text-align": "left",
    },
  },
});
applyGlobalStyle(".thread-mainline", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "flex-start",
      gap: "6px",
      width: "100%",
      "min-width": "0",
      "text-align": "left",
    },
  },
});

applyGlobalStyle(".thread-subline", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      width: "100%",
      gap: "6px",
      "margin-top": "2px",
      "min-width": "0",
      color: "var(--ds-text-faint)",
      "font-size": "var(--font-size-title-sm)",
      lineHeight: typographyValues.fine.lineHeight,
      overflow: "hidden",
    },
  },
});

applyGlobalStyle(".thread-secondary-meta", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      "min-width": "0",
      overflow: "hidden",
      "white-space": "nowrap",
      "text-overflow": "ellipsis",
    },
  },
});
applyGlobalStyle(".thread-secondary-separator", {
  "@layer": { [layers.features]: { color: "var(--ds-text-fainter)" } },
});

applyGlobalStyle(".thread-meta", {
  "@layer": {
    [layers.features]: {
      "margin-left": "auto",
      display: "inline-flex",
      "align-items": "center",
      "align-self": "center",
      "min-width": "0",
      "padding-top": "0",
      "flex-shrink": "0",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-trailing-control", {
  "@layer": {
    [layers.features]: {
      width: "42px",
      height: "16px",
      flex: "0 0 42px",
      padding: "0",
      border: "none",
      background: "transparent",
      "box-shadow": "none",
      appearance: "none",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "flex-end",
      position: "relative",
      color: "var(--ds-text-muted)",
      cursor: "pointer",
      "border-radius": "6px",
      "align-self": "center",
    },
  },
});

applyGlobalStyle(".thread-trailing-control:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 44%, transparent)",
      "outline-offset": "2px",
    },
  },
});

applyGlobalStyle(".thread-trailing-time,\n.thread-trailing-action-icon", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      right: "0",
      top: "50%",
      transform: "translateY(-50%)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "flex-end",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-time", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-fine)",
      "white-space": "nowrap",
      "font-variant-numeric": "tabular-nums",
      "letter-spacing": "0.01em",
    },
  },
});

applyGlobalStyle(".thread-trailing-time", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      "font-size": "var(--font-size-fine)",
      "font-variant-numeric": "tabular-nums",
      "letter-spacing": "0.01em",
      color: "var(--ds-text-muted)",
      "pointer-events": "none",
    },
  },
});

applyGlobalStyle(".thread-trailing-action-icon", {
  "@layer": {
    [layers.features]: {
      opacity: "0",
      transform: "translateY(-50%) scale(0.82)",
      color: "var(--ds-text-muted)",
      "pointer-events": "none",
    },
  },
});

applyGlobalStyle(
  ".thread-row:hover .thread-trailing-time,\n.thread-row:focus-within .thread-trailing-time",
  {
    "@layer": {
      [layers.features]: { opacity: "0", transform: "translateY(-50%) scale(0.88)" },
    },
  }
);

applyGlobalStyle(
  ".thread-row:hover .thread-trailing-action-icon,\n.thread-row:focus-within .thread-trailing-action-icon",
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
        transform: "translateY(-50%) scale(1)",
        color: "var(--ds-text-primary)",
      },
    },
  }
);

applyGlobalStyle(".thread-trailing-confirm", {
  "@layer": {
    [layers.features]: {
      height: "24px",
      "min-width": "68px",
      padding: "0 10px",
      border: "1px solid color-mix(in srgb, var(--ds-status-danger) 30%, var(--ds-border-subtle))",
      "border-radius": "8px",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-hover) 22%, transparent), color-mix(in srgb, var(--ds-surface-hover) 10%, transparent))",
      color: "color-mix(in srgb, var(--ds-status-danger) 88%, white 6%)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "align-self": "center",
      "flex-shrink": "0",
      "font-size": "var(--font-size-ui)",
      "font-weight": "500",
      "letter-spacing": "-0.01em",
      cursor: "pointer",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 10%, transparent), 0 0 0 1px color-mix(in srgb, var(--ds-color-black) 8%, transparent)",
      appearance: "none",
      transition:
        "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-trailing-confirm:hover,\n.thread-trailing-confirm:focus-visible", {
  "@layer": {
    [layers.features]: {
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-status-danger) 10%, var(--ds-surface-hover)), color-mix(in srgb, var(--ds-status-danger) 14%, transparent))",
      "border-color": "color-mix(in srgb, var(--ds-status-danger) 42%, var(--ds-border-subtle))",
      color: "color-mix(in srgb, var(--ds-status-danger) 96%, white 6%)",
      outline: "none",
      transform: "translateY(-0.5px)",
    },
  },
});

applyGlobalStyle(".thread-row.active .thread-time", {
  "@layer": { [layers.features]: { color: "var(--ds-text-muted)" } },
});
applyGlobalStyle(".thread-inline-actions", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      opacity: "0",
      transform: "translateX(4px)",
      "pointer-events": "none",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(
  ".thread-row:hover .thread-inline-actions,\n.thread-row:focus-within .thread-inline-actions,\n.thread-row.is-confirming .thread-inline-actions",
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
        transform: "translateX(0)",
        "pointer-events": "auto",
      },
    },
  }
);
applyGlobalStyle(
  ".thread-row:hover .thread-meta,\n.thread-row:focus-within .thread-meta,\n.thread-row.is-confirming .thread-meta",
  {
    "@layer": {
      [layers.features]: {
        opacity: "0",
        transform: "translateX(-4px)",
        "pointer-events": "none",
      },
    },
  }
);
applyGlobalStyle(".thread-inline-action", {
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      padding: "0",
      border: "none",
      "border-radius": "6px",
      background: "transparent",
      color: "var(--ds-text-faint)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      cursor: "pointer",
      "box-shadow": "none",
      transition:
        "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(
  '.thread-inline-action[aria-label="Pin thread"],\n.thread-inline-action[aria-label="Unpin thread"]',
  {
    "@layer": { [layers.features]: { order: "0" } },
  }
);
applyGlobalStyle('.thread-inline-action[aria-label="Archive thread"],\n.thread-inline-confirm', {
  "@layer": { [layers.features]: { order: "1" } },
});
applyGlobalStyle(".thread-inline-action:hover,\n.thread-inline-action:focus-visible", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 18%, transparent)",
      color: "var(--ds-text-strong)",
      outline: "none",
    },
  },
});
applyGlobalStyle(".thread-inline-action.is-active", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});
applyGlobalStyle(".thread-inline-confirm", {
  "@layer": {
    [layers.features]: {
      height: "24px",
      padding: "0 10px",
      border: "1px solid color-mix(in srgb, var(--ds-status-danger) 42%, var(--ds-border-subtle))",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-status-danger) 8%, transparent)",
      color: "var(--ds-status-danger)",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "var(--font-size-fine)",
      "font-weight": "560",
      cursor: "pointer",
      "box-shadow": "none",
    },
  },
});
applyGlobalStyle(".thread-inline-confirm:hover,\n.thread-inline-confirm:focus-visible", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-status-danger) 14%, transparent)",
      outline: "none",
    },
  },
});

applyGlobalStyle(".thread-more", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-faint)",
      "font-size": "var(--font-size-fine)",
      "font-weight": "500",
      "text-align": "left",
      padding: "4px 10px 4px 30px",
      "border-radius": "6px",
      cursor: "pointer",
      "-webkit-app-region": "no-drag",
      transition:
        "color var(--duration-fast) var(--ease-smooth),\n    border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".thread-more:hover", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "border-color": "transparent",
      background: "transparent",
    },
  },
});

applyGlobalStyle(".thread-more:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-focus-ring) 54%, var(--ds-border-subtle))",
    },
  },
});

applyGlobalStyle(".thread-list-separator", {
  "@layer": {
    [layers.features]: {
      height: "1px",
      margin: "3px 10px 5px 28px",
      background:
        "linear-gradient(90deg, color-mix(in srgb, var(--sidebar-linear-border) 72%, transparent) 0%, transparent 100%)",
    },
  },
});

applyGlobalStyle(".worktree-section", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      "padding-left": "10px",
      "border-left": "1px solid color-mix(in srgb, var(--ds-border-subtle) 54%, transparent)",
      display: "flex",
      "flex-direction": "column",
      gap: "4px",
    },
  },
});

applyGlobalStyle(".worktree-header", {
  "@layer": {
    [layers.features]: {
      "text-transform": "uppercase",
      "font-size": "var(--font-size-micro)",
      "letter-spacing": "0.08em",
      color: "var(--ds-text-faint)",
      "padding-left": "2px",
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
    },
  },
});

applyGlobalStyle(".worktree-header-icon", {
  "@layer": { [layers.features]: { width: "12px", height: "12px", color: "var(--ds-text-faint)" } },
});

applyGlobalStyle(".worktree-list", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "3px" } },
});

applyGlobalStyle(".worktree-card", {
  "@layer": { [layers.features]: { display: "flex", "flex-direction": "column", gap: "2px" } },
});

applyGlobalStyle(".worktree-card-content", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-rows": "1fr",
      opacity: "1",
      transform: "translateY(0)",
      transition:
        "grid-template-rows var(--duration-normal) var(--ease-smooth),\n    opacity var(--duration-normal) var(--ease-smooth),\n    transform var(--duration-normal) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".worktree-card-content-inner", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
      overflow: "hidden",
      "min-height": "0",
      "padding-left": "8px",
    },
  },
});

applyGlobalStyle(".worktree-card-content.collapsed", {
  "@layer": {
    [layers.features]: {
      "grid-template-rows": "0fr",
      opacity: "0",
      transform: "translateY(-4px)",
      "pointer-events": "none",
    },
  },
});

applyGlobalStyle(".worktree-card.deleting", {
  "@layer": { [layers.features]: { opacity: "0.6", "pointer-events": "none" } },
});

applyGlobalStyle(".worktree-row", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) auto",
      gap: "6px",
      padding: "4px 6px",
      "border-radius": "8px",
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
      "text-align": "left",
      cursor: "pointer",
      transition:
        "background var(--duration-normal) var(--ease-smooth),\n    color var(--duration-normal) var(--ease-smooth),\n    box-shadow var(--duration-normal) var(--ease-smooth)",
      "-webkit-app-region": "no-drag",
      "overflow-x": "hidden",
    },
  },
});

applyGlobalStyle(".worktree-row:focus-visible", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
    },
  },
});

applyGlobalStyle(".worktree-row.active", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 18%, transparent)",
      color: "var(--ds-text-primary)",
      "box-shadow": "none",
    },
  },
});

applyGlobalStyle(".worktree-row.deleting", {
  "@layer": { [layers.features]: { cursor: "default" } },
});

applyGlobalStyle(".worktree-row:hover", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-hover) 14%, transparent)",
      color: "var(--ds-text-primary)",
    },
  },
});

applyGlobalStyle(".worktree-row.deleting:hover", {
  "@layer": { [layers.features]: { background: "var(--ds-surface-muted)" } },
});

applyGlobalStyle(".worktree-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-fine)",
      color: "inherit",
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
    },
  },
});

applyGlobalStyle(".worktree-row.deleting .worktree-label", {
  "@layer": { [layers.features]: { color: "var(--ds-text-faint)" } },
});

applyGlobalStyle(".worktree-actions", {
  "@layer": { [layers.features]: { display: "inline-flex", "align-items": "center", gap: "6px" } },
});

applyGlobalStyle(".worktree-deleting", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      "font-size": "var(--font-size-title-sm)",
      color: "var(--ds-text-faint)",
    },
  },
});

applyGlobalStyle(".worktree-deleting-spinner", {
  "@layer": {
    [layers.features]: {
      width: "10px",
      height: "10px",
      "border-radius": "50%",
      border: "2px solid var(--ds-border-subtle)",
      "border-top-color": "var(--ds-text-strong)",
      animation: "spin 0.9s linear infinite",
    },
  },
});

applyGlobalStyle(".worktree-deleting-label", {
  "@layer": { [layers.features]: { "letter-spacing": "0.01em" } },
});

applyGlobalStyle(".worktree-toggle", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-muted)",
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

applyGlobalStyle(".worktree-toggle:hover", {
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});

applyGlobalStyle(".worktree-toggle-icon", {
  "@layer": {
    [layers.features]: {
      display: "inline-block",
      transition: "transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});

applyGlobalStyle(".worktree-toggle.expanded .worktree-toggle-icon", {
  "@layer": { [layers.features]: { transform: "rotate(90deg)" } },
});

applyGlobalStyle(".worktree-row:hover .worktree-toggle,\n.worktree-toggle:focus-visible", {
  "@layer": { [layers.features]: { opacity: "1", "pointer-events": "auto" } },
});

applyGlobalStyle(".sidebar-footer", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "0",
      padding: "4px 0 0",
      "border-radius": "0",
      border: "0",
      background: "transparent",
      "box-shadow": "none",
      color: "var(--ds-text-muted)",
      "font-size": "var(--font-size-title-sm)",
      "-webkit-app-region": "no-drag",
    },
  },
});
applyGlobalStyle('[data-sidebar-footer-surface="kanna-card"]', {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      padding: "4px 0 0",
      border: "0",
      background: "transparent",
    },
  },
});

applyGlobalStyle(".usage-bars", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "7px",
      color: "var(--ds-text-stronger)",
    },
  },
});

applyGlobalStyle(".usage-label", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      "font-weight": "600",
      "letter-spacing": "0.01em",
      color: "var(--ds-text-stronger)",
    },
  },
});

applyGlobalStyle(".usage-value", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      "font-weight": "620",
      "font-size": "var(--font-size-title-sm)",
    },
  },
});

applyGlobalStyle(".usage-bar", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      height: "7px",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-surface-muted) 88%, var(--ds-surface-item))",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      overflow: "hidden",
    },
  },
});

applyGlobalStyle(".usage-bar-fill", {
  "@layer": {
    [layers.features]: {
      display: "block",
      height: "100%",
      "border-radius": "inherit",
      background:
        "linear-gradient(\n    135deg,\n    color-mix(in srgb, var(--ds-text-accent) 68%, white),\n    color-mix(in srgb, var(--ds-text-accent) 84%, var(--ds-brand-primary))\n  )",
      "box-shadow": "0 0 10px color-mix(in srgb, var(--ds-text-accent) 20%, transparent)",
    },
  },
});

applyGlobalStyle(".usage-meta", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-micro)",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
  },
});

applyGlobalStyle(".sidebar-account-popover", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "0",
      bottom: "42px",
      "min-width": "220px",
      padding: "10px 12px",
      display: "grid",
      gap: "8px",
      "z-index": "10",
    },
  },
});

applyGlobalStyle(".sidebar-corner-actions", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "var(--sidebar-padding)",
      bottom: "10px",
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
    },
  },
});

applyGlobalStyle(
  ".sidebar .thread-row:hover .thread-menu-trigger,\n.sidebar .thread-row.active .thread-menu-trigger",
  { "@layer": { [layers.features]: { background: "transparent" } } }
);

applyGlobalStyle(
  '.sidebar .sidebar-refresh-toggle:disabled,\n.sidebar .sidebar-refresh-toggle[aria-busy="true"]',
  { "@layer": { [layers.features]: { background: "transparent" } } }
);

applyGlobalStyle(".app.reduced-transparency .sidebar", {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-sidebar-opaque)",
      "backdrop-filter": "none",
    },
  },
});

applyGlobalStyle(".app.sidebar-collapsed .sidebar", {
  "@layer": {
    [layers.features]: { opacity: "0", transform: "translateX(-12px)", "pointer-events": "none" },
  },
});

applyGlobalStyle(".app.sidebar-collapsed .sidebar-resizer", {
  "@layer": { [layers.features]: { opacity: "0", "pointer-events": "none" } },
});
