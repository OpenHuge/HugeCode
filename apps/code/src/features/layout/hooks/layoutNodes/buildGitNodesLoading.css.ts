import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { semanticColors, spacing, typographyValues } from "@ku0/design-system";

const shimmer = keyframes({
  "0%": {
    opacity: 0.42,
  },
  "50%": {
    opacity: 0.9,
  },
  "100%": {
    opacity: 0.42,
  },
});

export const shell = style({
  display: "grid",
  gap: spacing[3],
  minWidth: 0,
  alignContent: "start",
  padding: "4px 0 0",
  position: "relative",
  selectors: {
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "0 0 auto",
      height: "120px",
      pointerEvents: "none",
      background:
        "radial-gradient(circle at top right, color-mix(in srgb, var(--ds-brand-primary) 12%, transparent), transparent 68%)",
      opacity: 0.9,
    },
  },
});

export const header = style({
  display: "grid",
  gap: spacing[2],
  minWidth: 0,
  padding: "0 2px",
});

export const copy = style({
  display: "grid",
  gap: "4px",
  minWidth: 0,
});

export const eyebrow = style({
  justifySelf: "start",
  display: "inline-flex",
  alignItems: "center",
  minHeight: "22px",
  padding: "0 9px",
  borderRadius: "999px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 62%, transparent)`,
  background: "color-mix(in srgb, var(--ds-surface-card) 82%, transparent)",
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  fontWeight: 650,
  color: semanticColors.mutedForeground,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
});

export const title = style({
  display: "block",
  fontSize: typographyValues.meta.fontSize,
  lineHeight: typographyValues.meta.lineHeight,
  fontWeight: 600,
  color: semanticColors.foreground,
  letterSpacing: "-0.02em",
  overflowWrap: "anywhere",
});

export const subtitle = style({
  display: "block",
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  color: semanticColors.mutedForeground,
  maxWidth: "30ch",
  overflowWrap: "anywhere",
  textWrap: "pretty",
});

export const block = style({
  display: "grid",
  gap: spacing[2],
  padding: "14px 12px 12px",
  borderRadius: "16px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 60%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 84%, transparent), color-mix(in srgb, var(--ds-surface-card) 92%, transparent))",
  boxShadow:
    "0 18px 42px -34px color-mix(in srgb, var(--ds-shadow-color) 42%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
});

export const heroLine = style({
  height: "12px",
  width: "58%",
  borderRadius: "999px",
  background:
    "linear-gradient(90deg, color-mix(in srgb, var(--ds-brand-primary) 22%, transparent), color-mix(in srgb, var(--ds-color-white) 28%, transparent), color-mix(in srgb, var(--ds-brand-primary) 22%, transparent))",
  animation: `${shimmer} 1.6s ease-in-out infinite`,
});

export const line = style({
  height: "9px",
  borderRadius: "999px",
  background:
    "linear-gradient(90deg, color-mix(in srgb, var(--ds-surface-hover) 58%, transparent), color-mix(in srgb, var(--ds-color-white) 34%, transparent), color-mix(in srgb, var(--ds-surface-hover) 58%, transparent))",
  animation: `${shimmer} 1.6s ease-in-out infinite`,
});

export const metaRow = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
});

export const metaPill = style({
  height: "22px",
  width: "64px",
  borderRadius: "999px",
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 42%, transparent)`,
  background:
    "linear-gradient(90deg, color-mix(in srgb, var(--ds-surface-hover) 44%, transparent), color-mix(in srgb, var(--ds-color-white) 24%, transparent), color-mix(in srgb, var(--ds-surface-hover) 44%, transparent))",
  animation: `${shimmer} 1.6s ease-in-out infinite`,
});

export const metaPillWide = style({
  width: "96px",
});

export const lineWidth = styleVariants({
  long: { width: "100%" },
  medium: { width: "74%" },
  short: { width: "46%" },
});

export const rowList = style({
  display: "grid",
  gap: "10px",
});

export const row = style({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
});

export const dot = style({
  flexShrink: 0,
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-brand-primary) 34%, var(--ds-surface-hover))",
  animation: `${shimmer} 1.6s ease-in-out infinite`,
});

export const footer = style({
  display: "grid",
  gap: "8px",
  paddingTop: "2px",
});
