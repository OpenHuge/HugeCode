import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".settings-overlay", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "z-index": "90",
    },
  },
});
applyGlobalStyle(".settings-window", {
  "@layer": {
    [layers.features]: {
      width: "min(980px, 94vw)",
      height: "min(680px, 88vh)",
      "border-radius": "var(--ds-radius-lg)",
      display: "flex",
      "flex-direction": "column",
      overflow: "hidden",
    },
  },
});
applyGlobalStyle(".account-pools-window", {
  "@layer": {
    [layers.features]: {
      width: "min(1080px, 95vw)",
      height: "min(800px, 92vh)",
      overflow: "hidden",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 86%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-canvas) 96%, var(--ds-surface-card-base))",
      "box-shadow":
        "0 24px 64px color-mix(in srgb, var(--ds-color-black) 12%, transparent),\n    0 2px 8px color-mix(in srgb, var(--ds-color-black) 5%, transparent)",
    },
  },
});
applyGlobalStyle(".account-pools-window--chatgpt", {
  "@layer": {
    [layers.features]: {
      "border-radius": "16px",
      border: "1px solid color-mix(in srgb, var(--ds-border-muted) 34%, transparent)",
      background: "var(--ds-surface-card-base)",
      "box-shadow": "0 8px 18px color-mix(in srgb, var(--ds-brand-background) 12%, transparent)",
    },
  },
});
applyGlobalStyle(".account-pools-titlebar", {
  "@layer": {
    [layers.features]: {
      "align-items": "center",
      gap: "12px",
      padding: "16px 18px",
      "border-bottom": "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 98%, transparent), color-mix(in srgb, var(--ds-surface-canvas) 92%, transparent))",
    },
  },
});
applyGlobalStyle(".account-pools-title-copy", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
      display: "flex",
      "flex-direction": "column",
      gap: "5px",
    },
  },
});
applyGlobalStyle(".account-pools-title-subtitle", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--font-size-meta)",
      "line-height": "var(--line-height-meta)",
      color: "var(--ds-text-subtle)",
      "max-width": "76ch",
    },
  },
});
applyGlobalStyle(".account-pools-titlebar .settings-close", {
  "@layer": {
    [layers.features]: {
      "margin-left": "auto",
      width: "32px",
      height: "32px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control) 86%, transparent)",
      "border-radius": "12px",
    },
  },
});
applyGlobalStyle(".account-pools-body", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      display: "flex",
      "min-height": "0",
      background: "color-mix(in srgb, var(--ds-surface-canvas) 92%, transparent)",
    },
  },
});
applyGlobalStyle(".account-pools-content", {
  "@layer": {
    [layers.features]: {
      flex: "1",
      "min-height": "0",
      overflow: "auto",
      padding: "20px 20px 24px",
      display: "flex",
      "flex-direction": "column",
      gap: "20px",
    },
  },
});
applyGlobalStyle(".account-pools-management", {
  "@layer": {
    [layers.features]: {
      "margin-bottom": "0",
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
      color: "var(--ds-text-strong)",
    },
  },
});
applyGlobalStyle(".error-boundary", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      height: "100vh",
      padding: "var(--ds-space-8)",
      "font-family": "var(--ui-font-family)",
      color: "var(--ds-text-primary)",
      background: "var(--ds-brand-background)",
      "text-align": "center",
      gap: "var(--ds-space-4)",
    },
  },
});
applyGlobalStyle(".error-boundary__title", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--ds-button-font-lg)",
      "font-weight": "600",
      margin: "0",
    },
  },
});
applyGlobalStyle(".error-boundary__message", {
  "@layer": {
    [layers.features]: {
      "font-size": "var(--ds-button-font-sm)",
      color: "var(--ds-text-subtle)",
      "max-width": "36rem",
      margin: "0",
    },
  },
});
applyGlobalStyle(".error-boundary__button", {
  "@layer": {
    [layers.features]: {
      "margin-top": "var(--ds-space-2)",
      padding: "var(--ds-space-2) var(--ds-space-5)",
      "border-radius": "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-subtle)",
      background: "var(--ds-surface-item)",
      color: "var(--ds-text-primary)",
      cursor: "pointer",
      "font-size": "var(--ds-button-font-sm)",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});
applyGlobalStyle(".error-boundary__button:hover", {
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-hover)",
      "border-color": "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
    },
  },
});

applyGlobalStyle(".settings-window", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          width: "min(680px, 96vw)",
          height: "min(760px, calc(100vh - env(safe-area-inset-top, 0px) - 20px))",
          top: "calc(50% + env(safe-area-inset-top, 0px) * 0.5 + 10px)",
        },
      },
    },
  },
});
applyGlobalStyle(".account-pools-window", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          width: "min(740px, 96vw)",
          height: "min(800px, calc(100vh - env(safe-area-inset-top, 0px) - 20px))",
        },
      },
    },
  },
});
applyGlobalStyle(".account-pools-titlebar", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          padding: "14px 14px 12px",
        },
      },
    },
  },
});
applyGlobalStyle(".account-pools-title-subtitle", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          "max-width": "none",
        },
      },
    },
  },
});
applyGlobalStyle(".account-pools-content", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          padding: "14px",
        },
      },
    },
  },
});
