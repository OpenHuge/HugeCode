import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".error-toasts", {
  "@layer": {
    [layers.features]: {
      position: "fixed",
      top: "16px",
      right: "16px",
      left: "auto",
      width: "min(420px, calc(100vw - 32px))",
      transform: "none",
      "z-index": "var(--z-toast, 70)",
      gap: "8px",
      "pointer-events": "none",
      "-webkit-app-region": "no-drag",
      "align-items": "flex-end",
    },
  },
});
applyGlobalStyle(".error-toast", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "min-width": "0",
      "max-width": "100%",
      "pointer-events": "auto",
      "--ds-toast-enter-duration": "0.18s",
      "box-shadow": "var(--ds-toast-shadow)",
    },
  },
});
applyGlobalStyle(".error-toast-header", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
    },
  },
});
applyGlobalStyle(".error-toast-title", {
  "@layer": {
    [layers.features]: {
      fontWeight: "600",
      fontSize: "var(--font-size-chrome)",
      lineHeight: "var(--line-height-chrome)",
    },
  },
});
applyGlobalStyle(".error-toast-actions", {
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
    },
  },
});
applyGlobalStyle(".error-toast-dismiss", {
  "@layer": {
    [layers.features]: {
      minWidth: "24px",
      width: "24px",
      height: "24px",
      padding: "0",
      borderRadius: "6px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition:
        "background var(--duration-fast) var(--ease-smooth),\n    color var(--duration-fast) var(--ease-smooth)",
    },
  },
});
applyGlobalStyle(".error-toast-dismiss svg", {
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
    },
  },
});
applyGlobalStyle(".error-toast-dismiss:hover", {
  "@layer": {
    [layers.features]: { background: "color-mix(in srgb, var(--status-error) 16%, transparent)" },
  },
});
applyGlobalStyle(".error-toast-body", {
  "@layer": {
    [layers.features]: {
      marginTop: "0",
      fontSize: "var(--font-size-meta)",
      opacity: "0.95",
      lineHeight: "var(--line-height-meta)",
      maxHeight: "120px",
      overflowY: "auto",
      overflowX: "hidden",
      overflowWrap: "anywhere",
      whiteSpace: "normal",
    },
  },
});
applyGlobalStyle(".error-toasts", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          top: "10px",
          right: "12px",
          width: "min(360px, calc(100vw - 24px))",
        },
      },
    },
  },
});
applyGlobalStyle("body:has(.settings-overlay) .error-toasts", {
  "@layer": {
    [layers.features]: {
      top: "auto",
      bottom: "24px",
      right: "24px",
      left: "auto",
      width: "min(420px, calc(100vw - 48px))",
      transform: "none",
    },
  },
});
applyGlobalStyle("body:has(.settings-overlay) .error-toasts", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          bottom: "16px",
          width: "min(360px, calc(100vw - 24px))",
        },
      },
    },
  },
});
