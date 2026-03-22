import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".debug-panel", {
  "@layer": {
    [layers.features]: {
      "border-top": "1px solid color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-debug) 86%, transparent),\n    color-mix(in srgb, var(--ds-surface-debug) 97%, transparent)\n  )",
      display: "flex",
      "flex-direction": "column",
      "grid-column": "1 / -1",
      "grid-row": "5",
      "-webkit-app-region": "no-drag",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
      "min-width": "0",
      overflow: "hidden",
      "backdrop-filter": "blur(10px)",
    },
  },
});
applyGlobalStyle('.main:has([data-right-rail="true"]) .debug-panel', {
  "@layer": { [layers.features]: { "grid-column": "1" } },
});
applyGlobalStyle(".debug-panel.open", {
  "@layer": {
    [layers.features]: {
      height: "var(--debug-panel-height, 180px)",
      "border-top": "none",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent),\n    0 -1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-panel-resizer", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      height: "10px",
      margin: "0",
      padding: "0",
      border: "0",
      "border-radius": "0",
      background: "transparent",
      "box-shadow": "none",
      color: "inherit",
      "-webkit-appearance": "none",
      appearance: "none",
      cursor: "row-resize",
      position: "relative",
      "flex-shrink": "0",
    },
  },
});
applyGlobalStyle(".debug-panel-resizer::after", {
  "@layer": {
    [layers.features]: {
      content: '""',
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "46px",
      height: "3px",
      transform: "translate(-50%, -50%)",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
      opacity: "0.44",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".debug-panel-resizer:hover::after", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      transform: "translate(-50%, -50%) scaleX(1.04)",
      background: "color-mix(in srgb, var(--ds-border-accent-soft) 78%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-panel-resizer:focus-visible", {
  "@layer": { [layers.features]: { outline: "none" } },
});
applyGlobalStyle('body[data-resizing="debug-panel"] .debug-panel-resizer::after', {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      transform: "translate(-50%, -50%) scaleX(1.04)",
      background: "color-mix(in srgb, var(--ds-border-accent) 76%, var(--ds-border-accent-soft))",
    },
  },
});
applyGlobalStyle(".debug-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      padding: "8px 18px 7px",
      "font-size": "var(--font-size-meta)",
      gap: "12px",
      "border-bottom": "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-muted) 72%, transparent),\n    color-mix(in srgb, var(--ds-surface-muted) 58%, transparent)\n  )",
    },
  },
});
applyGlobalStyle(".debug-title", {
  "@layer": {
    [layers.features]: {
      "font-weight": "650",
      "letter-spacing": "0.1em",
      "font-size": "var(--font-size-fine)",
      "text-transform": "uppercase",
      color: "color-mix(in srgb, var(--ds-text-muted) 92%, var(--ds-text-faint))",
    },
  },
});
applyGlobalStyle(".debug-actions", {
  "@layer": { [layers.features]: { display: "flex", gap: "6px" } },
});
applyGlobalStyle(".debug-list", {
  "@layer": {
    [layers.features]: {
      "overflow-y": "auto",
      "overflow-x": "hidden",
      padding: "8px 16px 12px",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      "min-height": "0",
      "min-width": "0",
      "scrollbar-width": "thin",
      "scrollbar-color": "var(--scrollbar-thumb) var(--scrollbar-track)",
      "scrollbar-gutter": "stable",
      "--scrollbar-thumb":
        "color-mix(in srgb, var(--ds-border-stronger) 72%, var(--ds-surface-control-hover))",
      "--scrollbar-thumb-hover":
        "color-mix(\n    in srgb,\n    var(--ds-border-accent-soft) 52%,\n    var(--ds-surface-control-hover)\n  )",
      "--scrollbar-track": "color-mix(in srgb, var(--ds-surface-item) 84%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-list::-webkit-scrollbar", {
  "@layer": { [layers.features]: { width: "8px", height: "8px" } },
});
applyGlobalStyle(".debug-list::-webkit-scrollbar-track", {
  "@layer": {
    [layers.features]: { "border-radius": "999px", background: "var(--scrollbar-track)" },
  },
});
applyGlobalStyle(".debug-list::-webkit-scrollbar-thumb", {
  "@layer": {
    [layers.features]: {
      "border-radius": "999px",
      border: "2px solid transparent",
      "background-clip": "padding-box",
      "background-color": "var(--scrollbar-thumb)",
    },
  },
});
applyGlobalStyle(".debug-list::-webkit-scrollbar-thumb:hover", {
  "@layer": { [layers.features]: { "background-color": "var(--scrollbar-thumb-hover)" } },
});
applyGlobalStyle(".debug-empty", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".debug-row", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "7px",
      padding: "9px 11px",
      "border-radius": "11px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      background:
        "linear-gradient(\n    180deg,\n    color-mix(in srgb, var(--ds-surface-card-base) 74%, transparent),\n    color-mix(in srgb, var(--ds-surface-item) 72%, transparent)\n  )",
      "box-shadow":
        "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 26%, transparent),\n    0 8px 16px color-mix(in srgb, var(--ds-brand-background) 14%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-meta", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "8px",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      "align-items": "center",
    },
  },
});
applyGlobalStyle(".debug-source", {
  "@layer": {
    [layers.features]: {
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
      "font-size": "var(--font-size-micro)",
      padding: "2px 6px",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-surface-control) 84%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-source.error", {
  "@layer": {
    [layers.features]: {
      background:
        "var(--ds-state-error-bg, color-mix(in srgb, var(--status-error) 18%, transparent))",
      color:
        "var(\n    --ds-state-error-text,\n    color-mix(in srgb, var(--status-error) 78%, var(--ds-text-strong))\n  )",
      border:
        "1px solid\n    var(--ds-state-error-border, color-mix(in srgb, var(--status-error) 44%, transparent))",
    },
  },
});
applyGlobalStyle(".debug-source.stderr", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--status-warning) 16%, transparent)",
      color: "color-mix(in srgb, var(--status-warning) 84%, var(--ds-text-strong))",
      border: "1px solid color-mix(in srgb, var(--status-warning) 42%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-payload", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      "font-size": "var(--font-size-fine)",
      lineHeight: "var(--line-height-content)",
      color: "var(--ds-text-stronger)",
      "white-space": "pre-wrap",
      "word-break": "break-word",
    },
  },
});
applyGlobalStyle(".debug-label", {
  "@layer": { [layers.features]: { "font-weight": "600", color: "var(--ds-text-strong)" } },
});
applyGlobalStyle(".debug-distributed-diagnostics", {
  "@layer": {
    [layers.features]: {
      padding: "8px 16px 6px",
      "border-bottom": "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 60%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-grid", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      display: "grid",
      "grid-template-columns": "repeat(5, minmax(0, 1fr))",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-item", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      "border-radius": "7px",
      padding: "5px 7px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 72%, transparent)",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-item span", {
  "@layer": {
    [layers.features]: {
      display: "block",
      "font-size": "var(--font-size-tiny)",
      color: "var(--ds-text-faint)",
      "letter-spacing": "0.03em",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-item strong", {
  "@layer": {
    [layers.features]: {
      display: "block",
      "margin-top": "2px",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
      "border-radius": "7px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 62%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote summary", {
  "@layer": {
    [layers.features]: {
      cursor: "pointer",
      padding: "6px 8px",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-muted)",
      "letter-spacing": "0.04em",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote-copy", {
  "@layer": {
    [layers.features]: {
      padding: "0 8px",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-subtle)",
      lineHeight: "var(--line-height-label)",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote-fields", {
  "@layer": {
    [layers.features]: {
      margin: "6px 0 0",
      padding: "0 8px 8px",
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote-fields div", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      "border-radius": "6px",
      padding: "4px 6px",
      background: "color-mix(in srgb, var(--ds-surface-item) 66%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote-fields dt", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-tiny)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote-fields dd", {
  "@layer": {
    [layers.features]: {
      margin: "2px 0 0",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics", {
  "@layer": {
    [layers.features]: {
      padding: "8px 16px 10px",
      "border-bottom": "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 50%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-empty", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-grid", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-item", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      "border-radius": "7px",
      padding: "6px 8px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 72%, transparent)",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-strong)",
      "font-weight": "600",
      lineHeight: "var(--line-height-label)",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-item dl", {
  "@layer": {
    [layers.features]: {
      margin: "6px 0 0",
      display: "grid",
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
      gap: "4px 6px",
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-item dt", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-tiny)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-item dd", {
  "@layer": {
    [layers.features]: {
      margin: "1px 0 0",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-strong)",
      "overflow-wrap": "anywhere",
    },
  },
});
applyGlobalStyle(".debug-runtime-probes", {
  "@layer": {
    [layers.features]: {
      padding: "8px 16px 10px",
      "border-bottom": "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 44%, transparent)",
    },
  },
});
applyGlobalStyle(".debug-runtime-probes-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".debug-runtime-probe-actions", {
  "@layer": {
    [layers.features]: { "margin-top": "6px", display: "flex", "flex-wrap": "wrap", gap: "6px" },
  },
});
applyGlobalStyle(".debug-runtime-live-skill", {
  "@layer": {
    [layers.features]: {
      "margin-top": "8px",
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) minmax(0, 1fr) auto",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".debug-runtime-live-skill-field", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
      "border-radius": "7px",
      background: "color-mix(in srgb, var(--ds-surface-item) 72%, transparent)",
      "font-size": "var(--font-size-fine)",
    },
  },
});
applyGlobalStyle(".debug-runtime-live-skill-options", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) minmax(0, 1fr)",
      gap: "6px",
    },
  },
});
applyGlobalStyle(".debug-runtime-live-skill-checkbox", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      "min-height": "26px",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".debug-runtime-live-skill-checkbox input", {
  "@layer": { [layers.features]: { margin: "0" } },
});
applyGlobalStyle(".debug-runtime-probe-status", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      "font-size": "var(--font-size-micro)",
      color: "var(--ds-text-muted)",
    },
  },
});
applyGlobalStyle(".debug-runtime-probe-error", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      "font-size": "var(--font-size-micro)",
      color: "var(--status-error)",
    },
  },
});
applyGlobalStyle(".debug-runtime-probe-result", {
  "@layer": {
    [layers.features]: {
      "margin-top": "6px",
      "margin-bottom": "0",
      padding: "6px 8px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      "border-radius": "7px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 70%, transparent)",
      "font-size": "var(--font-size-micro)",
      lineHeight: "var(--line-height-label)",
      color: "var(--ds-text-stronger)",
      "white-space": "pre-wrap",
      "word-break": "break-word",
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-grid", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "grid-template-columns": "repeat(3, minmax(0, 1fr))" } },
    },
  },
});
applyGlobalStyle(".debug-distributed-diagnostics-remote-fields", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "grid-template-columns": "repeat(1, minmax(0, 1fr))" } },
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-grid", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "grid-template-columns": "repeat(1, minmax(0, 1fr))" } },
    },
  },
});
applyGlobalStyle(".debug-event-channel-diagnostics-item dl", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "grid-template-columns": "repeat(1, minmax(0, 1fr))" } },
    },
  },
});
applyGlobalStyle(".debug-runtime-live-skill", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "grid-template-columns": "minmax(0, 1fr)" } },
    },
  },
});
applyGlobalStyle(".debug-runtime-live-skill-options", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 960px)": { "grid-template-columns": "minmax(0, 1fr)" } },
    },
  },
});
