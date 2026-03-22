import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const viewer = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "0",
      overflowY: "auto",
      overflowX: "hidden",
      position: "relative",
      padding: "12px 0 16px",
      flex: "1",
      minHeight: "0",
      minWidth: "0",
      background: "var(--ds-surface-messages)",
      scrollbarWidth: "thin",
    },
  },
  selectors: {
    ".main &": {
      marginTop: "0",
      paddingTop: "0",
    },
  },
});

export const pullRequestSummary = style({
  "@layer": {
    [layers.features]: {
      margin: "12px 16px 16px",
      display: "grid",
      gap: "0",
    },
  },
});

export const pullRequestHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
  },
});

export const pullRequestHeaderRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
    },
  },
});

export const pullRequestTitle = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      fontSize: "var(--font-size-title-lg)",
      fontWeight: "600",
      color: "var(--ds-text-strong)",
    },
  },
});

export const pullRequestJump = style({
  "@layer": {
    [layers.features]: {
      padding: "4px 10px",
      fontSize: "var(--font-size-fine)",
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    },
  },
});

export const pullRequestJumpAdd = style({
  "@layer": {
    [layers.features]: {
      color: "var(--status-success)",
      fontVariantNumeric: "tabular-nums",
    },
  },
});

export const pullRequestJumpDelete = style({
  "@layer": {
    [layers.features]: {
      color: "var(--status-error)",
      fontVariantNumeric: "tabular-nums",
    },
  },
});

export const pullRequestJumpSeparator = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
      fontVariantNumeric: "tabular-nums",
    },
  },
});

export const pullRequestNumber = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
      fontVariantNumeric: "tabular-nums",
    },
  },
});

export const pullRequestTitleText = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      fontWeight: "inherit",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const pullRequestMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      alignItems: "center",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const pullRequestAuthor = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      fontWeight: "600",
    },
  },
});

export const pullRequestSeparator = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
    },
  },
});

export const pullRequestBranch = style({
  "@layer": {
    [layers.features]: {
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-quiet)",
      lineHeight: "var(--line-height-100)",
    },
  },
});

export const pullRequestPill = style({
  "@layer": {
    [layers.features]: {
      alignSelf: "center",
    },
  },
});

export const pullRequestBody = style({
  "@layer": {
    [layers.features]: {
      marginTop: "12px",
      paddingTop: "12px",
      borderTop: "1px solid var(--ds-border-subtle)",
    },
  },
});

export const pullRequestMarkdown = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-chrome)",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const pullRequestEmpty = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
    },
  },
});

export const pullRequestTimeline = style({
  "@layer": {
    [layers.features]: {
      marginTop: "16px",
      paddingTop: "12px",
      borderTop: "1px solid var(--ds-border-subtle)",
    },
  },
});

export const pullRequestTimelineHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
      marginBottom: "12px",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const pullRequestTimelineTitle = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      fontWeight: "600",
      color: "var(--ds-text-strong)",
    },
  },
});

export const pullRequestTimelineCount = style({
  "@layer": {
    [layers.features]: {
      fontVariantNumeric: "tabular-nums",
    },
  },
});

export const pullRequestTimelineButton = style({
  "@layer": {
    [layers.features]: {
      padding: "4px 10px",
      fontSize: "var(--font-size-fine)",
    },
  },
});

export const pullRequestTimelineList = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      paddingLeft: "14px",
    },
  },
  selectors: {
    "&::before": {
      content: '""',
      position: "absolute",
      left: "6px",
      top: "4px",
      bottom: "4px",
      width: "2px",
      background: "color-mix(in srgb, var(--ds-border-subtle) 34%, transparent)",
    },
  },
});

export const pullRequestTimelineItem = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "12px",
      position: "relative",
    },
  },
});

export const pullRequestTimelineMarker = style({
  "@layer": {
    [layers.features]: {
      width: "12px",
      height: "12px",
      borderRadius: "999px",
      background: "var(--ds-surface-control)",
      border: "2px solid color-mix(in srgb, var(--ds-border-subtle) 84%, var(--ds-border-muted))",
      marginTop: "3px",
      flexShrink: "0",
      position: "relative",
      zIndex: "1",
    },
  },
});

export const pullRequestTimelineContent = style({
  "@layer": {
    [layers.features]: {
      flex: "1",
      minWidth: "0",
      padding: "10px 12px",
      borderRadius: "12px",
      background: "color-mix(in srgb, var(--ds-surface-card) 78%, transparent)",
      border: "1px solid var(--ds-border-subtle)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
    },
  },
});

export const pullRequestTimelineMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      alignItems: "center",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const pullRequestTimelineAuthor = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      fontWeight: "600",
    },
  },
});

export const pullRequestTimelineText = style({
  "@layer": {
    [layers.features]: {
      marginTop: "6px",
      marginBottom: 0,
    },
  },
});

export const pullRequestComment = style({
  "@layer": {
    [layers.features]: {
      marginTop: "8px",
      fontSize: "var(--font-size-chrome)",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const pullRequestTimelineState = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      paddingLeft: "12px",
    },
  },
});

export const pullRequestTimelineError = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-syntax-danger)",
    },
  },
});

export const pullRequestTimelineDivider = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-faint)",
      paddingLeft: "12px",
    },
  },
});

export const list = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
      height: "var(--diff-viewer-list-height, auto)",
    },
  },
});

export const row = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
      paddingBottom: "0",
      willChange: "transform",
      isolation: "isolate",
      transform: "translate3d(0, var(--diff-viewer-row-offset, 0px), 0)",
    },
  },
});

export const item = style({
  "@layer": {
    [layers.features]: {
      borderRadius: "0",
      border: "none",
      background: "transparent",
      padding: "0",
      width: "100%",
      minWidth: "0",
      borderBottom: "1px solid var(--ds-border-subtle)",
      position: "relative",
      isolation: "isolate",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth)",
    },
  },
});

export const itemActive = style({
  "@layer": {
    [layers.features]: {
      borderColor: "var(--ds-border-subtle)",
      background: "color-mix(in srgb, var(--ds-surface-active) 35%, transparent)",
      boxShadow: "none",
    },
  },
});

export const itemImage = style({
  "@layer": {
    [layers.features]: {
      background: "transparent",
    },
  },
});

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: "8px",
      minWidth: "0",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
      background: "var(--ds-surface-messages)",
      padding: "12px 12px 10px",
      margin: "0",
      borderBottom: "1px solid var(--ds-border-subtle)",
      boxShadow: "0 1px 0 color-mix(in srgb, var(--ds-color-black) 8%, transparent)",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth)",
    },
  },
});

export const sticky = style({
  "@layer": {
    [layers.features]: {
      position: "sticky",
      top: "0",
      zIndex: "1",
      height: "0",
      overflow: "visible",
      pointerEvents: "none",
    },
  },
});

export const stickyHeader = style({
  "@layer": {
    [layers.features]: {
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      pointerEvents: "auto",
    },
  },
});

export const status = style({
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
      alignSelf: "flex-start",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      fontWeight: 500,
    },
  },
});

export const scopeBadge = style({
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
      alignSelf: "flex-start",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    },
  },
});

export const path = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "baseline",
      gap: "6px",
      flex: "1",
      minWidth: "0",
      wordBreak: "break-word",
    },
  },
});

export const name = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-emphasis)",
      fontWeight: "600",
      minWidth: "0",
      flex: "0 1 auto",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const dir = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
      flex: "1",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: "0",
    },
  },
});

export const headerAction = style({
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      borderRadius: "6px",
      padding: "0",
      border: "1px solid transparent",
      background: "transparent",
      color: "var(--ds-text-faint)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flex: "0 0 auto",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:hover": {
      background: "color-mix(in srgb, var(--ds-surface-control-hover) 74%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
      color: "var(--ds-text-emphasis)",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 66%, transparent)",
      outlineOffset: "1px",
    },
  },
});

export const headerActionDiscard = style({
  selectors: {
    "&:hover": {
      background: "color-mix(in srgb, var(--status-error) 10%, transparent)",
      borderColor: "color-mix(in srgb, var(--status-error) 30%, transparent)",
      color: "color-mix(in srgb, var(--status-error) 74%, var(--ds-text-strong))",
    },
  },
});

export const output = style({
  vars: {
    "--diffs-font-family": "var(--code-font-family)",
    "--diffs-font-size": "var(--code-font-size, 11px)",
    "--diffs-line-height": "var(--code-line-height, 1.28)",
    "--diffs-tab-size": "2",
  },
  "@layer": {
    [layers.features]: {
      background: "var(--ds-surface-command)",
      borderRadius: "8px",
      padding: "8px",
      fontSize: "var(--code-font-size)",
      color: "var(--ds-text-quiet)",
      fontFamily: "var(--code-font-family)",
      fontWeight: "var(--code-font-weight, 400)",
      maxWidth: "100%",
      minWidth: "0",
      width: "100%",
      overflowX: "hidden",
      overflowY: "visible",
      position: "relative",
      contain: "layout style",
      isolation: "isolate",
    },
  },
});

export const outputFlat = style({
  "@layer": {
    [layers.features]: {
      background: "transparent",
      borderRadius: "0",
      padding: "0",
      boxShadow: "none",
      position: "relative",
      contain: "layout style",
      isolation: "isolate",
    },
  },
});

export const placeholder = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-meta)",
      padding: "8px 0",
    },
  },
});

export const empty = style([
  placeholder,
  {
    "@layer": {
      [layers.features]: {
        padding: "16px",
      },
    },
  },
]);

export const emptyState = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      flex: "1",
      minHeight: "240px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      padding: "24px 16px 30px",
      textAlign: "center",
    },
  },
});

export const emptyGlow = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      width: "min(72%, 520px)",
      height: "180px",
      borderRadius: "999px",
      background:
        "radial-gradient(ellipse at center, color-mix(in srgb, var(--ds-border-accent-soft) 24%, transparent) 0%, transparent 72%)",
      filter: "blur(14px)",
      pointerEvents: "none",
    },
  },
});

export const emptyIcon = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      width: "34px",
      height: "34px",
      borderRadius: "999px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ds-text-emphasis)",
      border: "1px solid color-mix(in srgb, var(--ds-border-accent-soft) 44%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-active) 62%, transparent)",
    },
  },
});

export const emptyTitle = style({
  "@layer": {
    [layers.features]: {
      margin: "2px 0 2px",
      fontSize: "var(--font-size-title-lg)",
      lineHeight: "var(--line-height-120)",
      color: "var(--ds-text-emphasis)",
      letterSpacing: "0.01em",
    },
  },
});

export const emptySubtitle = style({
  "@layer": {
    [layers.features]: {
      margin: "0",
      maxWidth: "560px",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-chrome)",
      lineHeight: "var(--line-height-145)",
    },
  },
});

export const emptyHint = style({
  "@layer": {
    [layers.features]: {
      margin: "0",
      maxWidth: "560px",
      color: "var(--ds-text-faint)",
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-140)",
    },
  },
});

export const loading = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      alignSelf: "flex-end",
      maxWidth: "calc(100% - 24px)",
      margin: "0 12px 10px auto",
      padding: "6px 10px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-accent-soft) 42%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 96%, transparent), color-mix(in srgb, var(--ds-surface-item) 92%, transparent))",
      boxShadow:
        "0 12px 26px -20px color-mix(in srgb, var(--ds-shadow-color) 36%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
      color: "var(--ds-text-faint)",
      fontSize: "var(--font-size-fine)",
      lineHeight: "var(--line-height-100)",
      whiteSpace: "nowrap",
    },
  },
});

export const loadingOverlay = style({
  "@layer": {
    [layers.features]: {
      position: "sticky",
      top: "8px",
      zIndex: "3",
      pointerEvents: "none",
    },
  },
});
