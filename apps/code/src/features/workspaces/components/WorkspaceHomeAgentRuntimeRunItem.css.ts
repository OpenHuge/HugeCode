import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const observabilityRail = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      border: "1px solid color-mix(in srgb, var(--status-success) 18%, var(--ds-border-muted))",
      borderRadius: "var(--ds-radius-md)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 96%, var(--status-success) 4%), color-mix(in srgb, var(--ds-surface-card-base) 88%, var(--ds-surface-muted)))",
      padding: "10px 11px",
    },
  },
});

export const observabilitySummary = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      alignItems: "start",
      "@media": {
        "(max-width: 960px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const observabilityCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minInlineSize: "0",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-meta)",
    },
  },
});

export const observabilityCopyStrong = style({
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});

export const observabilityEyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const observabilityMetrics = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      gridColumn: "1 / -1",
    },
  },
});

export const observabilityMetric = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      minHeight: "24px",
      padding: "0 8px",
      borderRadius: "999px",
      border: "1px solid var(--ds-border-muted)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 92%, var(--ds-surface-muted))",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-fine)",
      fontWeight: 520,
    },
  },
});

export const runHeader = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      alignItems: "start",
    },
  },
});

export const runTitleRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "6px",
    },
  },
});

export const runTitle = style({
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-strong)",
      fontSize: "var(--font-size-meta)",
      fontWeight: 650,
      marginRight: "2px",
    },
  },
});

export const runMetaRail = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "6px",
      minWidth: 0,
    },
  },
});

export const runMetaChip = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "22px",
      padding: "0 8px",
      borderRadius: "999px",
      border: "1px solid color-mix(in srgb, var(--ds-border-muted) 88%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 92%, var(--ds-surface-muted))",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-fine)",
      fontWeight: 560,
      whiteSpace: "nowrap",
    },
  },
});

export const runDetailStack = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-meta)",
      lineHeight: "var(--line-height-140)",
    },
  },
});

export const actionRail = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
    },
  },
});

export const actionGroup = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
    },
  },
});

export const interventionPanel = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "10px",
      border: "1px solid color-mix(in srgb, var(--status-warning) 18%, var(--ds-border-muted))",
      borderRadius: "var(--ds-radius-md)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 97%, var(--status-warning) 3%), color-mix(in srgb, var(--ds-surface-card-base) 90%, var(--ds-surface-muted)))",
      padding: "10px",
    },
  },
});

export const interventionHeader = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-meta)",
    },
  },
});

export const interventionGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "10px",
      "@media": {
        "(max-width: 960px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const interventionField = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "5px",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-fine)",
      minInlineSize: 0,
    },
  },
});

export const interventionInput = style({
  "@layer": {
    [layers.features]: {
      minWidth: 0,
      borderRadius: "var(--ds-radius-sm)",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-strong)",
      padding: "8px 10px",
      fontSize: "var(--font-size-meta)",
    },
  },
});

export const interventionTextarea = style([
  interventionInput,
  {
    "@layer": {
      [layers.features]: {
        minHeight: "76px",
        resize: "vertical",
      },
    },
  },
]);

export const actionButtonBase = style({
  "@layer": {
    [layers.features]: {
      borderRadius: "999px",
      border: "1px solid var(--ds-border-muted)",
      padding: "5px 9px",
      fontSize: "var(--font-size-fine)",
      fontWeight: 600,
      cursor: "pointer",
      transition:
        "background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
      selectors: {
        "&:disabled": {
          opacity: 0.46,
          cursor: "default",
        },
      },
    },
  },
});

export const actionButtonPrimary = style([
  actionButtonBase,
  {
    "@layer": {
      [layers.features]: {
        background: "var(--ds-surface-control)",
        color: "var(--ds-text-strong)",
      },
    },
  },
]);

export const actionButtonSecondary = style([
  actionButtonBase,
  {
    "@layer": {
      [layers.features]: {
        background: "color-mix(in srgb, var(--ds-surface-card-base) 96%, var(--ds-surface-muted))",
        color: "var(--ds-text-muted)",
      },
    },
  },
]);

export const actionButtonAffirm = style([
  actionButtonBase,
  {
    "@layer": {
      [layers.features]: {
        borderColor: "color-mix(in srgb, var(--status-success) 30%, var(--ds-border-muted))",
        background: "color-mix(in srgb, var(--status-success) 10%, var(--ds-surface-card-base))",
        color: "var(--ds-text-strong)",
      },
    },
  },
]);

export const actionButtonDanger = style({
  "@layer": {
    [layers.features]: {
      borderColor: "color-mix(in srgb, var(--status-error) 28%, var(--ds-border-muted))",
      color: "var(--ds-text-strong)",
    },
  },
});

export const observabilityMetricWarning = style([
  observabilityMetric,
  {
    "@layer": {
      [layers.features]: {
        border: "1px solid color-mix(in srgb, var(--status-warning) 42%, var(--ds-border-muted))",
        background: "color-mix(in srgb, var(--status-warning) 10%, transparent)",
        color: "var(--ds-text-strong)",
      },
    },
  },
]);

export const observabilityToggle = style({
  "@layer": {
    [layers.features]: {
      minHeight: "32px",
      borderRadius: "999px",
      border: "1px solid var(--ds-border-muted)",
      background: "var(--ds-surface-card-base)",
      color: "var(--ds-text-strong)",
      padding: "0 12px",
      fontSize: "var(--font-size-meta)",
      fontWeight: 600,
      cursor: "pointer",
      alignSelf: "start",
      whiteSpace: "nowrap",
      "@media": {
        "(max-width: 960px)": {
          width: "100%",
          justifySelf: "stretch",
        },
      },
    },
  },
});

export const observabilityGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "10px",
      "@media": {
        "(max-width: 960px)": {
          gridTemplateColumns: "minmax(0, 1fr)",
        },
      },
    },
  },
});

export const observabilityCard = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      border: "1px solid var(--ds-border-muted)",
      borderRadius: "var(--ds-radius-md)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 95%, var(--ds-surface-muted))",
      padding: "10px",
      alignContent: "start",
    },
  },
});

export const observabilityCardHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      color: "var(--ds-text-muted)",
      fontSize: "var(--font-size-meta)",
    },
  },
});

export const observabilityCardHeaderStrong = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      color: "var(--ds-text-strong)",
      fontSize: "var(--font-size-meta)",
      fontWeight: 600,
    },
  },
});

export const observabilityCardMeta = style({
  "@layer": {
    [layers.features]: { fontSize: "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});

export const subAgentList = style({
  "@layer": { [layers.features]: { display: "grid", gap: "8px" } },
});

export const subAgentCard = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "7px",
      border: "1px solid var(--ds-border-muted)",
      borderRadius: "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "9px",
    },
  },
});

export const subAgentCardHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "start",
      gap: "8px",
    },
  },
});

export const subAgentCardTitle = style({
  "@layer": { [layers.features]: { display: "grid", gap: "3px", minInlineSize: "0" } },
});

export const subAgentCardTitleStrong = style({
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});

export const subAgentCardTitleMeta = style({
  "@layer": {
    [layers.features]: { fontSize: "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});

export const subAgentCardMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px 10px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const subAgentCardActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
    },
  },
});

export const detailList = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "5px",
      margin: 0,
      padding: "0 0 0 16px",
      fontSize: "var(--font-size-meta)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const graphList = style({
  "@layer": {
    [layers.features]: { display: "grid", gap: "8px", margin: 0, padding: 0, listStyle: "none" },
  },
});

export const graphNode = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "6px",
      border: "1px solid var(--ds-border-muted)",
      borderRadius: "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "9px",
    },
  },
});

export const graphNodeHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "start",
      gap: "8px",
    },
  },
});

export const graphNodeTitle = style({
  "@layer": { [layers.features]: { display: "grid", gap: "3px", minInlineSize: "0" } },
});

export const graphNodeTitleStrong = style({
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});

export const graphNodeTitleMeta = style({
  "@layer": {
    [layers.features]: { fontSize: "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});

export const graphNodeMeta = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px 10px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
    },
  },
});

export const eventList = style({
  "@layer": {
    [layers.features]: { display: "grid", gap: "8px", margin: 0, padding: 0, listStyle: "none" },
  },
});

export const eventItem = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "5px",
      border: "1px solid var(--ds-border-muted)",
      borderRadius: "var(--ds-radius-sm)",
      background: "var(--ds-surface-card-base)",
      padding: "8px 9px",
    },
  },
});

export const eventHeader = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "space-between",
      gap: "8px",
      alignItems: "baseline",
      flexWrap: "wrap",
    },
  },
});

export const eventHeaderStrong = style({
  "@layer": { [layers.features]: { color: "var(--ds-text-strong)" } },
});

export const eventHeaderMeta = style({
  "@layer": {
    [layers.features]: { fontSize: "var(--font-size-fine)", color: "var(--ds-text-faint)" },
  },
});
