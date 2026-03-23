import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import { workspaceThreadLaneWidthVar } from "../../../styles/conversation-layout.css";
export const empty = "empty";
export const messages = style({
  "@layer": {
    [layers.features]: {
      overflowY: "auto",
      overflowX: "hidden",
      flex: "1",
      minHeight: "0",
      minWidth: "0",
      scrollbarWidth: "thin",
    },
  },
});
export const messagesFull = style({
  "@layer": {
    [layers.features]: {
      vars: {
        "--messages-content-max-width": workspaceThreadLaneWidthVar,
        "--messages-content-gutter": "28px",
      },
      display: "flex",
      flexDirection: "column",
      background: "transparent",
      borderRadius: "0",
      padding: "12px 0 18px calc(var(--main-panel-padding) + 2px)",
      border: "none",
    },
  },
  selectors: {
    ".main &": {
      marginTop: "calc(-1 * var(--main-topbar-height) + 6px)",
      paddingTop: "calc(12px + var(--main-topbar-height))",
    },
  },
});
export const messagesEmpty = style({
  "@layer": {
    [layers.features]: {
      width: "min(100%, var(--messages-content-max-width, 100%))",
      maxWidth: "100%",
      minHeight: "100%",
      margin: "0 auto",
      padding: "24px 0 18px",
      display: "flex",
      alignItems: "center",
    },
  },
});
export const timelineLane = style({
  "@layer": {
    [layers.features]: {
      width: "min(100%, var(--messages-content-max-width, 100%))",
      maxWidth: "100%",
      margin: "0 auto",
      position: "relative",
    },
  },
});
export const messagesStage = style({
  "@layer": {
    [layers.features]: {
      width: "min(100%, var(--messages-content-max-width, 100%))",
      margin: "0 auto",
      padding: "0 0 12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      "@media": {
        "(max-width: 1024px)": {
          width: "min(100%, var(--messages-content-max-width, 100%))",
          padding: "0 0 12px",
        },
        "(max-width: 768px)": {
          width: "100%",
          padding: "0 0 10px",
        },
      },
    },
  },
});
export const currentTurnPanel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "12px",
      width: "100%",
      padding: "0",
      borderRadius: "0",
      border: "none",
      background: "transparent",
      boxShadow: "none",
      "@media": {
        "(max-width: 768px)": {
          gap: "10px",
        },
      },
    },
  },
});
export const currentTurnBody = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "12px",
      alignItems: "start",
    },
  },
});
export const currentTurnNarrativeRail = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "12px",
      minWidth: "0",
      alignContent: "start",
      minHeight: "100%",
    },
  },
});
export const currentTurnExecutionRail = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      minWidth: "0",
      width: "100%",
      justifySelf: "stretch",
      marginLeft: "0",
      padding: "8px 0 0",
      borderRadius: "0",
      border: "none",
      background: "transparent",
      alignContent: "start",
      "@media": {
        "(max-width: 768px)": {
          width: "100%",
          padding: "6px 0 0",
        },
      },
    },
  },
});
export const currentTurnExecutionSummary = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px",
      minWidth: "0",
    },
  },
});
export const currentTurnFooterDock = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      minWidth: "0",
      paddingTop: "0",
    },
  },
});
export const messagesLoadingIndicator = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
    },
  },
});
export const messagesLoadingLabel = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-meta)",
    },
  },
});
export const workingSpinner = "working-spinner";
export const turnProgressChip = style({
  "@layer": {
    [layers.features]: {
      padding: "3px 8px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-control) 82%, transparent)",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-fine)",
    },
  },
});
export const statePrimary = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-brand-primary) 10%, var(--ds-surface-control))",
      borderColor: "color-mix(in srgb, var(--ds-brand-primary) 18%, var(--ds-border-subtle))",
      color: "var(--ds-text-strong)",
      boxShadow: "none",
    },
  },
});
export const messagesCurrentTurnDivider = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      margin: "14px 0 8px",
    },
  },
});
export const messagesCurrentTurnDividerLine = style({
  "@layer": {
    [layers.features]: {
      flex: "1 1 auto",
      minWidth: "20px",
      height: "1px",
      background: "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
    },
  },
});
export const messagesCurrentTurnDividerChip = style({
  "@layer": {
    [layers.features]: {
      flex: "0 0 auto",
      padding: "3px 8px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 48%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control) 66%, transparent)",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-micro)",
      fontWeight: "650",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      boxShadow: "none",
    },
  },
});
export const messagesCurrentTurnDividerMeta = style({
  "@layer": {
    [layers.features]: {
      flex: "0 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: "var(--ds-text-faint)",
      fontSize: "var(--font-size-fine)",
      letterSpacing: "0.01em",
    },
  },
});
export const messagesJumpToLatest = style({
  "@layer": {
    [layers.features]: {
      position: "sticky",
      bottom: "20px",
      left: "50%",
      zIndex: "2",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      marginTop: "10px",
      marginInline: "auto",
      padding: "7px 11px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-strong)",
      cursor: "pointer",
      boxShadow: "none",
      transform: "translateX(-50%)",
    },
  },
});
export const messagesJumpToLatestIconOnly = style({
  "@layer": {
    [layers.features]: {
      justifyContent: "center",
      flexShrink: 0,
      width: "34px",
      minWidth: "34px",
      height: "34px",
      minHeight: "34px",
      aspectRatio: "1 / 1",
      borderRadius: "50%",
      padding: "0",
      gap: "0",
    },
  },
});
export const messagesJumpToLatestCount = style({
  "@layer": {
    [layers.features]: {
      padding: "2px 8px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-control) 82%, transparent)",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-fine)",
    },
  },
});
export const toolGroup = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      width: "100%",
      margin: "2px 0 8px",
    },
  },
});
export const toolGroupCollapsed = style({
  "@layer": {
    [layers.features]: {
      gap: "0",
      marginBottom: "8px",
    },
  },
});
export const toolGroupHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      width: "100%",
    },
  },
});
export const toolGroupToggle = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      justifyContent: "flex-start",
      minWidth: "0",
      width: "100%",
      maxWidth: "100%",
      padding: "6px 8px 6px 6px",
      margin: "0",
      borderRadius: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 48%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 96%, transparent)",
      color: "var(--ds-text-subtle)",
      cursor: "pointer",
      textAlign: "left",
      boxShadow: "none",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:hover": {
          background: "color-mix(in srgb, var(--ds-surface-control) 68%, transparent)",
          borderColor: "color-mix(in srgb, var(--ds-border-strong) 24%, transparent)",
          color: "var(--ds-text-strong)",
          boxShadow: "none",
          transform: "none",
        },
        "&:active": {
          transform: "translateY(0)",
        },
        "&:focus-visible": {
          outline: "2px solid color-mix(in srgb, var(--ds-brand-primary) 54%, transparent)",
          outlineOffset: "3px",
        },
      },
    },
  },
});
export const toolGroupChevron = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "24px",
      height: "24px",
      flex: "0 0 auto",
      borderRadius: "999px",
      border: "none",
      background: "color-mix(in srgb, var(--ds-surface-control) 58%, transparent)",
      color: "var(--ds-text-muted)",
      boxShadow: "none",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        [`${toolGroupToggle}:hover &`]: {
          background: "color-mix(in srgb, var(--ds-surface-hover) 70%, transparent)",
          color: "var(--ds-text-subtle)",
        },
      },
    },
  },
});
export const toolGroupSummary = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px",
      minWidth: "0",
      flex: "1 1 auto",
    },
  },
});
export const toolGroupSummaryChip = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "24px",
      padding: "3px 9px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 42%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control) 66%, transparent)",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-fine)",
      fontWeight: "550",
      whiteSpace: "nowrap",
      letterSpacing: "-0.01em",
      boxShadow: "none",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        [`${toolGroupToggle}:hover &`]: {
          color: "var(--ds-text-subtle)",
        },
      },
    },
  },
});
export const toolGroupBody = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      marginLeft: "8px",
      paddingLeft: "8px",
      borderLeft: "none",
    },
  },
});
