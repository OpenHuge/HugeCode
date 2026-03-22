import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

const featureStyle = (rule: Record<string, unknown>) =>
  style({ "@layer": { [layers.features]: rule } } as Parameters<typeof style>[0]);

export const surface = featureStyle({
  display: "grid",
  gap: "16px",
  padding: "16px",
  gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
  alignItems: "start",
  "@media": {
    "screen and (max-width: 1100px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const listRail = featureStyle({
  minWidth: 0,
});

export const detailRail = featureStyle({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
});

export const detailCard = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "14px",
});

export const chipRow = featureStyle({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

export const contextGrid = featureStyle({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
});

export const section = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  paddingTop: "4px",
});

export const sectionHeader = featureStyle({
  alignItems: "flex-start",
});

export const bodyText = featureStyle({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-160)",
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
});

export const bulletList = featureStyle({
  display: "grid",
  gap: "8px",
  padding: 0,
  margin: 0,
  listStyle: "none",
});

export const bulletItem = featureStyle({
  padding: "10px 12px",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--ds-surface-item) 72%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
});

export const bulletHeadline = featureStyle({
  display: "block",
  fontSize: "var(--font-size-meta)",
  fontWeight: 620,
  color: "var(--ds-text-strong)",
});

export const bulletCopy = featureStyle({
  display: "block",
  marginTop: "4px",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
  color: "var(--ds-text-subtle)",
});

export const actionCard = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const actionTitle = featureStyle({
  margin: 0,
});

export const actionGrid = featureStyle({
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
});

export const actionItem = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "12px",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--ds-surface-item) 72%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
});

export const actionItemTitle = featureStyle({
  fontSize: "var(--font-size-meta)",
  fontWeight: 620,
  color: "var(--ds-text-strong)",
});

export const actionItemBody = featureStyle({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
});

export const emptyState = featureStyle({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-160)",
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
});

export const interventionGrid = featureStyle({
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
});

export const fieldGroup = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const fieldLabel = featureStyle({
  fontSize: "var(--font-size-micro)",
  fontWeight: 650,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

export const interventionActions = featureStyle({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

export const interventionError = featureStyle({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-150)",
  color: "var(--ds-text-danger)",
  textWrap: "pretty",
});

export const failureContext = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 90%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-muted) 60%, transparent)",
});

export const publishHandoff = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  paddingLeft: "4px",
});

export const publishHandoffLabel = featureStyle({
  fontSize: "var(--font-size-sm)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const publishList = featureStyle({
  padding: 0,
  margin: 0,
  listStyle: "none",
  display: "grid",
  gap: "2px",
});

export const publishItem = featureStyle({
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-subtle)",
});

export const cockpit = featureStyle({
  display: "grid",
  gap: "14px",
  padding: "16px",
  borderRadius: "18px",
  border: "1px solid color-mix(in srgb, var(--ds-border-strong) 30%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-accent-primary) 8%, var(--ds-surface-overlay)), color-mix(in srgb, var(--ds-surface-canvas) 98%, transparent))",
});

export const cockpitHeader = featureStyle({
  display: "grid",
  gap: "8px",
});

export const cockpitEyebrow = featureStyle({
  fontSize: "var(--font-size-micro)",
  fontWeight: 650,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

export const cockpitSummary = featureStyle({
  fontSize: "var(--font-size-md)",
  lineHeight: "var(--line-height-140)",
  fontWeight: 620,
  color: "var(--ds-text-stronger)",
  textWrap: "pretty",
});

export const attentionList = featureStyle({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

export const attentionItem = featureStyle({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 10px",
  borderRadius: "999px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-accent-primary) 12%, var(--ds-surface-overlay)), color-mix(in srgb, var(--ds-surface-item) 92%, transparent))",
  border: "1px solid color-mix(in srgb, var(--ds-border-strong) 32%, transparent)",
  fontSize: "var(--font-size-micro)",
  fontWeight: 650,
  color: "var(--ds-text-strong)",
});

export const cockpitGrid = featureStyle({
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
});

export const cockpitPanel = featureStyle({
  display: "grid",
  gap: "8px",
  padding: "12px",
  borderRadius: "16px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 84%, transparent)",
});

export const cockpitPanelTitle = featureStyle({
  fontSize: "var(--font-size-meta)",
  fontWeight: 650,
  color: "var(--ds-text-strong)",
});

export const trajectoryList = featureStyle({
  display: "grid",
  gap: "10px",
  padding: 0,
  margin: 0,
  listStyle: "none",
});

export const trajectoryItem = featureStyle({
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "14px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 78%, transparent)",
});

export const trajectoryHeader = featureStyle({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
});

export const trajectoryLabel = featureStyle({
  fontSize: "var(--font-size-meta)",
  fontWeight: 620,
  color: "var(--ds-text-strong)",
});

export const trajectoryMeta = featureStyle({
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
});

export const evidenceActionRow = featureStyle({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

export const optionList = featureStyle({
  padding: 0,
  margin: 0,
  listStyle: "none",
  display: "grid",
  gap: "10px",
});

export const optionItem = featureStyle({
  padding: "10px 12px",
  borderRadius: "14px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 85%, transparent)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const optionLabelRow = featureStyle({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
});

export const optionLabel = featureStyle({
  fontWeight: 600,
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
});

export const optionDetail = featureStyle({
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-subtle)",
});

export const optionDisabled = featureStyle({
  fontSize: "var(--font-size-small)",
  color: "var(--ds-text-muted)",
});

export const subAgentList = featureStyle({
  padding: 0,
  margin: 0,
  listStyle: "none",
  display: "grid",
  gap: "10px",
});

export const subAgentItem = featureStyle({
  padding: "10px 12px",
  borderRadius: "14px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 80%, transparent)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const subAgentHeader = featureStyle({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
});

export const subAgentLabel = featureStyle({
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const subAgentSummary = featureStyle({
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-subtle)",
});

export const subAgentMeta = featureStyle({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  fontSize: "var(--font-size-micro)",
  color: "var(--ds-text-faint)",
});

export const subAgentMetaItem = featureStyle({
  padding: "2px 6px",
  borderRadius: "10px",
  background: "color-mix(in srgb, var(--ds-surface-item) 85%, transparent)",
});
