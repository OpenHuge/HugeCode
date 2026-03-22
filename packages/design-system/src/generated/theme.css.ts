import { createGlobalTheme, createGlobalThemeContract } from "@vanilla-extract/css";

export const vars = createGlobalThemeContract(
  {
    space: {
      "2xs": null,
      xs: null,
      sm: null,
      md: null,
      lg: null,
      xl: null,
      "2xl": null,
    },
    radius: {
      sm: null,
      md: null,
      lg: null,
      xl: null,
      "2xl": null,
      full: null,
    },
    motion: {
      duration: {
        fast: null,
        normal: null,
        slow: null,
      },
      easing: {
        standard: null,
        expressive: null,
      },
    },
    typography: {
      family: {
        ui: null,
        code: null,
      },
      size: {
        label: null,
        ui: null,
        content: null,
        title: null,
        display: null,
      },
    },
    color: {
      background: null,
      foreground: null,
      surface: {
        canvas: null,
        card: null,
        elevated: null,
        muted: null,
      },
      text: {
        primary: null,
        muted: null,
        inverse: null,
      },
      border: {
        default: null,
        strong: null,
      },
      action: {
        primary: {
          background: null,
          foreground: null,
          hover: null,
        },
      },
      status: {
        success: null,
        warning: null,
        error: null,
      },
    },
  },
  (_value, path) => `--ds-${path.join("-")}`
);

export const lightTheme = createGlobalTheme(":root", vars, {
  space: {
    "2xs": "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },
  motion: {
    duration: {
      fast: "100ms",
      normal: "200ms",
      slow: "300ms",
    },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      expressive: "cubic-bezier(0.19, 1, 0.22, 1)",
    },
  },
  typography: {
    family: {
      ui: '"Soehne", "Inter", "Manrope", ui-sans-serif, system-ui, sans-serif',
      code: '"IBM Plex Mono", ui-monospace, monospace',
    },
    size: {
      label: "14px",
      ui: "13px",
      content: "15px",
      title: "16px",
      display: "22px",
    },
  },
  color: {
    background: "#f6f7fb",
    foreground: "#151b24",
    surface: {
      canvas: "#ffffff",
      card: "#ffffff",
      elevated: "#ffffff",
      muted: "#eceff6",
    },
    text: {
      primary: "#151b24",
      muted: "#2d3646",
      inverse: "#ffffff",
    },
    border: {
      default: "#cfd6e4",
      strong: "#2d3646",
    },
    action: {
      primary: {
        background: "#4b72d2",
        foreground: "#ffffff",
        hover: "#3f61ba",
      },
    },
    status: {
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
  },
});
export const explicitLightTheme = createGlobalTheme(':root[data-theme="light"]', vars, {
  space: {
    "2xs": "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },
  motion: {
    duration: {
      fast: "100ms",
      normal: "200ms",
      slow: "300ms",
    },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      expressive: "cubic-bezier(0.19, 1, 0.22, 1)",
    },
  },
  typography: {
    family: {
      ui: '"Soehne", "Inter", "Manrope", ui-sans-serif, system-ui, sans-serif',
      code: '"IBM Plex Mono", ui-monospace, monospace',
    },
    size: {
      label: "14px",
      ui: "13px",
      content: "15px",
      title: "16px",
      display: "22px",
    },
  },
  color: {
    background: "#f6f7fb",
    foreground: "#151b24",
    surface: {
      canvas: "#ffffff",
      card: "#ffffff",
      elevated: "#ffffff",
      muted: "#eceff6",
    },
    text: {
      primary: "#151b24",
      muted: "#2d3646",
      inverse: "#ffffff",
    },
    border: {
      default: "#cfd6e4",
      strong: "#2d3646",
    },
    action: {
      primary: {
        background: "#4b72d2",
        foreground: "#ffffff",
        hover: "#3f61ba",
      },
    },
    status: {
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
  },
});
export const darkTheme = createGlobalTheme(':root[data-theme="dark"]', vars, {
  space: {
    "2xs": "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },
  motion: {
    duration: {
      fast: "100ms",
      normal: "200ms",
      slow: "300ms",
    },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      expressive: "cubic-bezier(0.19, 1, 0.22, 1)",
    },
  },
  typography: {
    family: {
      ui: '"Soehne", "Inter", "Manrope", ui-sans-serif, system-ui, sans-serif',
      code: '"IBM Plex Mono", ui-monospace, monospace',
    },
    size: {
      label: "14px",
      ui: "13px",
      content: "15px",
      title: "16px",
      display: "22px",
    },
  },
  color: {
    background: "#0c1017",
    foreground: "#f6f7fb",
    surface: {
      canvas: "#0c1017",
      card: "#151b24",
      elevated: "#1f2733",
      muted: "#1f2733",
    },
    text: {
      primary: "#f6f7fb",
      muted: "#cfd6e4",
      inverse: "#0c1017",
    },
    border: {
      default: "#1f2733",
      strong: "#cfd6e4",
    },
    action: {
      primary: {
        background: "#4b72d2",
        foreground: "#ffffff",
        hover: "#3f61ba",
      },
    },
    status: {
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
  },
});
export const dimTheme = createGlobalTheme(':root[data-theme="dim"]', vars, {
  space: {
    "2xs": "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },
  motion: {
    duration: {
      fast: "100ms",
      normal: "200ms",
      slow: "300ms",
    },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      expressive: "cubic-bezier(0.19, 1, 0.22, 1)",
    },
  },
  typography: {
    family: {
      ui: '"Soehne", "Inter", "Manrope", ui-sans-serif, system-ui, sans-serif',
      code: '"IBM Plex Mono", ui-monospace, monospace',
    },
    size: {
      label: "14px",
      ui: "13px",
      content: "15px",
      title: "16px",
      display: "22px",
    },
  },
  color: {
    background: "#151b24",
    foreground: "#f6f7fb",
    surface: {
      canvas: "#151b24",
      card: "#1f2733",
      elevated: "#2d3646",
      muted: "#1f2733",
    },
    text: {
      primary: "#f6f7fb",
      muted: "#cfd6e4",
      inverse: "#151b24",
    },
    border: {
      default: "#2d3646",
      strong: "#cfd6e4",
    },
    action: {
      primary: {
        background: "#3f61ba",
        foreground: "#ffffff",
        hover: "#2f4c99",
      },
    },
    status: {
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
  },
});
