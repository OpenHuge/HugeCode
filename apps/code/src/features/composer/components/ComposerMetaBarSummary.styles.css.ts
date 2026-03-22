import { style } from "@vanilla-extract/css";

export const metaShell = style({
  display: "grid",
  gap: "4px",
  width: "100%",
  minWidth: 0,
});

export const metaHeader = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
});

export const metaLead = style({
  display: "grid",
  gap: "3px",
  minWidth: "min(220px, 100%)",
});

export const metaEyebrow = style({
  fontSize: "var(--font-size-micro)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ds-text-faint)",
  fontWeight: 700,
});

export const metaTitle = style({
  color: "var(--ds-text-stronger)",
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  letterSpacing: "-0.01em",
});

export const metaSummary = style({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
});

export const metaBadge = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "22px",
  padding: "0 9px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 86%, transparent)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-micro)",
  whiteSpace: "nowrap",
});

export const metaControls = style({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  flexWrap: "wrap",
  width: "100%",
  minWidth: 0,
});

export const controlCluster = style({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  flexWrap: "wrap",
  minWidth: 0,
});

export const controlClusterGrow = style({
  flex: 1,
});

export const controlClusterTrailing = style({
  marginLeft: "auto",
  "@media": {
    "(max-width: 960px)": {
      marginLeft: 0,
    },
  },
});

export const context = style({
  marginLeft: "2px",
  alignSelf: "stretch",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "28px",
  padding: "0 9px 0 7px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 80%, transparent)",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-muted)",
});

export const contextRing = style({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
  background: "color-mix(in srgb, var(--color-primary) 72%, var(--color-status-success))",
  transition: "background var(--duration-normal) var(--ease-smooth)",
  selectors: {
    "&::after": {
      content: "attr(data-tooltip)",
      position: "absolute",
      right: "0",
      bottom: "calc(100% + 6px)",
      transform: "translateY(4px)",
      padding: "4px 8px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 96%, transparent)",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-micro)",
      whiteSpace: "nowrap",
      opacity: 0,
      pointerEvents: "none",
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
    },
    "&:hover::after": { opacity: 1, transform: "translateY(0)" },
  },
});

export const contextValue = style({
  display: "inline-flex",
  alignItems: "center",
});

export const contextCopy = style({
  display: "grid",
  gap: "1px",
  alignItems: "center",
  minWidth: "0",
});

export const contextLabel = style({
  fontSize: "var(--font-size-tiny)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--ds-text-faint)",
});

export const contextTokens = style({
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-micro)",
  fontFamily: "var(--code-font-family)",
  letterSpacing: "0",
  whiteSpace: "nowrap",
});
