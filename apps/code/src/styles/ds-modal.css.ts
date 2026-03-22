import { type GlobalStyleRule, globalKeyframes, globalStyle } from "@vanilla-extract/css";
import { layers } from "./system/layers.css";

globalStyle(".app-dialog-root", {
  "@layer": {
    [layers.components]: { position: "fixed", inset: "0", "z-index": "40", isolation: "isolate" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-root .ds-modal-backdrop", {
  "@layer": {
    [layers.components]: {
      position: "absolute",
      inset: "0",
      background: [
        "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--ds-brand-primary) 10%, transparent), transparent 32%)",
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 18%, transparent), transparent 26%)",
        "var(--ds-modal-backdrop)",
      ].join(", "),
      "backdrop-filter": "blur(var(--ds-modal-backdrop-blur)) saturate(1.08)",
      "-webkit-backdrop-filter": "blur(var(--ds-modal-backdrop-blur)) saturate(1.08)",
      border: "none",
      outline: "none",
      animation: "ds-modal-backdrop-in var(--ds-motion-base) var(--ds-motion-ease-exit)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app.reduced-transparency .app-dialog-root .ds-modal-backdrop", {
  "@layer": {
    [layers.components]: { "backdrop-filter": "none", "-webkit-backdrop-filter": "none" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-card,\n.ds-modal-surface", {
  "@layer": {
    [layers.components]: {
      background: "var(--ds-modal-card-bg)",
      backgroundImage:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-color-white) 7%, transparent), color-mix(in srgb, transparent 100%, transparent))",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      color: "var(--ds-text-strong)",
      "border-radius": "var(--ds-modal-card-radius)",
      "box-shadow": "var(--ds-modal-card-shadow)",
      overflow: "hidden",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-card", {
  "@layer": {
    [layers.components]: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      animation: "ds-modal-card-in var(--ds-motion-slow) var(--ds-motion-ease-enter)",
      "backdrop-filter": "blur(calc(var(--ds-modal-backdrop-blur) * 0.45)) saturate(1.02)",
      "-webkit-backdrop-filter": "blur(calc(var(--ds-modal-backdrop-blur) * 0.45)) saturate(1.02)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-root :where(input, textarea, select):focus-visible", {
  "@layer": {
    [layers.components]: {
      outline: "2px solid var(--ds-modal-focus-ring)",
      "outline-offset": "1px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-title", {
  "@layer": {
    [layers.components]: {
      "font-size": "var(--font-size-title)",
      "font-weight": "600",
      color: "var(--ds-text-strong)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-description", {
  "@layer": {
    [layers.components]: { "font-size": "var(--font-size-chrome)", color: "var(--ds-text-subtle)" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-label,\n.app-dialog-label-text", {
  "@layer": {
    [layers.components]: { "font-size": "var(--font-size-meta)", color: "var(--ds-text-faint)" },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-input", {
  "@layer": {
    [layers.components]: {
      width: "100%",
      "--ds-input-radius": "var(--ds-radius-input)",
      "--ds-input-border": "var(--ds-border-subtle)",
      "--ds-input-surface": "var(--ds-surface-muted)",
      "--ds-input-text": "var(--ds-text-strong)",
      "--ds-input-placeholder": "color-mix(in srgb, var(--ds-text-faint) 90%, transparent)",
      "--ds-border-accent": "color-mix(in srgb, var(--ds-border-accent-soft) 82%, transparent)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-textarea", {
  "@layer": {
    [layers.components]: {
      width: "100%",
      "--ds-textarea-radius": "var(--ds-radius-input)",
      "--ds-textarea-border": "var(--ds-border-subtle)",
      "--ds-textarea-surface": "var(--ds-surface-muted)",
      "--ds-textarea-text": "var(--ds-text-strong)",
      "--ds-textarea-placeholder": "color-mix(in srgb, var(--ds-text-faint) 90%, transparent)",
      "--ds-textarea-focus": "color-mix(in srgb, var(--ds-border-accent-soft) 82%, transparent)",
      "min-height": "96px",
      resize: "vertical",
      "font-family": 'var(--code-font-family, Menlo, Monaco, "Courier New", monospace)',
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-input:focus-within", {
  "@layer": {
    [layers.components]: {
      "--ds-input-surface":
        "color-mix(in srgb, var(--ds-surface-card) 85%, var(--ds-surface-muted))",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-divider", {
  "@layer": {
    [layers.components]: {
      height: "1px",
      background: "var(--ds-border-subtle)",
      margin: "4px 0 2px",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-footer", {
  "@layer": {
    [layers.components]: {
      display: "flex",
      "justify-content": "flex-end",
      gap: "8px",
      "margin-top": "4px",
      "flex-wrap": "wrap",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-error", {
  "@layer": {
    [layers.components]: {
      "font-size": "var(--font-size-meta)",
      color: "color-mix(in srgb, var(--status-error) 82%, white)",
      background: "color-mix(in srgb, var(--status-error) 16%, transparent)",
      border: "1px solid color-mix(in srgb, var(--status-error) 44%, transparent)",
      padding: "8px 10px",
      "border-radius": "var(--ds-radius-md)",
    },
  },
} as unknown as GlobalStyleRule);
globalStyle(".app-dialog-button", {
  "@layer": {
    [layers.components]: { padding: "6px 12px", "border-radius": "var(--ds-radius-md)" },
  },
} as unknown as GlobalStyleRule);
globalKeyframes("ds-modal-backdrop-in", {
  from: { opacity: "0" },
  to: { opacity: "1" },
});
globalKeyframes("ds-modal-card-in", {
  from: { opacity: "0", transform: "translate(-50%, calc(-50% + 8px)) scale(0.985)" },
  to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
});
globalStyle(".app-dialog-root .ds-modal-backdrop,\n  .app-dialog-card", {
  "@layer": {
    [layers.components]: {
      "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } },
    },
  },
} as unknown as GlobalStyleRule);
