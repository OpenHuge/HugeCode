export const tokenPaths = {
  space: {
    "2xs": "space.2xs",
    xs: "space.xs",
    sm: "space.sm",
    md: "space.md",
    lg: "space.lg",
    xl: "space.xl",
    "2xl": "space.2xl",
  },
  radius: {
    sm: "radius.sm",
    md: "radius.md",
    lg: "radius.lg",
    xl: "radius.xl",
    "2xl": "radius.2xl",
    full: "radius.full",
  },
  motion: {
    duration: {
      fast: "motion.duration.fast",
      normal: "motion.duration.normal",
      slow: "motion.duration.slow",
    },
    easing: {
      standard: "motion.easing.standard",
      expressive: "motion.easing.expressive",
    },
  },
  typography: {
    family: {
      ui: "typography.family.ui",
      code: "typography.family.code",
    },
    size: {
      label: "typography.size.label",
      ui: "typography.size.ui",
      content: "typography.size.content",
      title: "typography.size.title",
      display: "typography.size.display",
    },
  },
  color: {
    background: "color.background",
    foreground: "color.foreground",
    surface: {
      canvas: "color.surface.canvas",
      card: "color.surface.card",
      elevated: "color.surface.elevated",
      muted: "color.surface.muted",
    },
    text: {
      primary: "color.text.primary",
      muted: "color.text.muted",
      inverse: "color.text.inverse",
    },
    border: {
      default: "color.border.default",
      strong: "color.border.strong",
    },
    action: {
      primary: {
        background: "color.action.primary.background",
        foreground: "color.action.primary.foreground",
        hover: "color.action.primary.hover",
      },
    },
    status: {
      success: "color.status.success",
      warning: "color.status.warning",
      error: "color.status.error",
    },
  },
} as const;

export const tokenCssVars = {
  space: {
    "2xs": "--ds-space-2xs",
    xs: "--ds-space-xs",
    sm: "--ds-space-sm",
    md: "--ds-space-md",
    lg: "--ds-space-lg",
    xl: "--ds-space-xl",
    "2xl": "--ds-space-2xl",
  },
  radius: {
    sm: "--ds-radius-sm",
    md: "--ds-radius-md",
    lg: "--ds-radius-lg",
    xl: "--ds-radius-xl",
    "2xl": "--ds-radius-2xl",
    full: "--ds-radius-full",
  },
  motion: {
    duration: {
      fast: "--ds-motion-duration-fast",
      normal: "--ds-motion-duration-normal",
      slow: "--ds-motion-duration-slow",
    },
    easing: {
      standard: "--ds-motion-easing-standard",
      expressive: "--ds-motion-easing-expressive",
    },
  },
  typography: {
    family: {
      ui: "--ds-typography-family-ui",
      code: "--ds-typography-family-code",
    },
    size: {
      label: "--ds-typography-size-label",
      ui: "--ds-typography-size-ui",
      content: "--ds-typography-size-content",
      title: "--ds-typography-size-title",
      display: "--ds-typography-size-display",
    },
  },
  color: {
    background: "--ds-color-background",
    foreground: "--ds-color-foreground",
    surface: {
      canvas: "--ds-color-surface-canvas",
      card: "--ds-color-surface-card",
      elevated: "--ds-color-surface-elevated",
      muted: "--ds-color-surface-muted",
    },
    text: {
      primary: "--ds-color-text-primary",
      muted: "--ds-color-text-muted",
      inverse: "--ds-color-text-inverse",
    },
    border: {
      default: "--ds-color-border-default",
      strong: "--ds-color-border-strong",
    },
    action: {
      primary: {
        background: "--ds-color-action-primary-background",
        foreground: "--ds-color-action-primary-foreground",
        hover: "--ds-color-action-primary-hover",
      },
    },
    status: {
      success: "--ds-color-status-success",
      warning: "--ds-color-status-warning",
      error: "--ds-color-status-error",
    },
  },
} as const;

export const flatTokenPaths = [
  "color.action.primary.background",
  "color.action.primary.foreground",
  "color.action.primary.hover",
  "color.background",
  "color.border.default",
  "color.border.strong",
  "color.foreground",
  "color.status.error",
  "color.status.success",
  "color.status.warning",
  "color.surface.canvas",
  "color.surface.card",
  "color.surface.elevated",
  "color.surface.muted",
  "color.text.inverse",
  "color.text.muted",
  "color.text.primary",
  "motion.duration.fast",
  "motion.duration.normal",
  "motion.duration.slow",
  "motion.easing.expressive",
  "motion.easing.standard",
  "radius.2xl",
  "radius.full",
  "radius.lg",
  "radius.md",
  "radius.sm",
  "radius.xl",
  "space.2xl",
  "space.2xs",
  "space.lg",
  "space.md",
  "space.sm",
  "space.xl",
  "space.xs",
  "typography.family.code",
  "typography.family.ui",
  "typography.size.content",
  "typography.size.display",
  "typography.size.label",
  "typography.size.title",
  "typography.size.ui",
] as const;

export type TokenPath = (typeof flatTokenPaths)[number];
