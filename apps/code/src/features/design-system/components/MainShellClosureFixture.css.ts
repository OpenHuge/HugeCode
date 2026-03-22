import { style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-canvas, var(--color-background)) 96%, transparent), var(--ds-surface-canvas, var(--color-background)))",
  color: "var(--color-foreground)",
});

export const shell = style({
  display: "grid",
  gap: "16px",
  maxWidth: "1120px",
  margin: "0 auto",
});

export const cluster = style({
  display: "grid",
  gap: "14px",
});

export const topbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
});

export const topbarLeading = style({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  minWidth: 0,
});

export const topbarActions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "0",
  borderRadius: "999px",
  border: "1px solid var(--shell-chrome-toolbar-border)",
  background: "var(--shell-chrome-toolbar-bg)",
  boxShadow: "var(--shell-chrome-toolbar-shadow)",
  padding: "4px",
});

export const split = style({
  display: "grid",
  gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
  gap: "16px",
  alignItems: "start",
});

export const sidebarCard = style({
  display: "grid",
  gap: "10px",
});

export const accountCard = style({
  display: "grid",
  gap: "8px",
  padding: "10px 12px",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--ds-surface-muted) 82%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
});

export const accountRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
});

export const accountMeta = style({
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-muted)",
  lineHeight: "var(--line-height-150)",
});

export const homeControls = style({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
});

export const composerDock = style({
  display: "grid",
  gap: "10px",
});

export const composerMenu = style({
  display: "grid",
  gap: "8px",
  minWidth: "240px",
});
