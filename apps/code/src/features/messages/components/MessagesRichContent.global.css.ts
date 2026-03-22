import { globalKeyframes, type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
const feature = (selector: string, rule: GlobalStyleRule) =>
  globalStyle(selector, { "@layer": { [layers.features]: rule } } as unknown as GlobalStyleRule);
const flatSurfaceBorder = "1px solid color-mix(in srgb, var(--ds-border-subtle) 48%, transparent)";
const flatSurfaceBackground = "color-mix(in srgb, var(--ds-surface-card-base) 96%, transparent)";
const flatInsetBackground = "color-mix(in srgb, var(--ds-surface-muted) 58%, transparent)";
const flatCommandBackground =
  "color-mix(in srgb, var(--ds-surface-command) 84%, var(--ds-surface-card-base))";
const flatChipBorder = "1px solid color-mix(in srgb, var(--ds-border-subtle) 46%, transparent)";
const flatChipBackground = "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)";

globalKeyframes("messages-working-pulse", {
  "0%": {
    transform: "scale(0.92)",
    opacity: 0.68,
  },
  "70%": {
    transform: "scale(1)",
    opacity: 0.96,
  },
  "100%": {
    transform: "scale(0.94)",
    opacity: 0.78,
  },
});

globalKeyframes("messages-working-shimmer", {
  "0%": { transform: "translateX(-140%) skewX(-18deg)", opacity: 0 },
  "14%": { opacity: 0 },
  "38%": { opacity: 0.72 },
  "62%": { opacity: 0.18 },
  "100%": { transform: "translateX(180%) skewX(-18deg)", opacity: 0 },
});
feature(".tool-inline", {
  border: flatSurfaceBorder,
  borderRadius: "12px",
  background: flatSurfaceBackground,
  padding: "8px 10px",
  margin: "0 0 8px",
  display: "flex",
  position: "relative",
  minWidth: "0",
  width: "100%",
  maxWidth: "100%",
  boxShadow: "none",
});
feature(".command-inline", {
  flexDirection: "column",
  gap: "8px",
  padding: "10px",
  background: "color-mix(in srgb, var(--ds-surface-command) 12%, var(--ds-surface-card-base))",
});
feature(".item-card", {
  border: flatSurfaceBorder,
  borderRadius: "12px",
  background: flatSurfaceBackground,
  padding: "9px 10px",
  margin: "2px 0 8px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: "0",
  boxShadow: "none",
});
feature('[data-right-panel-selected="true"]', {
  borderColor: "color-mix(in srgb, var(--ds-panel-border) 88%, transparent)",
});
feature('.message [data-right-panel-selected="true"]', {
  background: "color-mix(in srgb, var(--ds-panel-row-selected) 82%, transparent)",
});
feature('.tool-inline[data-right-panel-selected="true"]', {
  background: "color-mix(in srgb, var(--ds-panel-row-selected) 84%, var(--ds-surface-card-base))",
});
feature('.item-card[data-right-panel-selected="true"]', {
  background: "color-mix(in srgb, var(--ds-panel-row-selected) 84%, var(--ds-surface-card-base))",
});
feature(".review", {
  background: "color-mix(in srgb, var(--status-success) 4%, var(--ds-surface-card-base))",
});
feature(".diff", {
  background: "color-mix(in srgb, var(--ds-brand-primary) 5%, var(--ds-surface-card-base))",
});
feature(".timeline-card-header", {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
});
feature(".timeline-card-lead", {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  minWidth: "0",
  flex: "1 1 auto",
});
feature(".timeline-card-icon", {
  width: "15px",
  height: "15px",
  flex: "0 0 auto",
  marginTop: "2px",
  color: "var(--ds-text-subtle)",
});
feature(".timeline-card-title-stack", {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: "0",
  flex: "1 1 auto",
});
feature(".timeline-card-title", {
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-fine)",
  fontWeight: "650",
  lineHeight: "var(--line-height-135)",
});
feature(".timeline-card-meta", {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px",
  minWidth: "0",
});
feature(".timeline-card-chip", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "20px",
  padding: "1px 7px",
  borderRadius: "999px",
  border: flatChipBorder,
  background: flatChipBackground,
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-micro)",
  fontWeight: "560",
  whiteSpace: "nowrap",
});
feature(".timeline-card-chip-emphasis", {
  background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
  color: "var(--ds-text-strong)",
});
feature(".review-header", {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
});
feature(".review-title", {
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
});
feature(".review-badge", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});
feature(".review-badge.active", {
  background: "color-mix(in srgb, var(--status-warning) 10%, var(--ds-surface-control))",
});
feature(".review-badge.done", {
  background: "color-mix(in srgb, var(--status-success) 10%, var(--ds-surface-control))",
});
feature(".diff-title", {
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
});
feature(".item-status", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "22px",
  padding: "2px 8px",
  borderRadius: "999px",
  border: flatChipBorder,
  background: flatChipBackground,
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-fine)",
  fontWeight: "560",
  whiteSpace: "nowrap",
  textTransform: "capitalize",
});
feature(".item-status.active", {
  borderColor: "color-mix(in srgb, var(--status-warning) 22%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-warning) 9%, transparent)",
});
feature(".item-status.done", {
  borderColor: "color-mix(in srgb, var(--status-success) 22%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-success) 8%, transparent)",
});
feature(".item-text", {
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-160)",
  color: "var(--ds-text-strong)",
});
feature(".message-body", {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  minWidth: "0",
});
feature(".message-copy-button, .message-edit-button", {
  minWidth: "30px",
  minHeight: "30px",
  padding: "0 8px",
  borderRadius: "999px",
  border: flatChipBorder,
  background: flatChipBackground,
  color: "var(--ds-text-subtle)",
  boxShadow: "none",
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
});
feature(".message-copy-button:hover, .message-edit-button:hover", {
  background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-card-base))",
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  color: "var(--ds-text-strong)",
});
feature(".message-copy-button:focus-visible, .message-edit-button:focus-visible", {
  outline: "none",
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 52%, transparent)",
  background: "color-mix(in srgb, var(--ds-brand-primary) 8%, transparent)",
});
feature('.message-copy-button[data-copy-state="copied"]', {
  borderColor: "color-mix(in srgb, var(--status-success) 26%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-success) 10%, transparent)",
  color: "color-mix(in srgb, var(--status-success) 62%, var(--ds-text-strong))",
});
feature(".message-copy-icon, .message-edit-icon", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});
feature(".working", {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "min(100%, var(--messages-content-max-width, 100%))",
  margin: "6px 0 4px",
  padding: "12px 4px 2px",
  borderTop: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
});
feature(".working-spinner", {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  flex: "0 0 auto",
  border: "1px solid color-mix(in srgb, var(--ds-brand-primary) 20%, transparent)",
  background: "color-mix(in srgb, var(--ds-brand-primary) 68%, var(--ds-surface-control))",
  animation: "messages-working-pulse 2.2s ease-out infinite",
});
feature(".working-body", {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: "4px",
  minWidth: "0",
  flex: "1 1 auto",
});
feature(".working-header", {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px 8px",
  minWidth: "0",
});
feature(".working-status", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-brand-primary) 10%, var(--ds-surface-control))",
  color: "color-mix(in srgb, var(--ds-text-strong) 78%, var(--ds-brand-primary))",
  fontSize: "var(--font-size-micro)",
  fontWeight: "650",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  flex: "0 0 auto",
});
feature(".working-status::after", {
  content: "none",
});
feature(".working-label", {
  minWidth: "0",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: "1",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "620",
  lineHeight: "var(--line-height-140)",
  letterSpacing: "-0.01em",
});
feature(".working-meta", {
  maxWidth: "min(100%, 620px)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: "1",
  color: "var(--ds-text-faint)",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-145)",
});
feature(".working-timer", {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "unset",
});
feature(".working-timer-clock", {
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-fine)",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.02em",
});

feature(".turn-complete", {
  display: "grid",
  width: "min(100%, var(--messages-content-max-width, 100%))",
  margin: "8px 0 2px",
  padding: "10px 12px",
  gap: "10px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 42%, transparent)",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 92%, var(--ds-surface-control))",
  color: "var(--ds-text-faint)",
  boxShadow: "none",
});
feature('.turn-complete[data-current-turn-indicator-state="tool-only"]', {
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 20%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--ds-brand-primary) 6%, var(--ds-surface-card-base))",
  color: "color-mix(in srgb, var(--ds-text-faint) 86%, var(--ds-brand-primary))",
});
feature('.turn-complete[data-current-turn-indicator-state="warning"]', {
  borderColor: "color-mix(in srgb, var(--status-warning) 20%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-warning) 7%, var(--ds-surface-card-base))",
  color: "color-mix(in srgb, var(--ds-text-faint) 84%, var(--status-warning))",
});
feature(".turn-complete-line", {
  display: "none",
});
feature(".turn-complete-status", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "24px",
  padding: "3px 9px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--status-success) 18%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-success) 10%, var(--ds-surface-control))",
  color: "color-mix(in srgb, var(--ds-text-subtle) 74%, var(--status-success))",
  fontSize: "var(--font-size-fine)",
  fontWeight: "560",
  letterSpacing: "-0.01em",
  textTransform: "uppercase",
  flex: "0 0 auto",
});
feature('.turn-complete[data-current-turn-indicator-state="tool-only"] .turn-complete-status', {
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 18%, var(--ds-border-subtle))",
  color: "color-mix(in srgb, var(--ds-text-subtle) 74%, var(--ds-brand-primary))",
});
feature('.turn-complete[data-current-turn-indicator-state="warning"] .turn-complete-status', {
  borderColor: "color-mix(in srgb, var(--status-warning) 18%, var(--ds-border-subtle))",
  color: "color-mix(in srgb, var(--ds-text-subtle) 72%, var(--status-warning))",
});
feature(".turn-complete-summary", {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
});
feature(".turn-complete-toggle", {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
  alignItems: "center",
  gap: "8px 12px",
  width: "100%",
  padding: "0",
  border: 0,
  background: "transparent",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
});
feature(".turn-complete-toggle:disabled", {
  cursor: "default",
});
feature(".turn-complete-toggle:focus-visible", {
  outline: "2px solid color-mix(in srgb, var(--color-primary) 42%, transparent)",
  outlineOffset: "4px",
  borderRadius: "10px",
});
feature(".turn-complete-summary-text", {
  minWidth: "0",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-145)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
feature(".turn-complete-meta", {
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-fine)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});
feature(".turn-complete-chevron", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ds-text-subtle)",
});
feature(".turn-complete-details", {
  display: "grid",
  gap: "10px",
  padding: "10px 0 0",
  borderTop: "1px solid color-mix(in srgb, var(--ds-border-subtle) 42%, transparent)",
});
feature(".turn-complete-detail-block", {
  display: "grid",
  gap: "6px",
});
feature(".turn-complete-detail-label", {
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-micro)",
  fontWeight: "650",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
});
feature(".turn-complete-detail-value", {
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-150)",
  textWrap: "pretty",
});
feature(".turn-complete-chip", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "24px",
  padding: "3px 9px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 42%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 66%, transparent)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  fontWeight: "550",
  letterSpacing: "-0.01em",
});
feature(".turn-complete-actions", {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px",
});
feature(".turn-complete-action", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "24px",
  padding: "3px 9px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 42%, transparent)",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-surface-control) 66%, transparent)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  fontWeight: "550",
  letterSpacing: "-0.01em",
  pointerEvents: "auto",
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
});
feature(".turn-complete-action:hover", {
  background: "color-mix(in srgb, var(--ds-surface-control) 82%, transparent)",
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
  color: "var(--ds-text-subtle)",
});
feature(".turn-complete-action:focus-visible", {
  outline: "2px solid color-mix(in srgb, var(--color-primary) 58%, transparent)",
  outlineOffset: "2px",
});
feature(".turn-complete-label", {
  marginLeft: "auto",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "normal",
  textAlign: "right",
});
feature(".turn-complete", {
  "@media": {
    "(max-width: 720px)": {
      padding: "10px",
      gap: "8px",
    },
  },
});
feature(".turn-complete-toggle", {
  "@media": {
    "(max-width: 720px)": {
      gridTemplateColumns: "auto minmax(0, 1fr) auto",
      alignItems: "start",
    },
  },
});
feature(".turn-complete-meta", {
  "@media": {
    "(max-width: 720px)": {
      gridColumn: "2 / 4",
      whiteSpace: "normal",
    },
  },
});
feature(".turn-complete-line", {
  "@media": {
    "(max-width: 720px)": {
      minWidth: "0",
      flex: "1 1 100%",
      order: "5",
    },
  },
});
feature(".turn-complete-label", {
  "@media": {
    "(max-width: 720px)": {
      width: "100%",
      marginLeft: "0",
      textAlign: "left",
    },
  },
});
feature(".tool-inline::before", {
  content: "none",
});
feature(".command-inline .tool-inline-bar-toggle", {
  left: "4px",
  right: "4px",
  width: "auto",
  height: "12px",
  top: "2px",
  bottom: "auto",
});
feature('.tool-inline[data-tone="processing"]', {
  background: "color-mix(in srgb, var(--status-warning) 4%, var(--ds-surface-card-base))",
});
feature('.tool-inline[data-tone="completed"]', {
  background: "color-mix(in srgb, var(--status-success) 4%, var(--ds-surface-card-base))",
});
feature('.tool-inline[data-tone="failed"]', {
  background: "color-mix(in srgb, var(--status-error) 4%, var(--ds-surface-card-base))",
});
feature('.command-inline[data-tone="processing"]', {
  background: "color-mix(in srgb, var(--status-warning) 5%, var(--ds-surface-command))",
});
feature('.command-inline[data-tone="completed"]', {
  background: "color-mix(in srgb, var(--status-success) 5%, var(--ds-surface-command))",
});
feature('.command-inline[data-tone="failed"]', {
  background: "color-mix(in srgb, var(--status-error) 6%, var(--ds-surface-command))",
});
feature(".tool-inline-content", {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  minWidth: "0",
  width: "100%",
});
feature(".command-inline-status-row", {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
});
feature(".command-inline-status", {
  color: "var(--ds-text-strong)",
  fontSize: "clamp(15px, 1.1vw, 17px)",
  fontWeight: "600",
  letterSpacing: "-0.018em",
  lineHeight: "var(--line-height-135)",
});
feature(".command-inline-surface", {
  borderRadius: "12px",
  border: "none",
  background: flatCommandBackground,
  overflow: "hidden",
  boxShadow: "none",
});
feature(".command-inline-surface-header", {
  borderBottom: "none",
  background: "color-mix(in srgb, var(--ds-color-white) 3%, transparent)",
});
feature(".command-inline-surface-toggle", {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "13px 16px 12px",
  border: "none",
  background: "transparent",
  color: "color-mix(in srgb, var(--ds-color-white) 92%, var(--ds-text-strong))",
  textAlign: "left",
  cursor: "pointer",
});
feature(".command-inline-surface-toggle:hover", {
  background: "color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
});
feature(".command-inline-surface-toggle:focus-visible", {
  outline: "none",
  background: "color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
});
feature(".command-inline-surface-label", {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "color-mix(in srgb, var(--ds-color-white) 96%, var(--ds-text-strong))",
  fontSize: "var(--font-size-meta)",
  fontWeight: "560",
});
feature(".command-inline-surface-hint", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  color: "color-mix(in srgb, var(--ds-color-white) 64%, transparent)",
  whiteSpace: "nowrap",
});
feature(".command-inline-prompt-row", {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "start",
  gap: "12px",
  padding: "14px 16px 10px",
  fontFamily: "var(--code-font-family)",
  fontSize: "clamp(16px, 1.25vw, 18px)",
  lineHeight: "var(--line-height-145)",
  color: "color-mix(in srgb, var(--ds-color-white) 92%, var(--ds-text-strong))",
});
feature(".command-inline-prompt", {
  color: "color-mix(in srgb, var(--ds-color-white) 58%, transparent)",
  fontWeight: "600",
});
feature(".command-inline-prompt-command", {
  minWidth: "0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
feature(".command-inline-context", {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: "0",
  padding: "0 16px 14px",
  color: "color-mix(in srgb, var(--ds-color-white) 74%, transparent)",
  fontSize: "var(--font-size-fine)",
  fontFamily: "var(--code-font-family)",
});
feature(".command-inline-context-label", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
  color: "color-mix(in srgb, var(--ds-color-white) 84%, transparent)",
  fontFamily: "var(--font-family-base)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});
feature(".tool-inline-header", {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  minWidth: "0",
});
feature(".tool-inline-primary", {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: "0",
  flex: "1 1 auto",
  flexWrap: "wrap",
});
feature(".tool-inline-summary", {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-strong)",
  minWidth: "0",
  flex: "1 1 auto",
});
feature(".tool-inline-toggle", {
  background: "color-mix(in srgb, var(--ds-surface-control) 44%, transparent)",
  border: "none",
  borderRadius: "10px",
  padding: "8px 10px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  maxWidth: "100%",
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
});
feature(".tool-inline-actions", {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  flex: "0 0 auto",
});
feature(".tool-inline-badges", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: "4px",
  minWidth: "0",
  flex: "0 1 auto",
});
feature(".tool-inline-toggle:hover", {
  background: "color-mix(in srgb, var(--ds-surface-hover) 70%, var(--ds-surface-control))",
  boxShadow: "none",
});
feature(".tool-inline-toggle:focus-visible", {
  outline: "2px solid color-mix(in srgb, var(--ds-brand-primary) 24%, transparent)",
  outlineOffset: "2px",
  background: "color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)",
});
feature(".tool-inline-bar-toggle", {
  position: "absolute",
  left: "2px",
  top: "4px",
  bottom: "4px",
  width: "10px",
  background: "none",
  border: "none",
  cursor: "pointer",
  borderRadius: "8px",
});
feature(".tool-inline-icon", {
  width: "15px",
  height: "15px",
  color: "var(--status-unknown)",
  flex: "0 0 auto",
});
feature(".tool-inline-icon.completed", {
  color: "color-mix(in srgb, var(--status-success) 58%, var(--ds-text-strong))",
});
feature(".tool-inline-icon.processing", {
  color: "color-mix(in srgb, var(--status-warning) 58%, var(--ds-text-strong))",
});
feature(".tool-inline-icon.failed", {
  color: "color-mix(in srgb, var(--status-error) 58%, var(--ds-text-strong))",
});
feature(".tool-inline-label", {
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-micro)",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});
feature(".tool-inline-value", {
  color: "var(--ds-text-strong)",
  fontWeight: "620",
  lineHeight: "var(--line-height-135)",
  minWidth: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "normal",
});
feature(".tool-inline-single-line", {
  display: "block",
  width: "100%",
  flex: "1 1 auto",
  minWidth: "0",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
feature(".tool-inline-command", {
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--code-font-size)",
  lineHeight: "var(--code-line-height)",
  color: "var(--ds-text-quiet)",
  background: "color-mix(in srgb, var(--ds-surface-command) 54%, transparent)",
  padding: "2px 7px",
  borderRadius: "7px",
  border: "none",
  display: "inline-flex",
  minWidth: "0",
  maxWidth: "360px",
});
feature(".tool-inline-command-text", {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "inline-block",
  minWidth: "0",
});
feature(".tool-inline-command-full", { maxWidth: "none" });
feature(".tool-inline-command-full .tool-inline-command-text", {
  overflow: "visible",
  textOverflow: "unset",
  whiteSpace: "pre-wrap",
});
feature(".tool-inline-meta", {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
});
feature(".command-inline .tool-inline-meta", {
  marginTop: "2px",
});
feature(".tool-inline-chip", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "20px",
  padding: "1px 7px",
  borderRadius: "999px",
  border: flatChipBorder,
  background: flatChipBackground,
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-micro)",
  fontWeight: "600",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
});
feature(".tool-inline-chip.active", {
  borderColor: "color-mix(in srgb, var(--status-warning) 22%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-warning) 9%, transparent)",
});
feature(".tool-inline-chip.done", {
  borderColor: "color-mix(in srgb, var(--status-success) 22%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-success) 8%, transparent)",
});
feature(".tool-inline-chip.failed", {
  borderColor: "color-mix(in srgb, var(--status-error) 22%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-error) 8%, transparent)",
});
feature(".tool-inline-status-compact", {
  fontWeight: "640",
  letterSpacing: "0.02em",
});
feature(".tool-inline-chevron", {
  width: "14px",
  height: "14px",
  color: "var(--ds-text-faint)",
  flex: "0 0 auto",
});
feature(".tool-inline-detail", {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "none",
  background: flatInsetBackground,
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-150)",
  color: "var(--ds-text-subtle)",
  whiteSpace: "pre-wrap",
  boxShadow: "none",
  maxHeight: "min(32vh, 280px)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
  scrollbarWidth: "thin",
});
feature(".tool-inline-muted", { color: "var(--ds-text-faint)" });
feature(".tool-inline-change-list", {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  marginTop: "4px",
});
feature(".file-edit-view", { display: "flex", flexDirection: "column", gap: "8px", minWidth: "0" });
feature(".file-edit-view-label-row", {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  minWidth: "0",
  padding: "0 4px",
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "580",
  letterSpacing: "0.01em",
});
feature(".file-edit-view-kind", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "20px",
  padding: "2px 8px",
  borderRadius: "999px",
  border: flatChipBorder,
  background: flatChipBackground,
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-fine)",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});
feature(".file-edit-view-card", {
  display: "flex",
  flexDirection: "column",
  minWidth: "0",
  overflow: "hidden",
  border: flatSurfaceBorder,
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--ds-surface-diff-card) 92%, var(--ds-surface-card-base))",
  boxShadow: "none",
});
feature(".file-edit-view-card-header", {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: "0",
  padding: "12px 14px 10px",
  borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 34%, transparent)",
});
feature(".file-edit-view-name", {
  minWidth: "0",
  flex: "1 1 auto",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--ds-text-strong)",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-140)",
});
feature(".file-edit-view-stats", {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  flex: "0 0 auto",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
});
feature('.file-edit-view-stat[data-diff-stat="add"]', {
  color: "color-mix(in srgb, var(--status-success) 86%, var(--ds-text-strong))",
});
feature('.file-edit-view-stat[data-diff-stat="del"]', {
  color: "color-mix(in srgb, var(--status-error) 86%, var(--ds-text-strong))",
});
feature(".file-edit-view-copy", {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  flex: "0 0 auto",
  borderRadius: "8px",
  border: flatChipBorder,
  background: flatChipBackground,
  color: "var(--ds-text-subtle)",
  transition:
    "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
});
feature(".file-edit-view-copy:hover", {
  background: "color-mix(in srgb, var(--ds-surface-hover) 78%, var(--ds-surface-card-base))",
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  color: "var(--ds-text-strong)",
});
feature(".file-edit-view-copy:focus-visible", {
  outline: "none",
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 52%, transparent)",
  background: "color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)",
});
feature('.file-edit-view-copy[data-copy-state="copied"]', {
  borderColor: "color-mix(in srgb, var(--status-success) 28%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-success) 10%, transparent)",
  color: "color-mix(in srgb, var(--status-success) 62%, var(--ds-text-strong))",
});
feature(".file-edit-view-path", {
  padding: "0 14px 10px",
  color: "var(--ds-text-faint)",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-fine)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
feature(".file-edit-view-diff", {
  width: "100%",
  maxHeight: "480px",
  overflow: "auto",
  padding: "10px 0 12px",
  borderTop: "1px solid color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 86%, transparent)",
  scrollbarWidth: "thin",
});
feature(".file-edit-view-empty", {
  padding: "14px 16px 16px",
  borderTop: "1px solid color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
});
feature(".tool-inline-output", {
  marginTop: "2px",
  minWidth: "0",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "none",
  background: flatInsetBackground,
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-155)",
  color: "var(--ds-text-strong)",
  boxShadow: "none",
  overflow: "hidden",
});
feature(".tool-inline-terminal", {
  border: "none",
  borderRadius: "10px",
  background: "color-mix(in srgb, var(--ds-surface-command) 82%, transparent)",
  overflow: "hidden",
});
feature(".command-inline .tool-inline-terminal", {
  border: "none",
  borderTop: "1px solid color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
  borderRadius: "0",
  background: "color-mix(in srgb, var(--ds-color-black) 10%, var(--ds-surface-command))",
});
feature(".tool-inline-terminal-lines", {
  maxHeight: "min(32vh, 260px)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
  padding: "8px 10px",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-135)",
  color: "var(--ds-text-quiet)",
  scrollbarWidth: "thin",
});
feature(".command-inline .tool-inline-terminal-lines", {
  maxHeight: "min(42vh, 360px)",
  padding: "12px 18px 16px",
  color: "color-mix(in srgb, var(--ds-color-white) 78%, transparent)",
  lineHeight: "var(--line-height-150)",
});
feature(".tool-inline-terminal-line", { whiteSpace: "pre-wrap", wordBreak: "break-word" });

feature(".working", {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  padding: "8px 0 10px",
});
feature(".working-text", {
  display: "none",
});
feature(".working-text-enhanced", {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  minWidth: "0",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-meta)",
});
feature(".working-text-detail", {
  maxWidth: "300px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--ds-text-faint)",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-fine)",
});
feature(".working", {
  "@media": {
    "(max-width: 640px)": {
      gap: "10px",
    },
  },
});
feature(".working-header", {
  "@media": {
    "(max-width: 640px)": {
      gap: "6px",
    },
  },
});
feature(".timeline-card-header", {
  "@media": {
    "(max-width: 640px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
});
feature(".tool-inline-header", {
  "@media": {
    "(max-width: 640px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
});
feature(".tool-inline-summary", {
  "@media": {
    "(max-width: 640px)": {
      alignItems: "flex-start",
    },
  },
});
feature(".tool-inline-badges", {
  "@media": {
    "(max-width: 640px)": {
      justifyContent: "flex-start",
    },
  },
});
feature(".command-inline-status-row", {
  "@media": {
    "(max-width: 640px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
});
feature(".tool-inline-actions", {
  "@media": {
    "(max-width: 640px)": {
      marginLeft: "0",
      justifyContent: "flex-end",
    },
  },
});
feature(".file-edit-view-card-header", {
  "@media": {
    "(max-width: 640px)": {
      alignItems: "flex-start",
      flexWrap: "wrap",
      padding: "12px 14px 10px",
    },
  },
});
feature(".file-edit-view-path", {
  "@media": {
    "(max-width: 640px)": {
      padding: "0 14px 8px",
    },
  },
});
feature(".file-edit-view-diff", {
  "@media": {
    "(max-width: 640px)": {
      maxHeight: "360px",
    },
  },
});
feature(".tool-inline-detail", {
  "@media": {
    "(max-width: 640px)": {
      maxHeight: "220px",
    },
  },
});
feature(".tool-inline-terminal-lines", {
  "@media": {
    "(max-width: 640px)": {
      maxHeight: "200px",
    },
  },
});
feature(".command-inline-prompt-row", {
  "@media": {
    "(max-width: 640px)": {
      fontSize: "var(--font-size-meta)",
      gap: "10px",
      padding: "14px 14px 10px",
    },
  },
});
feature(".command-inline .tool-inline-terminal-lines", {
  "@media": {
    "(max-width: 640px)": {
      maxHeight: "220px",
      padding: "10px 14px 14px",
    },
  },
});
feature(".command-inline-context", {
  "@media": {
    "(max-width: 640px)": {
      padding: "0 14px 14px",
      flexWrap: "wrap",
    },
  },
});
