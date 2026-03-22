import { motionValues, typographyValues } from "@ku0/design-system";
import { style } from "@vanilla-extract/css";
import {
  conversationOptimalWidth,
  conversationOptimalWidthVar,
} from "../../../styles/conversation-layout.css";
import { layers } from "../../../styles/system/layers.css";

export const root = style({
  "@layer": {
    [layers.features]: {
      vars: {
        "--conversation-optimal-width": conversationOptimalWidth,
        "--workspace-thread-lane-width": conversationOptimalWidthVar,
      },
      height: "100%",
      width: "100%",
      gridColumn: "1 / -1",
      gridRow: "1 / -1",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
  },
});

export const homeHeader = style({
  "@layer": {
    [layers.features]: {
      margin: "0",
    },
  },
});

export const homeHeaderIdentity = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "2px",
      minWidth: "0",
      justifyItems: "start",
      textAlign: "left",
      width: "auto",
      maxWidth: "100%",
    },
  },
});

export const homeHeaderEyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const homeHeaderTitle = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "clamp(14px, 0.84rem + 0.24vw, 18px)",
      lineHeight: typographyValues.title.lineHeight,
      fontWeight: 620,
      letterSpacing: "-0.02em",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const content = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      width: "100%",
      maxWidth: "100%",
      margin: "0",
      padding: "0",
      overflow: "hidden",
      position: "relative",
      "@media": {
        "(max-width: 640px)": {
          gap: "8px",
          padding: "0",
        },
      },
    },
  },
});

export const scrollArea = style({
  "@layer": {
    [layers.features]: {
      flex: "1",
      minHeight: 0,
      overflowY: "auto",
      overflowX: "hidden",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
      scrollbarWidth: "thin",
      padding: "8px 0 20px",
      position: "relative",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-app) 99%, var(--ds-surface-canvas)), color-mix(in srgb, var(--ds-surface-canvas) 100%, var(--ds-surface-app)))",
      backgroundRepeat: "no-repeat",
      "@media": {
        "(max-width: 640px)": {
          paddingBottom: "0",
        },
      },
    },
  },
});

export const dashboardWidgets = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      maxWidth: "920px",
      padding: "0 20px 40px",
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      "@media": {
        "(max-width: 640px)": {
          padding: "0 12px 20px",
          gap: "12px",
        },
      },
    },
  },
});

export const dashboardSection = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      "@media": {
        "(max-width: 640px)": {
          minHeight: "auto",
          padding: "12px",
          borderRadius: "20px",
          flex: "0 0 auto",
        },
      },
    },
  },
});

export const missionSectionTitle = style({
  "@layer": {
    [layers.features]: {
      whiteSpace: "nowrap",
      fontSize: "clamp(15px, 0.9rem + 0.35vw, 18px)",
      lineHeight: typographyValues.title.lineHeight,
      fontWeight: 620,
      letterSpacing: "-0.02em",
      textTransform: "none",
      color: "var(--ds-text-stronger)",
    },
  },
});

export const missionSectionMeta = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      color: "var(--ds-text-faint)",
      fontSize: "var(--font-size-micro)",
      fontWeight: "600",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    },
  },
});

export const missionSectionStatus = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      minWidth: 0,
      whiteSpace: "nowrap",
      padding: "2px 0",
    },
  },
});

export const missionSectionStatusLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const missionSectionStatusBadge = style({
  "@layer": {
    [layers.features]: {
      selectors: {
        "&[data-status-tone='progress']": {
          boxShadow: "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
        },
      },
    },
  },
});

export const missionSectionActions = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "8px",
    },
  },
});

export const launchpadSetupGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(260px, 0.88fr) minmax(320px, 1.12fr)",
      gap: "6px",
      alignItems: "start",
      "@media": {
        "(max-width: 980px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const launchpadSetupItem = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
    },
  },
});

export const launchpadSetupItemFullSpan = style({
  "@layer": {
    [layers.features]: {
      gridColumn: "1 / -1",
    },
  },
});

export const workspaceSummaryPanel = style({
  "@layer": {
    [layers.features]: {
      minHeight: "0",
      borderRadius: "20px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 66%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 96%, white 4%), color-mix(in srgb, var(--ds-surface-panel) 98%, transparent))",
      boxShadow:
        "0 14px 28px color-mix(in srgb, var(--ds-brand-background) 6%, transparent), inset 0 1px 0 color-mix(in srgb, white 16%, transparent)",
    },
  },
});

export const missionGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "10px",
      paddingBottom: "0",
      "@media": {
        "(max-width: 980px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
        "(max-width: 640px)": {
          gap: "8px",
        },
      },
    },
  },
});

export const missionTile = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      alignItems: "flex-start",
      gap: "8px",
      minHeight: "0",
      minWidth: "0",
      padding: "14px 14px 13px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 68%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 94%, white 6%), color-mix(in srgb, var(--ds-surface-panel) 98%, transparent))",
      boxShadow:
        "0 12px 26px color-mix(in srgb, var(--ds-brand-background) 5%, transparent), inset 0 1px 0 color-mix(in srgb, white 14%, transparent)",
      textAlign: "left",
    },
  },
});

export const missionTileButton = style({
  "@layer": {
    [layers.features]: {
      appearance: "none",
      WebkitAppearance: "none",
      cursor: "pointer",
      transition: motionValues.interactive,
      selectors: {
        "&:hover:not(:disabled), &:focus-visible": {
          borderColor: "color-mix(in srgb, var(--ds-border-strong) 56%, transparent)",
          background: "var(--ds-surface-elevated)",
          transform: "none",
          boxShadow: "none",
          outline: "none",
        },
        "&:disabled": {
          cursor: "default",
          opacity: "0.76",
        },
      },
    },
  },
});

export const missionTileCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minWidth: "0",
    },
  },
});

export const missionTileLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-micro)",
      fontWeight: "650",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "var(--ds-text-faint)",
      minWidth: "0",
      textWrap: "balance",
    },
  },
});

export const missionTileTrailing = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "6px",
      minWidth: "0",
    },
  },
});

export const missionTileValue = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(1.4rem, 1.1rem + 1vw, 2.15rem)",
      fontWeight: "700",
      lineHeight: typographyValues.displaySm.lineHeight,
      letterSpacing: "-0.04em",
      color: "var(--ds-text-stronger)",
      whiteSpace: "nowrap",
      flexShrink: "0",
      textAlign: "left",
      selectors: {
        '&[data-tone="success"]': {
          color: "color-mix(in srgb, var(--status-success) 72%, white)",
        },
        '&[data-tone="warning"]': {
          color: "color-mix(in srgb, var(--status-warning) 76%, white)",
        },
        '&[data-tone="accent"]': {
          color: "color-mix(in srgb, var(--ds-brand-primary) 82%, white)",
        },
      },
    },
  },
});

export const missionTileDetail = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      color: "var(--ds-text-muted)",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: "1",
      overflow: "hidden",
      textOverflow: "ellipsis",
      textWrap: "pretty",
      minHeight: "0",
    },
  },
});

export const missionTileAction = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "22px",
      padding: "0 8px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-item) 94%, transparent)",
      fontSize: typographyValues.chrome.fontSize,
      lineHeight: typographyValues.chrome.lineHeight,
      fontWeight: "600",
      color: "var(--ds-text-strong)",
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
      selectors: {
        '&[data-tone="success"]': {
          borderColor: "color-mix(in srgb, var(--status-success) 28%, transparent)",
          background: "color-mix(in srgb, var(--status-success) 10%, transparent)",
          color: "color-mix(in srgb, var(--status-success) 70%, white)",
        },
        '&[data-tone="warning"]': {
          borderColor: "color-mix(in srgb, var(--status-warning) 30%, transparent)",
          background: "color-mix(in srgb, var(--status-warning) 11%, transparent)",
          color: "color-mix(in srgb, var(--status-warning) 82%, white)",
        },
        '&[data-tone="accent"]': {
          borderColor: "color-mix(in srgb, var(--ds-brand-primary) 28%, transparent)",
          background: "color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)",
          color: "color-mix(in srgb, var(--ds-brand-primary) 82%, white)",
        },
      },
    },
  },
});

export const dashboardGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
    },
  },
});

export const dashboardCardButton = style({
  "@layer": {
    [layers.features]: {
      appearance: "none",
      WebkitAppearance: "none",
      border: "none",
      background: "transparent",
      display: "block",
      width: "100%",
      padding: "0",
      margin: "0",
      font: "inherit",
      color: "inherit",
      textAlign: "left",
    },
  },
});

export const dashboardCard = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: "10px",
      minHeight: "0",
      padding: "12px 14px",
      borderRadius: "14px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 74%, transparent)",
      background: "var(--ds-surface-card)",
      boxShadow: "none",
      transition: motionValues.interactive,
      selectors: {
        [`${dashboardCardButton}:hover &, ${dashboardCardButton}:focus-visible &`]: {
          background: "var(--ds-surface-elevated)",
          borderColor: "color-mix(in srgb, var(--ds-border-strong) 70%, transparent)",
        },
      },
      "@media": {
        "(max-width: 720px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const dashboardCardMain = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minWidth: "0",
    },
  },
});

export const dashboardCardStatusRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "flex-end",
      minWidth: "0",
      "@media": {
        "(max-width: 720px)": {
          justifyContent: "flex-start",
        },
      },
    },
  },
});

export const dashboardCardHeading = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
      minWidth: "0",
    },
  },
});

export const dashboardCardTitleRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
      minWidth: "0",
    },
  },
});

export const dashboardCardTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-label)",
      fontWeight: 620,
      color: "var(--ds-text-stronger)",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const dashboardCardGroup = style({
  "@layer": {
    [layers.features]: {
      letterSpacing: "normal",
      textTransform: "none",
    },
  },
});

export const dashboardCardMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      color: "var(--ds-text-faint)",
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
      flexShrink: "0",
    },
  },
});

export const dashboardCardMessage = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-strong)",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: "2",
      overflow: "hidden",
      textOverflow: "ellipsis",
      textWrap: "pretty",
    },
  },
});

export const dashboardCardDetail = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      color: "var(--ds-text-faint)",
      textWrap: "pretty",
    },
  },
});

export const dashboardCardStatus = style({
  "@layer": {
    [layers.features]: {
      alignSelf: "flex-start",
      textTransform: "none",
      letterSpacing: "normal",
    },
  },
});

export const composerDock = style({
  "@layer": {
    [layers.features]: {
      position: "relative",
      zIndex: "1",
      flexShrink: 0,
      paddingTop: "8px",
      paddingBottom: "12px",
      selectors: {
        "&::before": {
          content: "none",
        },
      },
    },
  },
});

export const emptyPanel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minHeight: "0",
      borderRadius: "14px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 66%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 96%, white 4%), color-mix(in srgb, var(--ds-surface-card-base) 98%, transparent))",
    },
  },
});

export const emptyPanelTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-label)",
      fontWeight: "600",
      color: "var(--ds-text-strong)",
    },
  },
});

export const emptyPanelBody = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-muted)",
      textWrap: "pretty",
    },
  },
});
