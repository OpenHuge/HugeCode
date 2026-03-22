/*
 * Deprecated runtime semantic theme source.
 * Frozen for compatibility during the design-system runtime migration.
 * Do not import from runtime entrypoints or new code.
 */
import { assignVars, createGlobalTheme, globalStyle } from "@vanilla-extract/css";
import { layers } from "../system/layers.css";
import {
  primitiveColors,
  primitiveLayers,
  primitiveMotion,
  primitiveShape,
  semanticReferenceColors,
  semanticReferenceShadows,
  primitiveSizing,
  primitiveSpacing,
  primitiveTypography,
} from "./primitives";
import { semanticThemeVars } from "./semanticThemeContract.css";

const semanticSizeValues = {
  control: {
    xs: primitiveSizing.controlHeight.xs,
    sm: primitiveSizing.controlHeight.sm,
    md: primitiveSizing.controlHeight.md,
    lg: primitiveSizing.controlHeight.lg,
  },
  icon: {
    xs: primitiveSizing.iconSize.xs,
    sm: primitiveSizing.iconSize.sm,
    md: primitiveSizing.iconSize.md,
    lg: primitiveSizing.iconSize.lg,
    xl: primitiveSizing.iconSize.xl,
  },
  layout: primitiveSizing.layout,
} as const;

const lightThemeValues = {
  color: {
    bg: {
      canvas: primitiveColors.neutral[50],
      app: primitiveColors.neutral[75],
      panel: semanticReferenceColors.light.panel,
      card: primitiveColors.neutral[0],
      elevated: semanticReferenceColors.light.elevated,
      overlay: semanticReferenceColors.light.overlay,
      inset: primitiveColors.neutral[100],
      sidebar: semanticReferenceColors.light.sidebar,
      topbar: semanticReferenceColors.light.topbar,
      composer: semanticReferenceColors.light.composer,
      message: semanticReferenceColors.light.message,
      input: semanticReferenceColors.light.input,
      hover: semanticReferenceColors.light.hover,
      pressed: semanticReferenceColors.light.pressed,
      selected: semanticReferenceColors.light.selected,
    },
    text: {
      primary: primitiveColors.neutral[900],
      secondary: primitiveColors.neutral[700],
      tertiary: primitiveColors.neutral[500],
      muted: primitiveColors.neutral[400],
      inverse: primitiveColors.neutral[0],
      disabled: semanticReferenceColors.light.textDisabled,
      accent: primitiveColors.brand[600],
    },
    border: {
      subtle: semanticReferenceColors.light.borderSubtle,
      default: semanticReferenceColors.light.borderDefault,
      strong: semanticReferenceColors.light.borderStrong,
      focus: semanticReferenceColors.light.borderFocus,
      accent: semanticReferenceColors.light.borderAccent,
    },
    icon: {
      primary: primitiveColors.neutral[700],
      secondary: primitiveColors.neutral[500],
      muted: primitiveColors.neutral[400],
      inverse: primitiveColors.neutral[0],
    },
    control: {
      default: semanticReferenceColors.light.controlDefault,
      hover: semanticReferenceColors.light.controlHover,
      pressed: semanticReferenceColors.light.controlPressed,
      selected: semanticReferenceColors.light.controlSelected,
    },
    state: {
      running: primitiveColors.brand[500],
      queued: primitiveColors.neutral[500],
      thinking: primitiveColors.brand[400],
      streaming: primitiveColors.info[500],
      success: primitiveColors.success[500],
      warning: primitiveColors.warning[500],
      danger: primitiveColors.danger[500],
      info: primitiveColors.info[500],
      cancelled: primitiveColors.neutral[500],
      offline: primitiveColors.neutral[400],
    },
    diff: {
      insertBg: primitiveColors.diff.insertBg,
      insertBorder: semanticReferenceColors.light.diffInsertBorder,
      deleteBg: primitiveColors.diff.deleteBg,
      deleteBorder: semanticReferenceColors.light.diffDeleteBorder,
      modifiedBg: primitiveColors.diff.modifiedBg,
      modifiedBorder: semanticReferenceColors.light.diffModifiedBorder,
      gutter: primitiveColors.diff.gutterLight,
      inlineHighlight: primitiveColors.diff.highlightLight,
    },
    overlay: {
      scrim: semanticReferenceColors.light.scrim,
      glass: semanticReferenceColors.light.glass,
    },
  },
  typography: {
    font: primitiveTypography.fontFamily,
    size: primitiveTypography.size,
    lineHeight: primitiveTypography.lineHeight,
    weight: primitiveTypography.weight,
    role: {
      heading: primitiveTypography.size.x2,
      body: primitiveTypography.size.lg,
      label: primitiveTypography.size.md,
      caption: primitiveTypography.size.sm,
      code: primitiveTypography.size.sm,
      log: primitiveTypography.size.xs,
    },
  },
  space: primitiveSpacing,
  size: semanticSizeValues,
  radius: primitiveShape.radius,
  borderWidth: primitiveShape.borderWidth,
  shadow: primitiveShape.shadow,
  motion: primitiveMotion,
  layer: primitiveLayers,
} as const;

const darkThemeValues = {
  ...lightThemeValues,
  color: {
    ...lightThemeValues.color,
    bg: {
      canvas: primitiveColors.neutral[950],
      app: primitiveColors.neutral[900],
      panel: semanticReferenceColors.dark.panel,
      card: semanticReferenceColors.dark.card,
      elevated: semanticReferenceColors.dark.elevated,
      overlay: semanticReferenceColors.dark.overlay,
      inset: semanticReferenceColors.dark.inset,
      sidebar: semanticReferenceColors.dark.sidebar,
      topbar: semanticReferenceColors.dark.topbar,
      composer: semanticReferenceColors.dark.composer,
      message: semanticReferenceColors.dark.message,
      input: semanticReferenceColors.dark.input,
      hover: semanticReferenceColors.dark.hover,
      pressed: semanticReferenceColors.dark.pressed,
      selected: semanticReferenceColors.dark.selected,
    },
    text: {
      primary: semanticReferenceColors.dark.textPrimary,
      secondary: semanticReferenceColors.dark.textSecondary,
      tertiary: semanticReferenceColors.dark.textTertiary,
      muted: semanticReferenceColors.dark.textMuted,
      inverse: primitiveColors.neutral[950],
      disabled: semanticReferenceColors.dark.textDisabled,
      accent: semanticReferenceColors.dark.textAccent,
    },
    border: {
      subtle: semanticReferenceColors.dark.borderSubtle,
      default: semanticReferenceColors.dark.borderDefault,
      strong: semanticReferenceColors.dark.borderStrong,
      focus: semanticReferenceColors.dark.borderFocus,
      accent: semanticReferenceColors.dark.borderAccent,
    },
    icon: {
      primary: semanticReferenceColors.dark.iconPrimary,
      secondary: semanticReferenceColors.dark.iconSecondary,
      muted: semanticReferenceColors.dark.iconMuted,
      inverse: primitiveColors.neutral[950],
    },
    control: {
      default: semanticReferenceColors.dark.controlDefault,
      hover: semanticReferenceColors.dark.controlHover,
      pressed: semanticReferenceColors.dark.controlPressed,
      selected: semanticReferenceColors.dark.controlSelected,
    },
    state: {
      running: semanticReferenceColors.dark.running,
      queued: semanticReferenceColors.dark.queued,
      thinking: semanticReferenceColors.dark.thinking,
      streaming: semanticReferenceColors.dark.streaming,
      success: semanticReferenceColors.dark.success,
      warning: semanticReferenceColors.dark.warning,
      danger: semanticReferenceColors.dark.danger,
      info: semanticReferenceColors.dark.streaming,
      cancelled: semanticReferenceColors.dark.cancelled,
      offline: semanticReferenceColors.dark.offline,
    },
    diff: {
      insertBg: semanticReferenceColors.dark.diffInsertBg,
      insertBorder: semanticReferenceColors.dark.diffInsertBorder,
      deleteBg: semanticReferenceColors.dark.diffDeleteBg,
      deleteBorder: semanticReferenceColors.dark.diffDeleteBorder,
      modifiedBg: semanticReferenceColors.dark.diffModifiedBg,
      modifiedBorder: semanticReferenceColors.dark.diffModifiedBorder,
      gutter: primitiveColors.diff.gutterDark,
      inlineHighlight: primitiveColors.diff.highlightDark,
    },
    overlay: {
      scrim: semanticReferenceColors.dark.scrim,
      glass: semanticReferenceColors.dark.glass,
    },
  },
  shadow: {
    none: "none",
    xs: semanticReferenceShadows.dark.xs,
    sm: semanticReferenceShadows.dark.sm,
    md: semanticReferenceShadows.dark.md,
    lg: semanticReferenceShadows.dark.lg,
    overlay: semanticReferenceShadows.dark.overlay,
  },
} as const;

const dimThemeValues = {
  ...darkThemeValues,
  color: {
    ...darkThemeValues.color,
    bg: {
      ...darkThemeValues.color.bg,
      app: primitiveColors.neutral[850],
      panel: semanticReferenceColors.dim.panel,
      topbar: semanticReferenceColors.dim.topbar,
      sidebar: semanticReferenceColors.dim.sidebar,
    },
  },
} as const;

createGlobalTheme(":root", semanticThemeVars, darkThemeValues);
createGlobalTheme(':root[data-theme="light"]', semanticThemeVars, lightThemeValues);
createGlobalTheme(':root[data-theme="dark"]', semanticThemeVars, darkThemeValues);
createGlobalTheme(':root[data-theme="dim"]', semanticThemeVars, dimThemeValues);

globalStyle(":root", {
  "@layer": {
    [layers.tokens]: {
      colorScheme: "dark",
    },
  },
});

globalStyle(':root[data-theme="light"]', {
  "@layer": {
    [layers.tokens]: {
      colorScheme: "light",
    },
  },
});

globalStyle("html:root:not([data-theme])", {
  "@layer": {
    [layers.tokens]: {
      "@media": {
        "(prefers-color-scheme: light)": {
          colorScheme: "light",
          vars: assignVars(semanticThemeVars, lightThemeValues),
        },
      },
    },
  },
});

globalStyle(':root[data-contrast="more"]', {
  "@layer": {
    [layers.tokens]: {
      vars: {
        [semanticThemeVars.color.border.subtle]: semanticReferenceColors.contrast.subtle,
        [semanticThemeVars.color.border.default]: semanticReferenceColors.contrast.default,
        [semanticThemeVars.color.border.strong]: semanticReferenceColors.contrast.strong,
        [semanticThemeVars.motion.focus.width]: "3px",
      },
    },
  },
});
