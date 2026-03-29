import { typographyValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";
import { applyGlobalStyle } from "../../../styles/system/globalStyleHelpers";
import { layers } from "../../../styles/system/layers.css";

export const nav = style({
  "@layer": {
    [layers.features]: {
      marginTop: "0",
      marginLeft: "0",
      marginRight: "0",
      marginBottom: "2px",
      padding: "9px 10px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      background: "color-mix(in srgb, var(--ds-surface-item) 96%, transparent)",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 44%, transparent)",
      color: "var(--ds-text-strong)",
      cursor: "pointer",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      width: "100%",
      textAlign: "left",
      transform: "none",
      boxShadow: "0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 6%, transparent)",
      selectors: {
        '&:hover, &[data-open="true"]': {
          background: "color-mix(in srgb, var(--ds-surface-hover) 92%, var(--ds-surface-item))",
          borderColor: "color-mix(in srgb, var(--ds-border-default) 52%, transparent)",
          boxShadow: "0 2px 6px color-mix(in srgb, var(--ds-shadow-color) 10%, transparent)",
          transform: "translateY(-0.5px)",
        },
        '&[data-account-state="disconnected"]': {
          background: "color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent)",
          borderColor: "color-mix(in srgb, var(--ds-border-default) 48%, transparent)",
        },
        '&[data-account-state="available"]': {
          borderColor: "color-mix(in srgb, var(--ds-text-accent) 18%, var(--ds-border-subtle))",
        },
        "&:active:not(:disabled), &:focus-visible": {
          transform: "none",
          outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
          outlineOffset: "2px",
        },
      },
    },
  },
});

applyGlobalStyle(`.${nav}`, {
  "@layer": {
    [layers.features]: {
      "-webkit-app-region": "no-drag",
    },
  },
});

export const avatar = style({
  "@layer": {
    [layers.features]: {
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: "color-mix(in srgb, var(--ds-surface-control) 70%, transparent)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ds-text-strong)",
      flexShrink: "0",
      selectors: {
        [`${nav}[data-account-state="disconnected"] &`]: {
          background: "color-mix(in srgb, var(--ds-surface-control) 84%, transparent)",
          color: "var(--ds-text-muted)",
        },
      },
    },
  },
});

export const info = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
      flex: "1",
      gap: "0",
    },
  },
});

export const name = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-label)",
      fontWeight: "400",
      color: "var(--ds-text-strong)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      lineHeight: typographyValues.label.lineHeight,
      selectors: {
        [`${nav}[data-account-state="disconnected"] &`]: {
          fontWeight: "500",
        },
      },
    },
  },
});

export const workspace = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
      lineHeight: typographyValues.meta.lineHeight,
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      minWidth: "0",
      selectors: {
        [`${nav}[data-account-state="disconnected"] &`]: {
          color: "var(--ds-text-faint)",
        },
      },
    },
  },
});

export const workspaceIcon = style({
  "@layer": {
    [layers.features]: {
      width: "12px",
      height: "12px",
      flexShrink: "0",
    },
  },
});

export const workspaceText = style({
  "@layer": {
    [layers.features]: {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
});

export const menuWrapper = style({
  "@layer": {
    [layers.features]: {
      position: "fixed",
      left: "8px",
      bottom: "72px",
      width: "min(calc(var(--sidebar-width, 260px) + 16px), 324px)",
      maxWidth: "calc(100vw - 16px)",
      zIndex: "50",
    },
  },
});

export const menu = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      vars: {
        "--ds-popover-item-radius": "6px",
        "--ds-popover-item-padding-block": "7px",
        "--ds-popover-item-padding-inline": "10px",
        "--ds-popover-item-gap": "8px",
        "--ds-popover-item-hit-area": "36px",
        "--ds-popover-item-font-size": "var(--font-size-chrome)",
        "--ds-popover-item-font-weight": "460",
        "--ds-popover-item-text": "var(--ds-text-strong)",
        "--ds-popover-item-text-active": "var(--ds-text-stronger)",
        "--ds-popover-item-hover":
          "color-mix(in srgb, var(--ds-surface-control-hover) 76%, var(--ds-surface-item))",
        "--ds-popover-item-hover-border":
          "color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
        "--ds-popover-item-icon-size": "18px",
        "--ds-popover-item-icon-color": "var(--ds-text-muted)",
      },
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
      padding: "8px",
      borderRadius: "14px",
      background: "color-mix(in srgb, var(--ds-popover-bg) 96%, var(--ds-surface-base))",
      boxShadow: "none",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      backdropFilter: "none",
      selectors: {
        "[data-radix-popper-content-wrapper] &": {
          marginLeft: "0",
          width: "324px",
        },
      },
    },
  },
});

export const divider = style({
  "@layer": {
    [layers.features]: {
      display: "none",
    },
  },
});

export const usage = style({
  "@layer": {
    [layers.features]: {
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      borderRadius: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-item) 96%, transparent)",
    },
  },
});

export const usageItem = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
  },
});

export const usageRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      fontWeight: "500",
    },
  },
});

export const usageProgress = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      display: "block",
      width: "100%",
      height: "3px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-control) 40%, transparent)",
      overflow: "hidden",
    },
  },
});

export const usageProgressIndicator = style({
  "@layer": {
    [layers.features]: {
      position: "absolute",
      top: "0",
      left: "0",
      height: "100%",
      width: "var(--progress-width, 0%)",
      borderRadius: "999px",
      background: "var(--status-success)",
      transition: "width var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
    },
  },
});

export const usageProgressIndicatorWeekly = style({
  "@layer": {
    [layers.features]: {
      background: "var(--ds-text-accent)",
    },
  },
});

export const usageEmpty = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
    },
  },
});

export const usageMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "3px",
      paddingTop: "4px",
    },
  },
});

export const usageMetaLine = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      color: "var(--ds-text-faint)",
    },
  },
});

export const accountCard = style({
  "@layer": {
    [layers.features]: {
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      borderRadius: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-item) 96%, transparent)",
    },
  },
});

export const accountCardHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    },
  },
});

export const accountCardTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-label)",
      fontWeight: "600",
      color: "var(--ds-text-strong)",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const accountCardBadge = style({
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
    },
  },
});

export const accountCardMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      lineHeight: typographyValues.fine.lineHeight,
    },
  },
});

export const accountCardError = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-danger)",
    },
  },
});

export const accountCardActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    },
  },
});

export const accountCardStatus = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const accountPrimaryAction = style({
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
      color: "var(--ds-text-strong)",
      padding: "8px 10px",
      borderRadius: "8px",
      fontSize: "var(--font-size-chrome)",
      fontWeight: "500",
      cursor: "pointer",
      textAlign: "left",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:hover": {
          background: "color-mix(in srgb, var(--ds-surface-hover) 92%, var(--ds-surface-control))",
          borderColor: "color-mix(in srgb, var(--ds-border-default) 52%, transparent)",
          color: "var(--ds-text-stronger)",
        },
      },
    },
  },
});

export const accountChooser = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
  },
});

export const accountChooserLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const accountChooserHint = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-faint)",
      lineHeight: typographyValues.fine.lineHeight,
    },
  },
});

export const accountChooserList = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
  },
});

export const accountChoice = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      padding: "8px 10px",
      borderRadius: "8px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-item) 94%, transparent)",
      color: "var(--ds-text-strong)",
      cursor: "pointer",
      textAlign: "left",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:hover:not(:disabled)": {
          background: "var(--ds-surface-item-hover)",
          borderColor: "color-mix(in srgb, var(--ds-border-default) 52%, transparent)",
        },
        "&:disabled": {
          opacity: "0.56",
          cursor: "default",
        },
      },
    },
  },
});

export const accountChoiceMain = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
  },
});

export const accountChoiceTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-chrome)",
      fontWeight: "600",
      color: "var(--ds-text-strong)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const accountChoiceMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const accountChoiceBadges = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: "6px",
      flexShrink: "0",
    },
  },
});

export const accountChoiceBadge = style({
  "@layer": {
    [layers.features]: {
      flexShrink: "0",
    },
  },
});

export const accountChooserEmpty = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      padding: "8px 10px",
      borderRadius: "8px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 52%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-item) 96%, transparent)",
    },
  },
});

export const accountChooserActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "flex-start",
    },
  },
});

export const accountInlineAction = style({
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 56%, transparent)",
      background: "transparent",
      color: "var(--ds-text-strong)",
      padding: "4px 8px",
      borderRadius: "6px",
      fontSize: "var(--font-size-fine)",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:hover:not(:disabled)": {
          background: "var(--ds-surface-item-hover)",
        },
        "&:disabled": {
          opacity: "0.4",
          cursor: "default",
        },
      },
    },
  },
});
