import { style, styleVariants } from "@vanilla-extract/css";
import { typographyValues } from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

export const header = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: 0,
    },
  },
});

export const headerTopRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
      flexWrap: "wrap",
    },
  },
});

export const headerCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minWidth: 0,
      flex: 1,
    },
  },
});

export const headerEyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const headerTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.title.fontSize,
      lineHeight: typographyValues.title.lineHeight,
      fontWeight: 640,
      letterSpacing: "-0.03em",
      color: "var(--ds-text-stronger)",
      textWrap: "balance",
    },
  },
});

export const headerDescription = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "64ch",
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const headerSignals = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      minHeight: "24px",
    },
  },
});

export const section = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      minWidth: 0,
      padding: "14px 16px",
      borderRadius: "18px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-item) 92%, transparent), color-mix(in srgb, var(--ds-surface-base) 97%, transparent))",
    },
  },
});

export const sectionBare = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: 0,
    },
  },
});

export const sectionBody = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      minWidth: 0,
    },
  },
});

export const metaRail = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      width: "100%",
      minWidth: 0,
    },
  },
});

export const statePanel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.32fr) minmax(280px, 0.96fr)",
      gap: "18px",
      width: "100%",
      minWidth: 0,
      padding: "22px 22px 20px",
      borderRadius: "22px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 74%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 99%, transparent), color-mix(in srgb, var(--ds-surface-item) 96%, transparent))",
      selectors: {
        '&[data-core-loop-tone="loading"]': {
          borderColor: "color-mix(in srgb, var(--ds-accent-progress) 24%, transparent)",
        },
        '&[data-core-loop-tone="warning"]': {
          borderColor: "color-mix(in srgb, var(--status-warning) 28%, transparent)",
        },
        '&[data-core-loop-tone="success"]': {
          borderColor: "color-mix(in srgb, var(--ds-status-success) 28%, transparent)",
        },
      },
      "@media": {
        "(max-width: 900px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "16px",
          padding: "18px 18px 16px",
          borderRadius: "18px",
        },
      },
    },
  },
});

export const statePanelCompact = style({
  "@layer": {
    [layers.features]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "14px",
      padding: "18px 18px 17px",
      borderRadius: "18px",
    },
  },
});

export const statePanelGuideMode = style({
  "@layer": {
    [layers.features]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "16px",
      padding: "22px 22px 20px",
      borderRadius: "20px",
      borderColor: "color-mix(in srgb, var(--ds-border-default) 74%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 98%, var(--ds-surface-item))",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-surface-card-base) 84%, transparent)",
      "@media": {
        "(max-width: 900px)": {
          gap: "16px",
          padding: "20px 20px 18px",
          borderRadius: "20px",
        },
      },
    },
  },
});

export const stateCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      alignContent: "start",
      gap: "14px",
      minWidth: 0,
    },
  },
});

export const stateAside = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      alignContent: "start",
      gap: "12px",
      minWidth: 0,
      padding: "4px 0 0 18px",
      borderLeft: "1px solid color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
      "@media": {
        "(max-width: 900px)": {
          paddingLeft: 0,
          borderLeft: "none",
        },
      },
    },
  },
});

export const stateAsideGuide = style({
  "@layer": {
    [layers.features]: {
      gap: "12px",
      padding: 0,
      borderLeft: "none",
    },
  },
});

export const stateStatus = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
      minHeight: "24px",
    },
  },
});

export const stateChecklistTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const stateChecklist = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      margin: 0,
      padding: 0,
      listStyle: "none",
    },
  },
});

export const stateChecklistGuide = style({
  "@layer": {
    [layers.features]: {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "12px",
      "@media": {
        "(max-width: 1120px)": {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        "(max-width: 720px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const stateChecklistItem = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      alignItems: "start",
      gap: "10px",
      minWidth: 0,
      padding: 0,
      color: "var(--ds-text-strong)",
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      textWrap: "pretty",
    },
  },
});

export const stateChecklistItemGuide = style({
  "@layer": {
    [layers.features]: {
      vars: {
        "--core-loop-step-accent": "var(--ds-brand-primary)",
        "--core-loop-step-surface":
          "color-mix(in srgb, var(--ds-surface-card-base) 97%, var(--ds-surface-item))",
        "--core-loop-step-border": "color-mix(in srgb, var(--ds-border-default) 82%, transparent)",
        "--core-loop-step-badge-surface":
          "color-mix(in srgb, var(--ds-surface-card-base) 92%, var(--core-loop-step-accent) 8%)",
        "--core-loop-step-badge-border":
          "color-mix(in srgb, var(--core-loop-step-accent) 18%, var(--ds-border-default))",
        "--core-loop-step-badge-text":
          "color-mix(in srgb, var(--core-loop-step-accent) 54%, var(--ds-text-stronger))",
        "--core-loop-step-title": "var(--ds-text-stronger)",
        "--core-loop-step-detail": "var(--ds-text-subtle)",
        "--core-loop-step-rule":
          "color-mix(in srgb, var(--core-loop-step-accent) 28%, transparent)",
      },
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "12px",
      minHeight: "152px",
      padding: "18px 18px 16px",
      borderRadius: "18px",
      border: "1px solid var(--core-loop-step-border)",
      background: "var(--core-loop-step-surface)",
      position: "relative",
      overflow: "hidden",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-surface-card-base) 74%, transparent)",
      selectors: {
        '&[data-step-tone="skills"]': {
          vars: {
            "--core-loop-step-accent":
              "color-mix(in srgb, var(--ds-text-stronger) 80%, var(--ds-brand-primary) 20%)",
          },
        },
        '&[data-step-tone="commands"]': {
          vars: {
            "--core-loop-step-accent":
              "color-mix(in srgb, var(--ds-status-success) 38%, var(--ds-text-stronger))",
          },
        },
        '&[data-step-tone="mentions"]': {
          vars: {
            "--core-loop-step-accent":
              "color-mix(in srgb, var(--ds-brand-primary) 44%, var(--ds-text-stronger))",
          },
        },
        '&[data-step-tone="queue"]': {
          vars: {
            "--core-loop-step-accent":
              "color-mix(in srgb, var(--status-warning) 42%, var(--ds-text-stronger))",
          },
        },
        '&[data-step-tone="images"]': {
          vars: {
            "--core-loop-step-accent":
              "color-mix(in srgb, var(--status-warning) 28%, var(--ds-brand-primary) 72%)",
          },
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "18px",
          right: "18px",
          height: "1px",
          background: "var(--core-loop-step-rule)",
          pointerEvents: "none",
        },
      },
      "@media": {
        "(max-width: 900px)": {
          minHeight: "144px",
          padding: "16px 16px 15px",
          borderRadius: "18px",
        },
      },
    },
  },
});

export const stateChecklistGuideChip = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      justifyItems: "start",
      alignContent: "start",
      gap: "12px",
      width: "100%",
      minWidth: 0,
      minHeight: "max-content",
      padding: 0,
      border: "none",
      background: "transparent",
    },
  },
});

export const stateChecklistBadge = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "44px",
      height: "44px",
      minWidth: "44px",
      padding: 0,
      borderRadius: "12px",
      border: "1px solid var(--core-loop-step-badge-border)",
      background: "var(--core-loop-step-badge-surface)",
      color: "var(--core-loop-step-badge-text)",
      boxShadow: "none",
      fontWeight: 720,
      letterSpacing: "-0.06em",
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      flexShrink: 0,
    },
  },
});

export const stateChecklistGuideChipLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.ui.fontSize,
      lineHeight: typographyValues.ui.lineHeight,
      fontWeight: 680,
      letterSpacing: "-0.025em",
      color: "var(--core-loop-step-title)",
      textWrap: "balance",
    },
  },
});

export const stateChecklistBody = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      alignContent: "start",
      gap: "8px",
      minWidth: 0,
    },
  },
});

export const stateChecklistLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      fontWeight: 620,
      letterSpacing: "-0.01em",
      color: "color-mix(in srgb, var(--core-loop-step-accent) 38%, var(--ds-text-stronger))",
      textWrap: "balance",
    },
  },
});

export const stateChecklistDetail = style({
  "@layer": {
    [layers.features]: {
      color: "var(--core-loop-step-detail)",
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      maxWidth: "30ch",
      letterSpacing: "0.01em",
      textWrap: "pretty",
    },
  },
});

export const stateChecklistIndex = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "24px",
      height: "24px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-active) 42%, var(--ds-surface-item))",
      color: "var(--ds-text-stronger)",
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      fontWeight: 700,
      letterSpacing: "0.04em",
      flexShrink: 0,
    },
  },
});

export const stateTone = styleVariants({
  default: {},
  loading: {},
  warning: {},
  success: {},
});
