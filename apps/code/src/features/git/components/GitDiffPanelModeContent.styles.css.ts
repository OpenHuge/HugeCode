import { typographyValues } from "@ku0/design-system";
import { keyframes, style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

const spin = keyframes({
  to: { transform: "rotate(360deg)" },
});

export const diffBranch = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
      fontSize: "var(--font-size-meta)",
      fontWeight: "600",
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-panel-value)",
      overflowWrap: "anywhere",
    },
  },
});

export const diffBranchRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
      minWidth: 0,
    },
  },
});

export const diffBranchInRow = style({
  "@layer": {
    [layers.features]: {
      flex: "1 1 180px",
      minWidth: 0,
      marginBottom: "0",
    },
  },
});

export const diffBranchRefresh = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "22px",
      height: "22px",
      borderRadius: "6px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 64%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 54%, transparent)",
      color: "var(--ds-panel-muted)",
      cursor: "pointer",
      padding: "0",
      flexShrink: "0",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:hover:not(:disabled)": {
      background: "var(--ds-panel-row-hover)",
      color: "var(--ds-panel-value)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 86%, transparent)",
    },
    "&:disabled": {
      opacity: "0.6",
      cursor: "default",
    },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--ds-panel-focus-ring) 54%, transparent)",
      outlineOffset: "1px",
    },
  },
});

export const gitRootCurrent = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: "8px",
      minWidth: 0,
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const gitRootPath = style({
  "@layer": {
    [layers.features]: {
      flex: "1 1 220px",
      minWidth: "0",
      overflowWrap: "anywhere",
      whiteSpace: "normal",
    },
  },
});

export const gitRootPanel = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      padding: "12px",
      borderRadius: "16px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 72%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      boxShadow:
        "0 18px 38px -34px color-mix(in srgb, var(--ds-shadow-color) 38%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
    },
  },
});

export const gitRootActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      alignItems: "center",
    },
  },
});

export const gitRootButton = style({
  "@layer": {
    [layers.features]: {
      padding: "7px 11px",
      fontSize: "var(--font-size-fine)",
      borderRadius: "10px",
    },
  },
});

export const gitRootButtonIconButton = style({
  "@layer": {
    [layers.features]: { display: "inline-flex", alignItems: "center", gap: "6px" },
  },
});

export const gitRootButtonIcon = style({
  "@layer": {
    [layers.features]: { width: "12px", height: "12px" },
  },
});

export const gitRootDepth = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const gitRootSelect = style({
  "@layer": {
    [layers.features]: {
      padding: "5px 22px 5px 8px",
      borderRadius: "7px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 68%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 48%, transparent)",
      color: "var(--ds-panel-value)",
      fontSize: "var(--font-size-fine)",
    },
  },
});

export const gitRootList = style({
  "@layer": {
    [layers.features]: { display: "flex", flexDirection: "column", gap: "6px" },
  },
});

export const gitRootItem = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      textAlign: "left",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 62%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 48%, transparent)",
      color: "var(--ds-panel-value)",
      padding: "8px 10px",
      borderRadius: "10px",
      fontSize: "var(--font-size-fine)",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
    },
  },
  selectors: {
    "&:hover": {
      background: "var(--ds-panel-row-hover)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
    },
  },
});

export const gitRootItemActive = style({
  "@layer": {
    [layers.features]: {
      background: "color-mix(in srgb, var(--ds-panel-selected) 72%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
      boxShadow:
        "inset 0 0 0 1px color-mix(in srgb, var(--ds-panel-section-divider) 22%, transparent)",
    },
  },
});

export const gitRootTag = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      color: "var(--ds-panel-muted)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
  },
});

export const diffStatus = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
      overflowWrap: "anywhere",
    },
  },
});

export const diffStatusIssues = style({
  "@layer": {
    [layers.features]: { display: "inline-flex", alignItems: "center", gap: "6px" },
  },
});

export const diffList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      overflowY: "auto",
      flex: "1",
      paddingRight: "0",
      minHeight: "0",
      scrollbarWidth: "thin",
    },
  },
});

export const diffEmpty = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "104px",
      padding: "18px 16px",
      borderRadius: "16px",
      border: "1px dashed color-mix(in srgb, var(--ds-panel-section-divider) 56%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 66%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
      textAlign: "center",
      lineHeight: typographyValues.content.lineHeight,
      textWrap: "pretty",
    },
  },
});

export const panelSpinner = style({
  "@layer": {
    [layers.features]: {
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      border: "2px solid color-mix(in srgb, var(--ds-panel-section-divider) 68%, transparent)",
      borderTopColor: "var(--ds-panel-value)",
      animation: `${spin} 0.9s linear infinite`,
    },
  },
});

export const logSync = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
      display: "inline-flex",
      flexWrap: "wrap",
      gap: "6px",
    },
  },
});

export const list = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      minHeight: "0",
    },
  },
});

export const logSectionList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
  },
});

export const issueEntry = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "10px 11px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      borderRadius: "12px",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 64%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      color: "inherit",
      textDecoration: "none",
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
  },
});

export const issueSummary = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "8px",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-panel-value)",
      alignItems: "baseline",
      flexWrap: "wrap",
    },
  },
});

export const issueNumber = style({
  "@layer": {
    [layers.features]: {
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
      color: "var(--ds-panel-muted)",
    },
  },
});

export const issueTitle = style({
  "@layer": {
    [layers.features]: {
      flex: "1",
      minWidth: "0",
      whiteSpace: "normal",
    },
  },
});

export const issueDate = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-panel-subtitle)",
    },
  },
});

export const entryActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      alignItems: "center",
    },
  },
});

export const entryActionButton = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
    },
  },
});

export const pullRequestEntry = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "10px 11px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 58%, transparent)",
      width: "100%",
      font: "inherit",
      color: "inherit",
      textDecoration: "none",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 64%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      textAlign: "left",
      cursor: "pointer",
      boxShadow: "none",
      outline: "none",
      transform: "none",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth)",
      borderRadius: "12px",
      minWidth: "0",
    },
  },
  selectors: {
    "&:hover, &:focus-visible": {
      background: "var(--ds-panel-row-hover)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
      boxShadow: "none",
      outline: "none",
    },
    '&[data-selected="true"]': {
      background: "color-mix(in srgb, var(--ds-panel-selected) 72%, transparent)",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
      boxShadow:
        "inset 0 0 0 1px color-mix(in srgb, var(--ds-panel-section-divider) 24%, transparent)",
    },
  },
});

export const pullRequestSelectButton = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      width: "100%",
      padding: 0,
      border: "none",
      background: "transparent",
      font: "inherit",
      color: "inherit",
      textAlign: "left",
      cursor: "pointer",
    },
  },
  selectors: {
    "&:focus": {
      outline: "none",
    },
  },
});

export const pullRequestHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "8px",
      minWidth: "0",
    },
  },
});

export const pullRequestTitle = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "baseline",
      gap: "6px",
      minWidth: "0",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-panel-value)",
    },
  },
});

export const pullRequestTitleText = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      whiteSpace: "normal",
      lineHeight: typographyValues.meta.lineHeight,
      overflowWrap: "anywhere",
    },
  },
});

export const pullRequestNumber = style({
  "@layer": {
    [layers.features]: {
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
      color: "var(--ds-panel-muted)",
    },
  },
});

export const pullRequestAuthor = style({
  "@layer": {
    [layers.features]: {
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
      color: "var(--ds-panel-muted)",
    },
  },
});

export const pullRequestTime = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-panel-subtitle)",
      whiteSpace: "nowrap",
    },
  },
});

export const pullRequestMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      alignItems: "center",
      minWidth: "0",
    },
  },
});

export const commitSection = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      marginBottom: "4px",
      padding: "12px",
      borderRadius: "16px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 56%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 74%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      boxShadow:
        "0 18px 38px -34px color-mix(in srgb, var(--ds-shadow-color) 36%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
    },
  },
});

export const commitInputWrapper = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
    },
  },
});

export const commitInput = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--code-font-size)",
      lineHeight: typographyValues.content.lineHeight,
      color: "var(--ds-panel-value)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 44%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 68%, transparent)",
      borderRadius: "10px",
      padding: "8px 36px 8px 10px",
      resize: "vertical",
      minHeight: "48px",
      maxHeight: "120px",
      transition:
        "border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
  selectors: {
    "&::placeholder": {
      color: "var(--ds-panel-muted)",
    },
    "&:focus": {
      outline: "none",
      borderColor: "color-mix(in srgb, var(--ds-panel-section-divider) 84%, transparent)",
      boxShadow: "0 0 0 1px color-mix(in srgb, var(--ds-panel-focus-ring) 22%, transparent)",
      color: "var(--ds-panel-value)",
    },
    "&:disabled": {
      opacity: "0.5",
      cursor: "not-allowed",
    },
  },
});

export const commitGenerateButton = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "6px",
      right: "6px",
      width: "26px",
      height: "26px",
      minWidth: "26px",
      padding: "0",
      borderRadius: "4px",
      border: "1px solid transparent",
      background: "transparent",
      color: "var(--ds-panel-muted)",
      boxShadow: "none",
      transition:
        "background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
  selectors: {
    "&:hover:not(:disabled)": {
      background: "var(--ds-panel-row-hover)",
      color: "var(--ds-panel-value)",
      boxShadow: "none",
    },
    "&:disabled": {
      boxShadow: "none",
    },
  },
});

export const commitMessageLoader = style({
  "@layer": {
    [layers.features]: {
      width: "14px",
      height: "14px",
      animation: `${spin} 1s linear infinite`,
    },
  },
});

export const actionSpinner = style({
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

export const pushSection = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      marginBottom: "4px",
      padding: "12px",
      borderRadius: "16px",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 56%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-section-bg) 74%, transparent), color-mix(in srgb, var(--ds-surface-card) 96%, transparent))",
      boxShadow:
        "0 18px 38px -34px color-mix(in srgb, var(--ds-shadow-color) 36%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)",
    },
  },
});

export const pushSectionFirst = style({
  selectors: {
    [`${diffList} > &`]: {
      paddingTop: "1px",
    },
  },
});

export const pushSyncButtons = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
    },
  },
});

export const pushButton = style({
  "@layer": {
    [layers.features]: {
      minHeight: "34px",
      gap: "6px",
      flex: "1",
    },
  },
});

export const pushCount = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "18px",
      height: "18px",
      padding: "0 5px",
      fontSize: "var(--font-size-micro)",
      fontWeight: "600",
      color: "var(--ds-panel-value)",
      background: "color-mix(in srgb, var(--ds-panel-section-bg) 56%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-panel-section-divider) 62%, transparent)",
      borderRadius: "9px",
    },
  },
});
