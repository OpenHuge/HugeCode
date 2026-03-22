import { typographyValues } from "@ku0/design-system";
import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

const spin = keyframes({
  to: { transform: "rotate(360deg)" },
});

export const diffError = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      color: "color-mix(in srgb, var(--status-error) 90%, var(--ds-color-white))",
      whiteSpace: "pre-wrap",
    },
  },
});

export const sidebarError = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      gap: "6px",
    },
  },
});

export const sidebarErrorBody = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      minWidth: "0",
      flex: "1",
    },
  },
});

export const sidebarErrorMessage = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      WebkitUserSelect: "text",
      userSelect: "text",
    },
  },
});

export const sidebarErrorAction = style({
  "@layer": {
    [layers.features]: {
      alignSelf: "flex-start",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      fontSize: "var(--font-size-meta)",
      borderRadius: "8px",
    },
  },
});

export const sidebarErrorDismiss = style({
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
      width: "18px",
      height: "18px",
      padding: "0",
      borderRadius: "4px",
      color: "var(--ds-text-faint)",
    },
  },
  selectors: {
    "&:hover": {
      color: "var(--ds-text-emphasis)",
    },
  },
});

export const diffRowMeta = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "flex-end",
      justifySelf: "end",
      minWidth: "0",
    },
  },
});

export const diffRowActions = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      maxWidth: "0",
      overflow: "hidden",
      marginLeft: "0",
      opacity: "0",
      pointerEvents: "none",
      transform: "translateX(6px)",
      transition:
        "max-width var(--duration-normal) var(--ease-smooth), opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth), margin-left var(--duration-normal) var(--ease-smooth)",
    },
  },
});

export const diffCountsInline = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      whiteSpace: "nowrap",
      fontSize: "var(--font-size-micro)",
      fontFamily: "var(--code-font-family)",
      fontVariantNumeric: "tabular-nums",
      opacity: "0.86",
    },
  },
});

export const diffRowAction = style({
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      borderRadius: "6px",
      padding: "0",
      border: "1px solid transparent",
      background: "transparent",
      color: "var(--ds-panel-muted)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      position: "relative",
    },
  },
  selectors: {
    "&:hover": {
      background: "var(--ds-panel-row-hover)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 72%, transparent)",
      color: "var(--ds-panel-value)",
      transform: "none",
      boxShadow: "none",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--ds-panel-focus-ring) 54%, transparent)",
      outlineOffset: "1px",
    },
  },
});

export const diffRowActionTone = styleVariants({
  stage: {
    "@layer": {
      [layers.features]: {
        color: "inherit",
        borderColor: "transparent",
      },
    },
    selectors: {
      "&:hover": {
        background: "color-mix(in srgb, var(--status-success) 10%, transparent)",
        borderColor: "color-mix(in srgb, var(--status-success) 30%, transparent)",
        color: "color-mix(in srgb, var(--status-success) 72%, var(--ds-text-strong))",
      },
    },
  },
  unstage: {
    "@layer": {
      [layers.features]: {
        color: "inherit",
        borderColor: "transparent",
      },
    },
    selectors: {
      "&:hover": {
        background: "color-mix(in srgb, var(--status-warning) 10%, transparent)",
        borderColor: "color-mix(in srgb, var(--status-warning) 30%, transparent)",
        color: "color-mix(in srgb, var(--status-warning) 72%, var(--ds-text-strong))",
      },
    },
  },
  discard: {
    "@layer": {
      [layers.features]: {
        color: "inherit",
        borderColor: "transparent",
      },
    },
    selectors: {
      "&:hover": {
        background: "color-mix(in srgb, var(--status-error) 10%, transparent)",
        borderColor: "color-mix(in srgb, var(--status-error) 30%, transparent)",
        color: "color-mix(in srgb, var(--status-error) 72%, var(--ds-text-strong))",
      },
    },
  },
});

export const diffRow = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      columnGap: "8px",
      alignItems: "center",
      padding: "8px 10px",
      width: "100%",
      borderRadius: "8px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 38%, transparent)",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:focus-within": {
      outline: "2px solid color-mix(in srgb, var(--ds-panel-focus-ring) 54%, transparent)",
      outlineOffset: "1px",
      borderColor:
        "color-mix(in srgb, var(--ds-panel-focus-ring) 28%, var(--ds-panel-section-divider))",
    },
    "&:hover, &:focus-within": {
      background: "var(--ds-panel-row-hover)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 78%, transparent)",
      boxShadow: "none",
    },
    '&[data-active="true"]': {
      background: "color-mix(in srgb, var(--ds-panel-selected) 58%, transparent)",
      borderColor:
        "color-mix(in srgb, var(--ds-panel-focus-ring) 28%, var(--ds-panel-section-divider))",
    },
    '&[data-selected="true"]': {
      background: "color-mix(in srgb, var(--ds-panel-selected) 46%, transparent)",
      borderColor:
        "color-mix(in srgb, var(--ds-panel-focus-ring) 22%, var(--ds-panel-section-divider))",
    },
    '&[data-selected="true"][data-active="true"]': {
      background: "color-mix(in srgb, var(--ds-panel-selected) 64%, transparent)",
    },
  },
});

export const diffRowButton = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "16px minmax(0, 1fr) auto",
      columnGap: "10px",
      alignItems: "center",
      minWidth: "0",
      width: "100%",
      padding: "0",
      border: "0",
      background: "transparent",
      font: "inherit",
      color: "inherit",
      textAlign: "left",
      cursor: "pointer",
    },
  },
  selectors: {
    "&:focus-visible": {
      outline: "none",
    },
  },
});

export const diffRowActionsVisible = style({
  selectors: {
    [`${diffRow}:hover &, ${diffRow}:focus-within &, ${diffRow}[data-active="true"] &, ${diffRow}[data-selected="true"] &`]:
      {
        maxWidth: "96px",
        marginLeft: "6px",
        opacity: "1",
        pointerEvents: "auto",
        overflow: "visible",
        transform: "translateX(0)",
      },
  },
});

export const diffIcon = style({
  "@layer": {
    [layers.features]: {
      width: "16px",
      height: "16px",
      display: "grid",
      placeItems: "center",
      borderRadius: "4px",
      fontSize: "var(--font-size-micro)",
      fontWeight: "700",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      color: "var(--ds-panel-muted)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 52%, transparent)",
      lineHeight: typographyValues.micro.lineHeight,
      paddingBottom: "2px",
      gridColumn: "1",
    },
  },
});

export const diffIconTone = styleVariants({
  neutral: {
    "@layer": {
      [layers.features]: {
        color: "var(--ds-panel-muted)",
        borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 52%, transparent)",
        background: "color-mix(in srgb, var(--ds-panel-section-bg) 52%, transparent)",
      },
    },
  },
  added: {
    "@layer": {
      [layers.features]: {
        color: "color-mix(in srgb, var(--status-success) 72%, var(--ds-text-strong))",
        borderColor: "color-mix(in srgb, var(--status-success) 34%, transparent)",
        background: "color-mix(in srgb, var(--status-success) 8%, transparent)",
      },
    },
  },
  modified: {
    "@layer": {
      [layers.features]: {
        color: "color-mix(in srgb, var(--status-warning) 72%, var(--ds-text-strong))",
        borderColor: "color-mix(in srgb, var(--status-warning) 34%, transparent)",
        background: "color-mix(in srgb, var(--status-warning) 8%, transparent)",
      },
    },
  },
  deleted: {
    "@layer": {
      [layers.features]: {
        color: "color-mix(in srgb, var(--status-error) 72%, var(--ds-text-strong))",
        borderColor: "color-mix(in srgb, var(--status-error) 36%, transparent)",
        background: "color-mix(in srgb, var(--status-error) 8%, transparent)",
      },
    },
  },
});

export const diffFile = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: "0",
      gridColumn: "2",
    },
  },
});

export const diffPath = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-emphasis)",
      minWidth: "0",
    },
  },
});

export const diffName = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      minWidth: "0",
      flex: "1",
    },
  },
});

export const diffNameBase = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const diffNameExt = style({
  "@layer": {
    [layers.features]: {
      flex: "0 0 auto",
      whiteSpace: "nowrap",
    },
  },
});

export const diffDir = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      color: "var(--ds-text-faint)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
});

export const diffSection = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "10px",
      borderRadius: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 54%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 28%, transparent)",
    },
  },
});

export const diffSectionHeaderActions = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      flexWrap: "wrap",
      flexShrink: "0",
    },
  },
});

export const diffSectionList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
  },
});

export const commitButtonContainer = style({
  "@layer": {
    [layers.features]: {
      marginTop: "4px",
    },
  },
});

export const commitButton = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      justifyContent: "center",
    },
  },
});

export const commitButtonSpinner = style({
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      border: "2px solid var(--ds-border-subtle)",
      borderTopColor: "var(--ds-text-emphasis)",
      animation: `${spin} 0.9s linear infinite`,
    },
  },
});

export const commitError = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "color-mix(in srgb, var(--status-error) 90%, var(--ds-color-white))",
      padding: "2px 0",
    },
  },
});

export const gitLogEntry = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      padding: "7px 9px",
      width: "100%",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      font: "inherit",
      color: "inherit",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 48%, transparent)",
      textAlign: "left",
      borderRadius: "7px",
      cursor: "pointer",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:hover, &:focus-visible": {
      background: "var(--ds-panel-row-hover)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
      boxShadow: "none",
      outline: "none",
    },
    '&[aria-pressed="true"]': {
      background: "color-mix(in srgb, var(--ds-panel-selected) 72%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
      boxShadow:
        "inset 0 0 0 1px color-mix(in srgb, var(--ds-panel-section-divider) 24%, transparent)",
    },
  },
});

export const gitLogEntryCompact = style({
  "@layer": {
    [layers.features]: {
      padding: "6px 8px",
    },
  },
});

export const gitLogSummary = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-panel-value)",
    },
  },
});

export const gitLogMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const gitLogSha = style({
  "@layer": {
    [layers.features]: {
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
    },
  },
});

export const gitLogSep = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-panel-muted)",
    },
  },
});
