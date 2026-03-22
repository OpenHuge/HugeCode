import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
import "./composer-waveform-feedback.css";
applyGlobalStyle(".composer", {
  "@layer": {
    [layers.features]: {
      "--composer-spotlight": "color-mix(in srgb, var(--ds-brand-primary) 20%, transparent)",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
      "-webkit-app-region": "no-drag",
      padding: "10px var(--main-panel-padding) 14px",
      "border-top": "none",
      position: "relative",
      background: "transparent",
      "grid-column": "1",
      "grid-row": "3",
    },
  },
});
applyGlobalStyle(".composer--thread", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      "max-width": "none",
      "justify-self": "stretch",
    },
  },
});
applyGlobalStyle(".composer::before", {
  "@layer": {
    [layers.features]: {
      content: "none",
    },
  },
});
applyGlobalStyle(':root[data-theme="light"] .composer', {
  "@layer": {
    [layers.features]: {
      background: "transparent",
    },
  },
});
applyGlobalStyle(":root:not([data-theme]) .composer", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(prefers-color-scheme: light)": {
          background: "transparent",
        },
      },
    },
  },
});
applyGlobalStyle(".composer-mobile-menu", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      position: "relative",
    },
  },
});
applyGlobalStyle(".composer-mobile-actions-popover", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "0",
      bottom: "calc(100% + 10px)",
      "min-width": "170px",
      padding: "6px",
      display: "grid",
      gap: "4px",
      "z-index": "30",
    },
  },
});
applyGlobalStyle(".composer-attachments", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "10px",
      "margin-bottom": "0",
    },
  },
});
applyGlobalStyle(".composer-attachment", {
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      "align-items": "center",
      gap: "7px",
      padding: "4px 9px",
      "border-radius": "12px",
      background: "color-mix(in srgb, var(--ds-surface-item) 92%, var(--ds-surface-card-base))",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 88%, transparent)",
      color: "var(--ds-text-strong)",
      "font-size": "var(--font-size-meta)",
      "max-width": "100%",
      position: "relative",
      "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
    },
  },
});
applyGlobalStyle(
  ".composer-attachment:hover .composer-attachment-preview,\n.composer-attachment:focus-within .composer-attachment-preview",
  {
    "@layer": {
      [layers.features]: {
        opacity: "1",
        transform: "translate(-50%, -6px) scale(1)",
        "pointer-events": "auto",
      },
    },
  }
);
applyGlobalStyle(".composer-attachment-preview", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "50%",
      bottom: "calc(100% + 8px)",
      width: "240px",
      height: "180px",
      "border-radius": "12px",
      overflow: "hidden",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-item)",
      "box-shadow": "0 12px 28px color-mix(in srgb, var(--ds-color-black) 24%, transparent)",
      opacity: "0",
      transform: "translate(-50%, -2px) scale(0.98)",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth),\n    transform var(--duration-fast) var(--ease-smooth)",
      "pointer-events": "none",
      "z-index": "20",
    },
  },
});
applyGlobalStyle(".composer-attachment-preview img", {
  "@layer": {
    [layers.features]: {
      display: "block",
      width: "100%",
      height: "100%",
      "object-fit": "contain",
    },
  },
});
applyGlobalStyle(".composer-attachment-thumb", {
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      "border-radius": "7px",
      overflow: "hidden",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-item)",
      flex: "0 0 auto",
    },
  },
});
applyGlobalStyle(".composer-attachment-thumb img", {
  "@layer": {
    [layers.features]: {
      display: "block",
      width: "100%",
      height: "100%",
      "object-fit": "cover",
    },
  },
});
applyGlobalStyle(".composer-attachment-name", {
  "@layer": {
    [layers.features]: {
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "max-width": "220px",
    },
  },
});
applyGlobalStyle(".composer-attachment-remove", {
  "@layer": {
    [layers.features]: {
      border: "none",
      background: "transparent",
      color: "var(--ds-text-faint)",
      "border-radius": "999px",
      width: "18px",
      height: "18px",
      padding: "0",
      cursor: "pointer",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      transition:
        "color var(--duration-fast) var(--ease-smooth),\n    background var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".composer-attachment-remove:hover", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-stronger)",
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 74%, transparent)",
    },
  },
});
applyGlobalStyle(".composer-attachment-remove:disabled", {
  "@layer": {
    [layers.features]: {
      opacity: "0.5",
      cursor: "not-allowed",
    },
  },
});
applyGlobalStyle(".composer-attachment.is-image", {
  "@layer": {
    [layers.features]: {
      padding: "0",
      width: "64px",
      height: "64px",
      "justify-content": "center",
      overflow: "visible",
    },
  },
});
applyGlobalStyle(".composer-attachment.is-image .composer-attachment-thumb", {
  "@layer": {
    [layers.features]: {
      width: "100%",
      height: "100%",
      "border-radius": "11px",
      border: "none",
    },
  },
});
applyGlobalStyle(".composer-attachment.is-image .composer-attachment-name", {
  "@layer": {
    [layers.features]: {
      display: "none",
    },
  },
});
applyGlobalStyle(".composer-attachment.is-image .composer-attachment-remove", {
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "-6px",
      right: "-6px",
      background: "var(--ds-surface-popover)",
      border: "1px solid var(--ds-border-subtle)",
      "box-shadow": "0 2px 4px color-mix(in srgb, var(--ds-color-black) 20%, transparent)",
      width: "20px",
      height: "20px",
      opacity: "0",
      transform: "scale(0.8)",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".composer-attachment.is-image:hover .composer-attachment-remove", {
  "@layer": {
    [layers.features]: {
      opacity: "1",
      transform: "scale(1)",
    },
  },
});
