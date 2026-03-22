import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".request-user-input-message", {
  "@layer": { [layers.features]: { "justify-content": "flex-start", width: "100%" } },
});
applyGlobalStyle(".request-user-input-card", {
  "@layer": {
    [layers.features]: {
      width: "min(100%, 760px)",
      "max-width": "100%",
      background:
        "linear-gradient(\n      180deg,\n      color-mix(in srgb, var(--ds-surface-card) 10%, transparent),\n      color-mix(in srgb, var(--ds-surface-card-base) 94%, transparent)\n    )",
      border: "none",
      "border-radius": "18px",
      padding: "14px 15px",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      "box-shadow":
        "0 12px 28px color-mix(in srgb, var(--ds-color-black) 8%, transparent),\n      inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
    },
  },
});
applyGlobalStyle(
  ".timeline-request-card,\n.timeline-tool-call-card,\n.timeline-plan-card,\n.timeline-approval-card,\n.timeline-turn-diff-card",
  {
    "@layer": {
      [layers.features]: {
        border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 68%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent))",
      },
    },
  }
);
applyGlobalStyle(".timeline-status-card", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 72%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent))",
    },
  },
});
applyGlobalStyle(".timeline-status-card--runtime", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-warning) 34%, var(--ds-border-subtle))",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--status-warning) 7%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent))",
    },
  },
});
applyGlobalStyle(".timeline-status-card--error", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-error) 26%, var(--ds-border-subtle))",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--status-error) 6%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent))",
    },
  },
});
applyGlobalStyle(".timeline-status-card--success", {
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--status-success) 24%, var(--ds-border-subtle))",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--status-success) 6%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent))",
    },
  },
});
applyGlobalStyle(".request-user-input-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "baseline",
      gap: "8px",
    },
  },
});
applyGlobalStyle(".request-user-input-title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "620",
      color: "var(--ds-text-stronger)",
      "text-transform": "uppercase",
      "letter-spacing": "0.06em",
    },
  },
});
applyGlobalStyle(".timeline-status-headline", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "flex-start",
      gap: "10px",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".timeline-status-icon", {
  "@layer": {
    [layers.features]: {
      width: "30px",
      height: "30px",
      "border-radius": "999px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      flex: "0 0 auto",
      color: "var(--ds-text-stronger)",
      background: "color-mix(in srgb, var(--ds-surface-active) 42%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 60%, transparent)",
    },
  },
});
applyGlobalStyle(".timeline-status-copy", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      "min-width": "0",
      flex: "1 1 auto",
    },
  },
});
applyGlobalStyle(".request-user-input-workspace", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-faint)" },
  },
});
applyGlobalStyle(".request-user-input-queue", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-subtle)" },
  },
});
applyGlobalStyle(".request-user-input-body", {
  "@layer": { [layers.features]: { display: "grid", gap: "10px" } },
});
applyGlobalStyle(".request-user-input-question", {
  "@layer": { [layers.features]: { display: "grid", gap: "6px" } },
});
applyGlobalStyle(".request-user-input-question-header", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "text-transform": "uppercase",
      "letter-spacing": "0.06em",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".request-user-input-question-text", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-strong)",
      "line-height": "var(--line-height-145)",
    },
  },
});
applyGlobalStyle(".request-user-input-options", {
  "@layer": { [layers.features]: { display: "grid", gap: "5px" } },
});
applyGlobalStyle(".request-user-input-option", {
  "@layer": {
    [layers.features]: {
      position: "relative",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      "border-radius": "11px",
      padding: "7px 9px",
      background: "color-mix(in srgb, var(--ds-surface-muted) 78%, transparent)",
      "text-align": "left",
      display: "grid",
      "grid-template-columns": "auto minmax(0, 1fr) auto",
      "align-items": "center",
      gap: "10px",
      cursor: "pointer",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".request-user-input-option:hover", {
  "@layer": {
    [layers.features]: {
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-hover) 72%, var(--ds-surface-muted))",
    },
  },
});
applyGlobalStyle(".request-user-input-option:focus-within", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
    },
  },
});
applyGlobalStyle(
  '.request-user-input-option.is-selected,\n.request-user-input-option[data-checked="true"]',
  {
    "@layer": {
      [layers.features]: {
        "border-color": "color-mix(in srgb, var(--ds-border-accent-soft) 60%, transparent)",
        background: "color-mix(in srgb, var(--ds-surface-active) 42%, var(--ds-surface-card-base))",
        "box-shadow": "0 0 0 1px color-mix(in srgb, var(--ds-border-accent-soft) 20%, transparent)",
      },
    },
  }
);
applyGlobalStyle(".request-user-input-option-control", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "0",
      padding: "0",
      border: "0",
      opacity: "0",
      "pointer-events": "none",
    },
  },
});
applyGlobalStyle(".request-user-input-option-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "font-weight": "560",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".request-user-input-option-index", {
  "@layer": {
    [layers.features]: {
      width: "28px",
      height: "28px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "9px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 92%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-fine)",
      "font-weight": "700",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".request-user-input-option-main", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "2px",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".request-user-input-option-description", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-fine)", color: "var(--ds-text-subtle)" },
  },
});
applyGlobalStyle(".request-user-input-option-check", {
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "999px",
      color: "var(--ds-text-stronger)",
      background: "color-mix(in srgb, var(--ds-surface-active) 42%, transparent)",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".request-user-input-notes", {
  "@layer": {
    [layers.features]: {
      "border-radius": "11px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 80%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "7px 9px",
      "font-size": "var(--font-size-meta)",
      "line-height": "var(--line-height-140)",
      resize: "vertical",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth),\n    box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".request-user-input-notes:focus", {
  "@layer": {
    [layers.features]: {
      outline: "2px solid var(--ds-focus-ring)",
      "outline-offset": "1px",
      "border-color": "color-mix(in srgb, var(--ds-focus-ring) 54%, var(--ds-border-subtle))",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 88%, transparent)",
    },
  },
});
applyGlobalStyle(".timeline-approval-pill", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      "align-self": "flex-start",
      padding: "5px 9px",
      "border-radius": "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 74%, transparent)",
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-fine)",
      "font-weight": "560",
      "white-space": "nowrap",
    },
  },
});
applyGlobalStyle(".timeline-approval-grid", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      "grid-template-columns": "repeat(auto-fit, minmax(180px, 1fr))",
    },
  },
});
applyGlobalStyle(".timeline-approval-detail", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      padding: "10px 11px",
      "border-radius": "12px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 76%, transparent)",
    },
  },
});
applyGlobalStyle(".timeline-approval-detail-label", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-micro)",
      "letter-spacing": "0.06em",
      "text-transform": "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});
applyGlobalStyle(".timeline-approval-detail-value", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-strong)",
      "line-height": "var(--line-height-145)",
      "white-space": "pre-wrap",
      "word-break": "break-word",
    },
  },
});
applyGlobalStyle(".timeline-approval-detail-value--code", {
  "@layer": {
    [layers.features]: {
      "font-family": "var(--font-family-code)",
      "font-size": "var(--font-size-fine)",
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-files", {
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      margin: "0",
      padding: "0",
      "list-style": "none",
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-file", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      padding: "8px 10px",
      "border-radius": "12px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 78%, transparent)",
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-file-status", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "2px 8px",
      "border-radius": "999px",
      background: "color-mix(in srgb, var(--ds-surface-active) 46%, transparent)",
      color: "var(--ds-text-subtle)",
      "font-size": "var(--font-size-fine)",
      "font-weight": "560",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-file-path", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "font-size": "var(--font-size-meta)",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-view", {
  "@layer": {
    [layers.features]: {
      "border-radius": "14px",
      overflow: "hidden",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 72%, transparent)",
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-fallback", {
  "@layer": {
    [layers.features]: {
      margin: "0",
      padding: "12px 14px",
      overflow: "auto",
      "font-family": "var(--font-family-code)",
      "font-size": "var(--font-size-fine)",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".request-user-input-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "justify-content": "flex-end",
      gap: "8px",
      "flex-wrap": "wrap",
      "padding-top": "10px",
      "border-top": "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
    },
  },
});
applyGlobalStyle(".request-user-input-card button", {
  "@layer": { [layers.features]: { transform: "none", "box-shadow": "none" } },
});
applyGlobalStyle(".request-user-input-card button:hover:not(:disabled)", {
  "@layer": { [layers.features]: { transform: "none", "box-shadow": "none" } },
});
applyGlobalStyle(".request-user-input-empty", {
  "@layer": {
    [layers.features]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-muted)" },
  },
});
applyGlobalStyle(".plan-ready-followup-change", {
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-surface-active) 46%, var(--ds-surface-card-base))",
      color: "var(--ds-text-strong)",
      border:
        "1px solid color-mix(in srgb, var(--ds-border-accent-soft) 52%, var(--ds-border-subtle))",
    },
  },
});
applyGlobalStyle(".request-user-input-card", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 960px)": { width: "min(100%, 680px)" } } },
  },
});
applyGlobalStyle(".request-user-input-actions", {
  "@layer": {
    [layers.features]: { "@media": { "(max-width: 720px)": { "justify-content": "stretch" } } },
  },
});
applyGlobalStyle(".request-user-input-actions > button", {
  "@layer": { [layers.features]: { "@media": { "(max-width: 720px)": { width: "100%" } } } },
});
applyGlobalStyle(".timeline-status-headline", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { gap: "8px" } },
    },
  },
});
applyGlobalStyle(".timeline-approval-grid", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 720px)": { "grid-template-columns": "1fr" } },
    },
  },
});
applyGlobalStyle(".timeline-turn-diff-file", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 640px)": { "align-items": "flex-start", "flex-direction": "column" },
      },
    },
  },
});
applyGlobalStyle(".request-user-input-option", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 640px)": {
          "grid-template-columns": "auto minmax(0, 1fr)",
        },
      },
    },
  },
});
applyGlobalStyle(".request-user-input-option-check", {
  "@layer": {
    [layers.features]: {
      "@media": { "(max-width: 640px)": { display: "none" } },
    },
  },
});
