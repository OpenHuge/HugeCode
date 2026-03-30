import { type StyleRule, style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import "./WorkspaceHomeAgentSurface.global.css";

function feature(rule: StyleRule) {
  return style({ "@layer": { [layers.features]: rule } });
}

export const control = feature({
  padding: "12px",
  borderRadius: "var(--ds-radius-md)",
  background: "var(--ds-surface-card-base)",
  border: "1px solid var(--ds-border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow:
    "var(--ds-elevation-1), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 32%, transparent)",
});

export const sectionHeader = feature({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
});

export const sectionTitle = feature({
  fontSize: "var(--font-size-chrome)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const sectionMeta = feature({
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-faint)",
});

export const emptyState = feature({
  border: "1px dashed var(--ds-border-muted)",
  borderRadius: "var(--ds-radius-sm)",
  padding: "8px 10px",
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-faint)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 90%, var(--ds-surface-muted))",
});

export const error = feature({
  border: "1px solid color-mix(in srgb, var(--status-error) 45%, var(--ds-border-muted))",
  borderRadius: "var(--ds-radius-sm)",
  background: "color-mix(in srgb, var(--status-error) 10%, transparent)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  padding: "8px 10px",
});

export const warning = feature({
  border: "1px solid color-mix(in srgb, var(--status-warning) 45%, var(--ds-border-muted))",
  borderRadius: "var(--ds-radius-sm)",
  background: "color-mix(in srgb, var(--status-warning) 10%, transparent)",
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  padding: "7px 9px",
});

export const controlToggles = feature({
  display: "grid",
  gap: "6px",
});

export const controlToggle = feature({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-muted)",
});

export const toggleInput = feature({
  margin: "0",
});

export const controlStatusRow = feature({
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-muted)",
});

export const controlStatusLabel = feature({
  color: "var(--ds-text-faint)",
});

export const controlStatusValue = feature({
  color: "var(--ds-text-strong)",
  textAlign: "right",
});

export const controlSection = feature({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const disclosureSection = feature({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  border: "1px solid var(--ds-border-subtle)",
  borderRadius: "var(--ds-radius-md)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 96%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 100%, var(--ds-surface-canvas)))",
});

export const disclosureToggle = feature({
  width: "100%",
  border: "0",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px",
  textAlign: "left",
});

export const disclosureToggleExpanded = feature({
  borderBottom: "1px solid var(--ds-border-subtle)",
});

export const disclosureCopy = feature({
  display: "grid",
  gap: "4px",
  minWidth: 0,
});

export const disclosureTitle = feature({
  fontSize: "var(--font-size-meta)",
  fontWeight: 600,
  color: "var(--ds-text-strong)",
});

export const disclosureSummary = feature({
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-faint)",
  lineHeight: "var(--line-height-140)",
});

export const disclosureAction = feature({
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  color: "var(--ds-text-muted)",
  whiteSpace: "nowrap",
});

export const disclosureBody = feature({
  padding: "0 12px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});

export const controlGrid = feature({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
  "@media": {
    "(max-width: 640px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const field = feature({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "var(--font-size-meta)",
  color: "var(--ds-text-muted)",
});

export const fieldControl = feature({
  width: "100%",
  borderRadius: "var(--ds-radius-sm)",
  border: "1px solid var(--ds-border-muted)",
  background: "var(--ds-surface-card-base)",
  color: "var(--ds-text-strong)",
  padding: "7px 9px",
  fontSize: "var(--font-size-meta)",
});

export const fieldTextarea = feature({
  width: "100%",
  borderRadius: "var(--ds-radius-sm)",
  border: "1px solid var(--ds-border-muted)",
  background: "var(--ds-surface-card-base)",
  color: "var(--ds-text-strong)",
  padding: "7px 9px",
  fontSize: "var(--font-size-meta)",
  resize: "vertical",
  minHeight: "56px",
});

export const actions = feature({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
});

export const actionButton = feature({
  borderRadius: "var(--ds-radius-sm)",
  border: "1px solid var(--ds-border-muted)",
  background: "var(--ds-surface-control)",
  color: "var(--ds-text-strong)",
  padding: "6px 10px",
  fontSize: "var(--font-size-meta)",
  cursor: "pointer",
});

export const extractionPreview = feature({
  borderRadius: "var(--ds-radius-sm)",
  border: "1px solid var(--ds-border-muted)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 88%, var(--ds-surface-muted) 12%)",
  color: "var(--ds-text-strong)",
  fontFamily: "var(--font-family-mono)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-150)",
  padding: "8px 10px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
