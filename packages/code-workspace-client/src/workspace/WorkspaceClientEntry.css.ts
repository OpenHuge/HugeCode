import { style } from "@vanilla-extract/css";

export const bootShell = style({
  alignItems: "center",
  background: "var(--color-background)",
  color: "var(--color-fg-primary)",
  display: "flex",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: "40px 24px",
});

export const bootCard = style({
  backdropFilter: "blur(14px)",
  background: "color-mix(in srgb, var(--color-surface-elevated) 92%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 88%, transparent)",
  borderRadius: "28px",
  boxShadow: "var(--shadow-glass-panel)",
  display: "grid",
  gap: "10px",
  maxWidth: "520px",
  padding: "28px",
  width: "100%",
});

export const bootEyebrow = style({
  color: "var(--color-fg-tertiary)",
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
});

export const bootTitle = style({
  fontSize: "var(--font-size-display-sm)",
  fontWeight: 600,
  letterSpacing: "-0.025em",
});

export const bootDetail = style({
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-content)",
  lineHeight: "var(--line-height-content)",
});

export const unavailableShell = style({
  alignItems: "center",
  background: "var(--color-background)",
  color: "var(--color-fg-primary)",
  display: "flex",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: "40px 24px",
});

export const unavailablePanel = style({
  display: "grid",
  gap: "24px",
  maxWidth: "980px",
  width: "100%",
});

export const unavailableHero = style({
  backdropFilter: "blur(18px)",
  background: "color-mix(in srgb, var(--color-surface-elevated) 92%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 88%, transparent)",
  borderRadius: "32px",
  boxShadow: "var(--shadow-glass-elevated)",
  display: "grid",
  gap: "18px",
  padding: "32px",
});

export const unavailableKicker = style({
  color: "var(--color-primary)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
});

export const unavailableTitle = style({
  fontSize: "clamp(2rem, 5vw, 3.6rem)",
  fontWeight: 650,
  letterSpacing: "-0.04em",
  lineHeight: "var(--line-height-display-lg)",
  margin: 0,
  maxWidth: "12ch",
});

export const unavailableBody = style({
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-title)",
  lineHeight: "var(--line-height-content)",
  margin: 0,
  maxWidth: "66ch",
});

export const unavailableInlineCode = style({
  background: "color-mix(in srgb, var(--color-surface-1) 92%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 76%, transparent)",
  borderRadius: "10px",
  color: "var(--color-fg-primary)",
  display: "inline-flex",
  fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, monospace',
  padding: "0.18rem 0.48rem",
});

export const unavailableActions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
});

export const unavailableProbePanel = style({
  display: "grid",
  gap: "14px",
});

export const unavailableProbeStatus = style({
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-content)",
  lineHeight: "var(--line-height-content)",
  margin: 0,
});

export const unavailableProbeList = style({
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
});

export const unavailableProbeButton = style({
  alignItems: "flex-start",
  background: "color-mix(in srgb, var(--color-surface-1) 94%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 84%, transparent)",
  borderRadius: "18px",
  color: "var(--color-fg-primary)",
  cursor: "pointer",
  display: "grid",
  gap: "4px",
  minHeight: "72px",
  padding: "16px",
  textAlign: "left",
  width: "100%",
  ":disabled": {
    cursor: "progress",
    opacity: 0.7,
  },
});

export const unavailableProbeButtonTitle = style({
  fontSize: "var(--font-size-title)",
  fontWeight: 600,
  letterSpacing: "-0.02em",
});

export const unavailableProbeButtonDetail = style({
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-content)",
});

export const unavailableActionPrimary = style({
  alignItems: "center",
  background: "var(--color-primary)",
  border: "1px solid color-mix(in srgb, var(--color-primary) 84%, black)",
  borderRadius: "999px",
  color: "var(--color-primary-foreground)",
  display: "inline-flex",
  fontSize: "var(--font-size-content)",
  fontWeight: 600,
  gap: "8px",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 18px",
  textDecoration: "none",
});

export const unavailableActionSecondary = style({
  alignItems: "center",
  background: "color-mix(in srgb, var(--color-surface-1) 94%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 84%, transparent)",
  borderRadius: "999px",
  color: "var(--color-fg-primary)",
  display: "inline-flex",
  fontSize: "var(--font-size-content)",
  fontWeight: 600,
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 18px",
  textDecoration: "none",
});

export const unavailableDetails = style({
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
});

export const unavailableDetailCard = style({
  background: "color-mix(in srgb, var(--color-surface-1) 94%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 82%, transparent)",
  borderRadius: "24px",
  display: "grid",
  gap: "10px",
  minHeight: "168px",
  padding: "22px",
});

export const unavailableDetailLabel = style({
  color: "var(--color-fg-tertiary)",
  fontSize: "var(--font-size-meta)",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

export const unavailableDetailTitle = style({
  fontSize: "var(--font-size-title)",
  fontWeight: 600,
  letterSpacing: "-0.02em",
});

export const unavailableDetailBody = style({
  color: "var(--color-fg-secondary)",
  fontSize: "var(--font-size-content)",
  lineHeight: "var(--line-height-content)",
});
