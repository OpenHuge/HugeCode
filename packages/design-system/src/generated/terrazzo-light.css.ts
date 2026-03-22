import { createGlobalTheme, createGlobalThemeContract } from "@vanilla-extract/css";

export const vars = createGlobalThemeContract({
  primitive: {
    color: {
      neutral: {
        "0": "ds-primitive-color-neutral-0",
        "50": "ds-primitive-color-neutral-50",
        "100": "ds-primitive-color-neutral-100",
        "200": "ds-primitive-color-neutral-200",
        "700": "ds-primitive-color-neutral-700",
        "800": "ds-primitive-color-neutral-800",
        "900": "ds-primitive-color-neutral-900",
        "950": "ds-primitive-color-neutral-950",
      },
      blue: {
        "500": "ds-primitive-color-blue-500",
        "600": "ds-primitive-color-blue-600",
        "700": "ds-primitive-color-blue-700",
      },
      green: {
        "500": "ds-primitive-color-green-500",
      },
      amber: {
        "500": "ds-primitive-color-amber-500",
      },
      red: {
        "500": "ds-primitive-color-red-500",
      },
    },
    motion: {
      duration: {
        fast: "ds-primitive-motion-duration-fast",
        normal: "ds-primitive-motion-duration-normal",
        slow: "ds-primitive-motion-duration-slow",
      },
      easing: {
        standard: "ds-primitive-motion-easing-standard",
        expressive: "ds-primitive-motion-easing-expressive",
      },
    },
    radius: {
      sm: "ds-primitive-radius-sm",
      md: "ds-primitive-radius-md",
      lg: "ds-primitive-radius-lg",
      xl: "ds-primitive-radius-xl",
      "2xl": "ds-primitive-radius-2xl",
      full: "ds-primitive-radius-full",
    },
    space: {
      "2xs": "ds-primitive-space-2xs",
      xs: "ds-primitive-space-xs",
      sm: "ds-primitive-space-sm",
      md: "ds-primitive-space-md",
      lg: "ds-primitive-space-lg",
      xl: "ds-primitive-space-xl",
      "2xl": "ds-primitive-space-2xl",
    },
    typography: {
      family: {
        ui: "ds-primitive-typography-family-ui",
        code: "ds-primitive-typography-family-code",
      },
      size: {
        label: "ds-primitive-typography-size-label",
        ui: "ds-primitive-typography-size-ui",
        content: "ds-primitive-typography-size-content",
        title: "ds-primitive-typography-size-title",
        display: "ds-primitive-typography-size-display",
      },
    },
  },
  space: {
    "2xs": "ds-space-2xs",
    xs: "ds-space-xs",
    sm: "ds-space-sm",
    md: "ds-space-md",
    lg: "ds-space-lg",
    xl: "ds-space-xl",
    "2xl": "ds-space-2xl",
  },
  radius: {
    sm: "ds-radius-sm",
    md: "ds-radius-md",
    lg: "ds-radius-lg",
    xl: "ds-radius-xl",
    "2xl": "ds-radius-2xl",
    full: "ds-radius-full",
  },
  motion: {
    duration: {
      fast: "ds-motion-duration-fast",
      normal: "ds-motion-duration-normal",
      slow: "ds-motion-duration-slow",
    },
    easing: {
      standard: "ds-motion-easing-standard",
      expressive: "ds-motion-easing-expressive",
    },
  },
  typography: {
    family: {
      ui: "ds-typography-family-ui",
      code: "ds-typography-family-code",
    },
    size: {
      label: "ds-typography-size-label",
      ui: "ds-typography-size-ui",
      content: "ds-typography-size-content",
      title: "ds-typography-size-title",
      display: "ds-typography-size-display",
    },
  },
  color: {
    background: "ds-color-background",
    foreground: "ds-color-foreground",
    surface: {
      canvas: "ds-color-surface-canvas",
      card: "ds-color-surface-card",
      elevated: "ds-color-surface-elevated",
      muted: "ds-color-surface-muted",
    },
    text: {
      primary: "ds-color-text-primary",
      muted: "ds-color-text-muted",
      inverse: "ds-color-text-inverse",
    },
    border: {
      default: "ds-color-border-default",
      strong: "ds-color-border-strong",
    },
    action: {
      primary: {
        background: "ds-color-action-primary-background",
        foreground: "ds-color-action-primary-foreground",
        hover: "ds-color-action-primary-hover",
      },
    },
    status: {
      success: "ds-color-status-success",
      warning: "ds-color-status-warning",
      error: "ds-color-status-error",
    },
  },
});

export const lightTheme = createGlobalTheme(":root", vars, {
  primitive: {
    color: {
      neutral: {
        "0": "color(srgb 1 1 1)",
        "50": "color(srgb 0.9647058823529412 0.9686274509803922 0.984313725490196)",
        "100": "color(srgb 0.9254901960784314 0.9372549019607843 0.9647058823529412)",
        "200": "color(srgb 0.8117647058823529 0.8392156862745098 0.8941176470588236)",
        "700": "color(srgb 0.17647058823529413 0.21176470588235294 0.27450980392156865)",
        "800": "color(srgb 0.12156862745098039 0.15294117647058825 0.2)",
        "900": "color(srgb 0.08235294117647059 0.10588235294117647 0.1411764705882353)",
        "950": "color(srgb 0.047058823529411764 0.06274509803921569 0.09019607843137255)",
      },
      blue: {
        "500": "color(srgb 0.29411764705882354 0.4470588235294118 0.8235294117647058)",
        "600": "color(srgb 0.24705882352941178 0.3803921568627451 0.7294117647058823)",
        "700": "color(srgb 0.1843137254901961 0.2980392156862745 0.6)",
      },
      green: {
        "500": "color(srgb 0.06274509803921569 0.7254901960784313 0.5058823529411764)",
      },
      amber: {
        "500": "color(srgb 0.9607843137254902 0.6196078431372549 0.043137254901960784)",
      },
      red: {
        "500": "color(srgb 0.9372549019607843 0.26666666666666666 0.26666666666666666)",
      },
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
    radius: {
      sm: "6px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      "2xl": "24px",
      full: "9999px",
    },
    space: {
      "2xs": "2px",
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px",
      "2xl": "32px",
    },
    typography: {
      family: {
        ui: '""Soehne", "Inter", "Manrope", ui-sans-serif, system-ui, sans-serif"',
        code: '""IBM Plex Mono", ui-monospace, monospace"',
      },
      size: {
        label: "14px",
        ui: "13px",
        content: "15px",
        title: "16px",
        display: "22px",
      },
    },
  },
  space: {
    "2xs": vars.primitive.space["2xs"],
    xs: vars.primitive.space.xs,
    sm: vars.primitive.space.sm,
    md: vars.primitive.space.md,
    lg: vars.primitive.space.lg,
    xl: vars.primitive.space.xl,
    "2xl": vars.primitive.space["2xl"],
  },
  radius: {
    sm: vars.primitive.radius.sm,
    md: vars.primitive.radius.md,
    lg: vars.primitive.radius.lg,
    xl: vars.primitive.radius.xl,
    "2xl": vars.primitive.radius["2xl"],
    full: vars.primitive.radius.full,
  },
  motion: {
    duration: {
      fast: vars.primitive.motion.duration.fast,
      normal: vars.primitive.motion.duration.normal,
      slow: vars.primitive.motion.duration.slow,
    },
    easing: {
      standard: vars.primitive.motion.easing.standard,
      expressive: vars.primitive.motion.easing.expressive,
    },
  },
  typography: {
    family: {
      ui: vars.primitive.typography.family.ui,
      code: vars.primitive.typography.family.code,
    },
    size: {
      label: vars.primitive.typography.size.label,
      ui: vars.primitive.typography.size.ui,
      content: vars.primitive.typography.size.content,
      title: vars.primitive.typography.size.title,
      display: vars.primitive.typography.size.display,
    },
  },
  color: {
    background: vars.primitive.color.neutral[50],
    foreground: vars.primitive.color.neutral[900],
    surface: {
      canvas: vars.primitive.color.neutral["0"],
      card: vars.primitive.color.neutral["0"],
      elevated: vars.primitive.color.neutral["0"],
      muted: vars.primitive.color.neutral[100],
    },
    text: {
      primary: vars.primitive.color.neutral[900],
      muted: vars.primitive.color.neutral[700],
      inverse: vars.primitive.color.neutral["0"],
    },
    border: {
      default: vars.primitive.color.neutral[200],
      strong: vars.primitive.color.neutral[700],
    },
    action: {
      primary: {
        background: vars.primitive.color.blue[500],
        foreground: vars.primitive.color.neutral["0"],
        hover: vars.primitive.color.blue[600],
      },
    },
    status: {
      success: vars.primitive.color.green[500],
      warning: vars.primitive.color.amber[500],
      error: vars.primitive.color.red[500],
    },
  },
});
