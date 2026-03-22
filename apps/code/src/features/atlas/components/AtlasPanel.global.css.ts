import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

function feature(selector: string, rule: Record<string, unknown>) {
  globalStyle(selector, { "@layer": { [layers.features]: rule } } as unknown as GlobalStyleRule);
}

feature(".atlas-panel", { display: "flex", flexDirection: "column", minHeight: "0" });
feature(".atlas-panel-meta", {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  marginLeft: "auto",
});
feature(".atlas-panel-meta-text", {
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-faint)",
});
feature(".atlas-panel-toggle", {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  cursor: "pointer",
  "-webkit-app-region": "no-drag",
});
feature(".atlas-panel-toggle-input", {
  margin: "0",
  width: "13px",
  height: "13px",
  accentColor: "var(--accent-primary)",
});
feature(".atlas-panel-toggle-input:disabled", { cursor: "default", opacity: "0.6" });
feature(".atlas-panel-toggle-input:disabled + .atlas-panel-toggle-label", { opacity: "0.6" });
feature(".atlas-panel-toggle-label", { whiteSpace: "nowrap", userSelect: "none" });

feature(".atlas-panel-scroll", {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "10px",
  overflow: "auto",
  minHeight: "0",
});
feature(".atlas-panel-presets", {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  justifyContent: "space-between",
  flexWrap: "wrap",
});
feature(".atlas-panel-preset-group", {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
});
feature(".atlas-panel-detail-group", {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
  marginLeft: "auto",
});
feature(".atlas-panel-detail", {
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 90%, transparent)",
  color: "var(--ds-text-muted)",
  borderRadius: "999px",
  padding: "3px 9px",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-125)",
  "-webkit-app-region": "no-drag",
});
feature(".atlas-panel-detail.is-active", {
  color: "var(--ds-text-strong)",
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 82%, transparent)",
});
feature(".atlas-panel-detail:hover:not(:disabled)", {
  color: "var(--ds-text-strong)",
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 65%, transparent)",
});
feature(".atlas-panel-detail:disabled", {
  opacity: "0.5",
  cursor: "default",
});

feature(".atlas-panel-preset, .atlas-panel-reset", {
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  borderRadius: "999px",
  padding: "3px 9px",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-125)",
  "-webkit-app-region": "no-drag",
});
feature(".atlas-panel-preset", {
  background: "color-mix(in srgb, var(--ds-surface-control) 90%, transparent)",
  color: "var(--ds-text-muted)",
});
feature(".atlas-panel-preset.is-active", {
  color: "var(--ds-text-strong)",
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 70%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 82%, transparent)",
});
feature(".atlas-panel-preset:hover:not(:disabled), .atlas-panel-reset:hover:not(:disabled)", {
  color: "var(--ds-text-strong)",
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 65%, transparent)",
});
feature(".atlas-panel-preset:disabled, .atlas-panel-reset:disabled", {
  opacity: "0.5",
  cursor: "default",
});
feature(".atlas-panel-reset", { background: "transparent", color: "var(--ds-text-faint)" });

feature(".atlas-driver-row", {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-item) 86%, transparent)",
  borderRadius: "10px",
  padding: "8px",
  transition:
    "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth)",
});
feature(".atlas-driver-row.is-editable", { cursor: "grab" });
feature(".atlas-driver-row.is-dragging", { opacity: "0.6", cursor: "grabbing" });
feature(".atlas-driver-row.is-drop-target", {
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 75%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 80%, transparent)",
});
feature(".atlas-driver-header", {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: "0",
});
feature(".atlas-driver-position", {
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-fine)",
  fontVariantNumeric: "tabular-nums",
  minWidth: "20px",
});
feature(".atlas-driver-title", {
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
feature(".atlas-driver-summary", {
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-145)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  "-webkit-line-clamp": "2",
  "-webkit-box-orient": "vertical",
});
feature(".atlas-driver-controls", { display: "inline-flex", gap: "4px", marginLeft: "auto" });
feature(".atlas-driver-control", {
  width: "22px",
  height: "22px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 90%, transparent)",
  color: "var(--ds-text-muted)",
  borderRadius: "6px",
  padding: "0",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--font-size-meta)",
  lineHeight: "var(--line-height-100)",
  "-webkit-app-region": "no-drag",
});
feature(".atlas-driver-control:hover:not(:disabled)", {
  color: "var(--ds-text-strong)",
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 65%, transparent)",
});
feature(".atlas-driver-control:disabled", { opacity: "0.45", cursor: "default" });

feature(".atlas-panel-empty", {
  color: "var(--ds-text-faint)",
  fontSize: "var(--font-size-meta)",
  padding: "10px",
});
