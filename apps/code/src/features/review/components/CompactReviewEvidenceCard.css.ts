import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

const featureStyle = (rule: Record<string, unknown>) =>
  style({ "@layer": { [layers.features]: rule } } as Parameters<typeof style>[0]);

export const card = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "12px",
  borderRadius: "16px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 82%, transparent)",
});

export const cardCompact = featureStyle({
  gap: "8px",
  padding: "10px",
});

export const header = featureStyle({
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "flex-start",
  flexWrap: "wrap",
});

export const titleBlock = featureStyle({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
});

export const title = featureStyle({
  margin: 0,
});

export const description = featureStyle({
  margin: 0,
});

export const badgeRow = featureStyle({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

export const fieldGrid = featureStyle({
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
});

export const fieldGridCompact = featureStyle({
  gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
});

export const field = featureStyle({
  display: "grid",
  gap: "4px",
  padding: "8px 10px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-overlay) 88%, transparent)",
});

export const fieldLabel = featureStyle({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-140)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
  fontWeight: 650,
});

export const fieldValue = featureStyle({
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-140)",
  color: "var(--ds-text-strong)",
  fontWeight: 620,
  textWrap: "pretty",
});

export const fieldDetail = featureStyle({
  fontSize: "var(--font-size-micro)",
  lineHeight: "var(--line-height-150)",
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
});
