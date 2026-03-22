import { typographyValues } from "@ku0/design-system";
import { keyframes, style } from "@vanilla-extract/css";

const bootGlow = keyframes({
  "0%": { opacity: "0.92" },
  "100%": { opacity: "1" },
});

export const bootShell = style({
  minHeight: "var(--app-height, 100dvh)",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-topbar) 84%, var(--ds-brand-background)), var(--ds-brand-background))",
  color: "var(--ds-text-primary)",
  fontFamily: "var(--ui-font-family)",
});

export const bootCard = style({
  width: "min(520px, 100%)",
  display: "grid",
  gap: "10px",
  padding: "28px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 92%, transparent)",
  borderRadius: "22px",
  background: "color-mix(in srgb, var(--ds-surface-card-strong) 92%, var(--ds-brand-background))",
  boxShadow:
    "var(--ds-shadow-lg), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent)",
  animation: `${bootGlow} 1.6s ease-in-out infinite alternate`,
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
});

export const bootEyebrow = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

export const bootTitle = style({
  fontSize: typographyValues.displaySm.fontSize,
  lineHeight: typographyValues.displaySm.lineHeight,
  fontWeight: "600",
  color: "var(--ds-text-strong)",
});

export const bootDetail = style({
  fontSize: typographyValues.label.fontSize,
  lineHeight: typographyValues.label.lineHeight,
  color: "var(--ds-text-muted)",
  maxWidth: "40ch",
});
