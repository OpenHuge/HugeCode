/**
 * Design System Tokens
 *
 * Semantic design tokens for consistent styling across the application.
 * These are TypeScript-first tokens that can be used in components and styles.
 */

// =============================================================================
// Spacing Scale (based on 4px grid)
// =============================================================================
export const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  9: "2.25rem", // 36px
  10: "2.5rem", // 40px
  11: "2.75rem", // 44px
  12: "3rem", // 48px
  14: "3.5rem", // 56px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
  28: "7rem", // 112px
  32: "8rem", // 128px
  36: "9rem", // 144px
  40: "10rem", // 160px
  44: "11rem", // 176px
  48: "12rem", // 192px
  52: "13rem", // 208px
  56: "14rem", // 224px
  60: "15rem", // 240px
  64: "16rem", // 256px
  72: "18rem", // 288px
  80: "20rem", // 320px
  96: "24rem", // 384px
} as const;

// =============================================================================
// Typography Scale
// =============================================================================
export const fontSize = {
  nano: ["var(--font-size-nano)", { lineHeight: "var(--line-height-nano)" }],
  tiny: ["var(--font-size-tiny)", { lineHeight: "var(--line-height-tiny)" }],
  micro: ["var(--font-size-micro)", { lineHeight: "var(--line-height-micro)" }],
  fine: ["var(--font-size-fine)", { lineHeight: "var(--line-height-fine)" }],
  label: ["var(--font-size-label)", { lineHeight: "var(--line-height-label)" }],
  meta: ["var(--font-size-meta)", { lineHeight: "var(--line-height-meta)" }],
  ui: ["var(--font-size-ui)", { lineHeight: "var(--line-height-ui)" }],
  chrome: ["var(--font-size-chrome)", { lineHeight: "var(--line-height-chrome)" }],
  chat: ["var(--font-size-chat)", { lineHeight: "var(--line-height-chat)" }],
  content: ["var(--font-size-content)", { lineHeight: "var(--line-height-content)" }],
  title: ["var(--font-size-title)", { lineHeight: "var(--line-height-title)" }],
  titleLg: ["var(--font-size-title-lg)", { lineHeight: "var(--line-height-title-lg)" }],
  displaySm: ["var(--font-size-display-sm)", { lineHeight: "var(--line-height-display-sm)" }],
  display: ["var(--font-size-display)", { lineHeight: "var(--line-height-display)" }],
  displayLg: ["var(--font-size-display-lg)", { lineHeight: "var(--line-height-display-lg)" }],
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

// =============================================================================
// Border Radius
// =============================================================================
export const borderRadius = {
  none: "0",
  sm: "var(--radius-sm)",
  DEFAULT: "var(--radius)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  "3xl": "var(--radius-3xl)",
  full: "9999px",
} as const;

// =============================================================================
// Shadows
// =============================================================================
export const boxShadow = {
  xs: "var(--shadow-xs)",
  sm: "var(--shadow-sm)",
  DEFAULT: "var(--shadow-md)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
  inner: "var(--shadow-inner)",
  soft: "var(--shadow-soft)",
  none: "none",
} as const;

// =============================================================================
// Transition Durations
// =============================================================================
export const transitionDuration = {
  fast: "var(--duration-fast)",
  normal: "var(--duration-normal)",
  DEFAULT: "var(--duration-normal)",
  slow: "var(--duration-slow)",
} as const;

// =============================================================================
// Z-Index Scale
// =============================================================================
export const zIndex = {
  0: "0",
  10: "10",
  20: "20",
  30: "30",
  40: "40",
  50: "50",
  60: "60",
  "layer-base": "0",
  "layer-canvas": "10",
  "layer-overlay": "50",
  overlay: "100",
  modal: "200",
  popover: "300",
  tooltip: "400",
  toast: "500",
  drag: "600",
} as const;

// =============================================================================
// Component Size Presets
// =============================================================================
export const componentSizes = {
  button: {
    xs: { minHeight: "1.5rem", paddingInline: "0.5rem", fontSize: "0.75rem" },
    sm: { minHeight: "2rem", paddingInline: "0.75rem", fontSize: "0.75rem" },
    md: { minHeight: "2.25rem", paddingInline: "1rem", fontSize: "0.875rem" },
    lg: { minHeight: "2.75rem", paddingInline: "1.5rem", fontSize: "1rem" },
  },
  input: {
    sm: { minHeight: "2rem", fontSize: "0.75rem" },
    md: { minHeight: "2.25rem", fontSize: "0.875rem" },
    lg: { minHeight: "2.75rem", fontSize: "1rem" },
  },
  icon: {
    xs: { size: "0.75rem" },
    sm: { size: "1rem" },
    md: { size: "1.25rem" },
    lg: { size: "1.5rem" },
  },
} as const;

// =============================================================================
// Shell Layout Tokens
// =============================================================================
export const shellLayout = {
  sidebarSectionGap: "1.25rem",
  headerControlSize: "1.75rem",
  composerMaxWidth: "46rem",
  composerPaddingX: "1rem",
  composerPaddingBottom: "1.25rem",
  composerContentMaxWidth:
    "calc(var(--shell-composer-max-width) - (var(--shell-composer-padding-x) * 2))",
  composerTextareaMinHeight: "2.5rem",
  composerTextareaPaddingY: "0.625rem",
} as const;

// =============================================================================
// Semantic Color Aliases (for documentation / reference)
// Actual colors are defined in CSS custom properties exposed by the theme layer.
// =============================================================================
export const semanticColors = {
  // Core
  background: "var(--color-background)",
  foreground: "var(--color-foreground)",
  card: "var(--color-card)",
  cardForeground: "var(--color-card-foreground)",
  popover: "var(--color-popover)",
  popoverForeground: "var(--color-popover-foreground)",

  // Brand + emphasis
  primary: "var(--color-primary)",
  primaryForeground: "var(--color-primary-foreground)",
  secondary: "var(--color-secondary)",
  secondaryForeground: "var(--color-secondary-foreground)",
  accent: "var(--color-accent)",
  accentForeground: "var(--color-accent-foreground)",

  // Semantic status
  success: "var(--color-success)",
  successForeground: "var(--color-success-foreground)",
  warning: "var(--color-warning)",
  warningForeground: "var(--color-warning-foreground)",
  info: "var(--color-info)",
  infoForeground: "var(--color-info-foreground)",
  error: "var(--color-error)",
  errorForeground: "var(--color-error-foreground)",
  destructive: "var(--color-destructive)",
  destructiveForeground: "var(--color-destructive-foreground)",
  muted: "var(--color-muted)",
  mutedForeground: "var(--color-muted-foreground)",

  // Surfaces
  surface0: "var(--color-surface-0)",
  surface1: "var(--color-surface-1)",
  surface2: "var(--color-surface-2)",
  surface3: "var(--color-surface-3)",
  surfaceElevated: "var(--color-surface-elevated)",

  // Borders
  border: "var(--color-border)",
  input: "var(--color-input)",
  ring: "var(--color-ring)",

  // Accent palette
  accentAmber: "var(--color-accent-amber)",
  accentEmerald: "var(--color-accent-emerald)",
  accentViolet: "var(--color-accent-violet)",
  accentIndigo: "var(--color-accent-indigo)",
  accentCyan: "var(--color-accent-cyan)",
  accentRose: "var(--color-accent-rose)",
  accentAi: "var(--color-accent-ai)",
  accentAiStrong: "var(--color-accent-ai-strong)",
  accentAiSheen: "var(--color-accent-ai-sheen)",

  // Highlights
  highlightYellow: "var(--color-highlight-yellow)",
  highlightGreen: "var(--color-highlight-green)",
  highlightRed: "var(--color-highlight-red)",
  highlightPurple: "var(--color-highlight-purple)",

  // Canvas tones
  canvasWarm: "var(--color-canvas-warm)",
  canvasMint: "var(--color-canvas-mint)",
  canvasSepia: "var(--color-canvas-sepia)",
  canvasDark: "var(--color-canvas-dark)",

  // Ambient gradients
  ambientPaper: "var(--color-ambient-paper)",
  ambientEmerald: "var(--color-ambient-emerald)",
  ambientBlue: "var(--color-ambient-blue)",

  // Presence
  presence1: "var(--color-presence-1)",
  presence2: "var(--color-presence-2)",
  presence3: "var(--color-presence-3)",
  presence4: "var(--color-presence-4)",
  presence5: "var(--color-presence-5)",
  presence6: "var(--color-presence-6)",
  presence7: "var(--color-presence-7)",
  presence8: "var(--color-presence-8)",
  presence9: "var(--color-presence-9)",
} as const;

// =============================================================================
// Type Exports
// =============================================================================
export type Spacing = keyof typeof spacing;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
export type BorderRadius = keyof typeof borderRadius;
export type BoxShadow = keyof typeof boxShadow;
export type ZIndex = keyof typeof zIndex;
