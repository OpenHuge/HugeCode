import { globalStyle, style } from "@vanilla-extract/css";
import { componentThemeVars, semanticThemeVars } from "../themeSemantics";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style({
  minWidth: 0,
  maxWidth: "100%",
  color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
  fontSize: dsVar("--font-size-title", semanticThemeVars.typography.role.body),
  lineHeight: dsVar("--line-height-content", "1.6"),
});

globalStyle(`${root} p`, {
  marginTop: 0,
  marginBottom: "12px",
  lineHeight: dsVar("--line-height-content", "1.6"),
});

globalStyle(`${root} ul, ${root} ol`, {
  marginTop: 0,
  marginBottom: "12px",
  paddingLeft: "20px",
});

globalStyle(`${root} li`, {
  marginBottom: "4px",
  lineHeight: dsVar("--line-height-content", "1.6"),
});

globalStyle(`${root} p:last-child, ${root} ul:last-child, ${root} ol:last-child`, {
  marginBottom: 0,
});

export const codeBlock = style({
  margin: "12px 0",
  overflow: "hidden",
  borderRadius: dsVar("--ds-radius-lg", semanticThemeVars.radius.lg),
  border: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", semanticThemeVars.color.border.subtle)} 40%, transparent)`,
  background: `color-mix(in srgb, ${dsVar("--ds-surface-card-base", componentThemeVars.surface.surfaceDefault)} 92%, ${dsVar("--ds-surface-muted", componentThemeVars.surface.surfaceSubtle)} 8%)`,
});

globalStyle(`${root} ${codeBlock}:first-child`, {
  marginTop: 0,
});

globalStyle(`${root} ${codeBlock}:last-child`, {
  marginBottom: 0,
});

export const codeBlockHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dsVar("--ds-space-3", semanticThemeVars.space.md),
  minWidth: 0,
  padding: "7px 14px",
  background: dsVar("--ds-surface-card", componentThemeVars.surface.surfaceDefault),
  borderBottom: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", semanticThemeVars.color.border.subtle)} 30%, transparent)`,
});

export const codeBlockLabel = style({
  minWidth: 0,
  fontSize: dsVar("--font-size-fine", semanticThemeVars.typography.role.label),
  fontWeight: "500",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: dsVar("--ds-text-muted", semanticThemeVars.color.text.secondary),
});

export const codeBlockActions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: dsVar("--ds-space-2", semanticThemeVars.space.sm),
  flexShrink: 0,
});

export const codeBlockBody = style({
  margin: 0,
  padding: "14px",
  overflowX: "auto",
  color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
  fontFamily: dsVar("--code-font-family", semanticThemeVars.typography.font.mono),
  fontSize: dsVar("--font-size-chrome", semanticThemeVars.typography.role.label),
  lineHeight: dsVar("--line-height-content", "1.6"),
  scrollbarWidth: "thin",
});

export const tableScroll = style({
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  margin: "12px 0",
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "thin",
  scrollbarGutter: "stable both-edges",
  borderRadius: "12px",
  border: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", semanticThemeVars.color.border.subtle)} 40%, transparent)`,
  background: `color-mix(in srgb, ${dsVar("--ds-surface-card-base", componentThemeVars.surface.surfaceDefault)} 92%, ${dsVar("--ds-surface-muted", componentThemeVars.surface.surfaceSubtle)} 8%)`,
});

globalStyle(`${root} ${tableScroll}:first-child`, {
  marginTop: 0,
});

globalStyle(`${root} ${tableScroll}:last-child`, {
  marginBottom: 0,
});

export const table = style({
  width: "max-content",
  minWidth: "100%",
  borderCollapse: "separate",
  borderSpacing: "0",
  tableLayout: "auto",
  color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
  fontSize: dsVar("--font-size-meta", semanticThemeVars.typography.role.label),
  lineHeight: dsVar("--line-height-content", "1.6"),
});

globalStyle(`${table} thead`, {
  background: `color-mix(in srgb, ${dsVar("--ds-surface-card", componentThemeVars.surface.surfaceDefault)} 76%, ${dsVar("--ds-surface-control", semanticThemeVars.color.control.default)} 24%)`,
});

globalStyle(`${table} tbody tr:nth-child(even)`, {
  background: `color-mix(in srgb, ${dsVar("--ds-surface-muted", componentThemeVars.surface.surfaceSubtle)} 46%, ${dsVar("--ds-surface-card-base", componentThemeVars.surface.surfaceDefault)} 54%)`,
});

globalStyle(`${table} th`, {
  padding: "10px 12px",
  borderBottom: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", semanticThemeVars.color.border.subtle)} 48%, transparent)`,
  background: "inherit",
  color: dsVar("--ds-text-strong", semanticThemeVars.color.text.primary),
  fontSize: dsVar("--font-size-fine", semanticThemeVars.typography.role.caption),
  fontWeight: "650",
  letterSpacing: "0.01em",
  textAlign: "left",
  whiteSpace: "nowrap",
});

globalStyle(`${table} td`, {
  padding: "10px 12px",
  borderBottom: `1px solid color-mix(in srgb, ${dsVar("--ds-border-subtle", semanticThemeVars.color.border.subtle)} 24%, transparent)`,
  color: dsVar("--ds-text-primary", semanticThemeVars.color.text.primary),
  verticalAlign: "top",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
});

globalStyle(`${table} tr:last-child td`, {
  borderBottom: 0,
});

globalStyle(`${table} :is(th, td)[data-markdown-align="center"]`, {
  textAlign: "center",
});

globalStyle(`${table} :is(th, td)[data-markdown-align="right"]`, {
  textAlign: "right",
});
