export const typographyValues = {
  nano: { fontSize: "var(--font-size-nano)", lineHeight: "var(--line-height-nano)" },
  tiny: { fontSize: "var(--font-size-tiny)", lineHeight: "var(--line-height-tiny)" },
  micro: { fontSize: "var(--font-size-micro)", lineHeight: "var(--line-height-micro)" },
  fine: { fontSize: "var(--font-size-fine)", lineHeight: "var(--line-height-fine)" },
  label: { fontSize: "var(--font-size-label)", lineHeight: "var(--line-height-label)" },
  meta: { fontSize: "var(--font-size-meta)", lineHeight: "var(--line-height-meta)" },
  ui: { fontSize: "var(--font-size-ui)", lineHeight: "var(--line-height-ui)" },
  chrome: {
    fontSize: "var(--font-size-chrome)",
    lineHeight: "var(--line-height-chrome)",
    fontWeight: "500",
  },
  chat: { fontSize: "var(--font-size-chat)", lineHeight: "var(--line-height-chat)" },
  content: { fontSize: "var(--font-size-content)", lineHeight: "var(--line-height-content)" },
  title: { fontSize: "var(--font-size-title)", lineHeight: "var(--line-height-title)" },
  titleLg: { fontSize: "var(--font-size-title-lg)", lineHeight: "var(--line-height-title-lg)" },
  displaySm: {
    fontSize: "var(--font-size-display-sm)",
    lineHeight: "var(--line-height-display-sm)",
  },
  display: { fontSize: "var(--font-size-display)", lineHeight: "var(--line-height-display)" },
  displayLg: {
    fontSize: "var(--font-size-display-lg)",
    lineHeight: "var(--line-height-display-lg)",
  },
} as const;

export const motionValues = {
  interactive:
    "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), opacity var(--duration-fast) var(--ease-smooth)",
  enter:
    "opacity var(--duration-normal) var(--ease-smooth), transform var(--duration-normal) var(--ease-smooth)",
  exit: "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
  press: "transform var(--duration-fast) var(--ease-smooth)",
} as const;

export const elevationValues = {
  card: "var(--elevation-card)",
  panel: "var(--elevation-panel)",
  floating: "var(--elevation-floating)",
  overlay: "var(--elevation-overlay)",
  none: "none",
} as const;

export const focusRingValues = {
  button: "var(--focus-ring-button)",
  input: "var(--focus-ring-input)",
  overlay: "var(--focus-ring-overlay)",
} as const;

export const rowValues = {
  listGap: "var(--spacing-2)",
  rowGap: "var(--spacing-3)",
  rowPadding: "var(--spacing-2) 0",
  copyGap: "var(--spacing-1)",
  labelFontSize: "var(--font-size-fine)",
  labelLineHeight: "var(--line-height-fine)",
  labelFontWeight: "500",
  labelLetterSpacing: "0.01em",
  valueFontSize: "var(--font-size-meta)",
  valueLineHeight: "var(--line-height-meta)",
  inlineGap: "var(--spacing-3)",
  inlinePadding: "var(--spacing-2) var(--spacing-3)",
  inlineRadius: "var(--radius-md)",
  descriptionFontSize: "var(--font-size-fine)",
  descriptionLineHeight: "var(--line-height-fine)",
} as const;

export const statusChipValues = {
  minHeight: "1.375rem",
  paddingInline: "var(--spacing-2)",
  radius: "var(--radius-sm)",
  fontSize: "var(--font-size-chrome)",
  lineHeight: "var(--line-height-chrome)",
  optionPadding: "4px 8px",
} as const;

export const overlayValues = {
  scrim: "var(--color-overlay)",
  translucentSurface: "color-mix(in srgb, var(--color-popover) 88%, var(--color-card) 12%)",
  translucentBorderColor:
    "color-mix(in srgb, var(--color-border-subtle, var(--color-border)) 84%, transparent)",
  translucentShadow: "var(--shadow-md)",
  translucentBackdrop: "blur(12px) saturate(1.08)",
  menuSurface: "color-mix(in srgb, var(--color-popover) 90%, var(--color-card) 10%)",
  menuBorder:
    "1px solid color-mix(in srgb, var(--color-border-subtle, var(--color-border)) 84%, transparent)",
  menuShadow: "var(--shadow-md)",
  menuBackdrop: "blur(14px) saturate(1.08)",
} as const;
