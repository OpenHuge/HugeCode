import { style, styleVariants } from "@vanilla-extract/css";

export const desktopShell = style({
  display: "grid",
  gridColumn: "1 / -1",
  gridTemplateColumns:
    "minmax(0, var(--sidebar-width, 260px)) var(--sidebar-resize-handle-width, 12px) minmax(0, 1fr)",
  minHeight: 0,
  height: "100%",
  width: "100%",
  padding: "12px 0 12px 12px",
  boxSizing: "border-box",
  gap: "0",
});

export const sidebarPane = style({
  minWidth: 0,
  minHeight: 0,
  display: "flex",
});

export const sidebarResizeHandle = style({
  position: "relative",
  top: "auto",
  bottom: "auto",
  left: "auto",
  width: "12px",
  height: "auto",
  minHeight: 0,
  gridColumn: "2",
  alignSelf: "stretch",
  zIndex: 2,
});

export const mainPane = style({
  minWidth: 0,
  minHeight: 0,
  display: "grid",
  width: "100%",
  height: "100%",
});

export const workspaceShell = style({
  vars: {
    "--main-header-right-overlay-gutter":
      "calc(var(--titlebar-toggle-size, 28px) + var(--titlebar-toggle-side-gap, 12px))",
  },
});

const mainShellBase = {
  display: "grid",
  gridTemplateRows: "var(--main-topbar-height, 48px) minmax(0, 1fr) auto auto auto",
  position: "relative" as const,
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-app) 99%, var(--ds-surface-canvas)), color-mix(in srgb, var(--ds-surface-canvas) 100%, var(--ds-surface-app)))",
  backgroundRepeat: "no-repeat",
  backgroundSize: "auto",
  overflow: "hidden",
  borderRadius: "18px",
  border: "1px solid color-mix(in srgb, var(--ds-panel-border) 72%, transparent)",
  boxShadow:
    "0 18px 40px color-mix(in srgb, var(--ds-brand-background) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)",
};

export const mainShell = styleVariants({
  expanded: {
    ...mainShellBase,
    gridTemplateColumns:
      "minmax(0, 1fr) clamp(320px, var(--right-panel-width-live, var(--right-panel-width, 360px)), 440px)",
  },
  collapsed: {
    ...mainShellBase,
    gridTemplateColumns: "minmax(0, 1fr)",
  },
});

export const timelineSurface = style({
  gridColumn: "1",
  gridRow: 2,
  position: "relative",
  zIndex: 0,
  minHeight: 0,
  minWidth: 0,
  overflow: "visible",
  display: "flex",
  flexDirection: "column",
  margin: "0",
  borderRadius: "0",
  border: "none",
  background: "transparent",
  boxShadow: "none",
  padding: "0 var(--main-panel-padding) 0",
});

export const sidebarExpandToggle = style({
  position: "absolute",
  top: "calc((var(--main-topbar-height, 48px) - var(--titlebar-toggle-size, 28px)) / 2)",
  left: "var(--main-panel-padding)",
  zIndex: 5,
  display: "flex",
  alignItems: "center",
  pointerEvents: "auto",
});

export const rightPanelExpandToggle = style({
  position: "absolute",
  top: "calc((var(--main-topbar-height, 48px) - var(--titlebar-toggle-size, 28px)) / 2)",
  right: "var(--main-panel-padding)",
  zIndex: 5,
  display: "flex",
  alignItems: "center",
  pointerEvents: "auto",
});

export const composerDock = style({
  gridColumn: "1",
  gridRow: 3,
  position: "relative",
  zIndex: 1,
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  padding: "0 var(--main-panel-padding) 8px",
});

export const rightRail = style({
  gridColumn: "2",
  gridRow: "2 / -1",
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  width: "100%",
  margin: "0 12px 14px 8px",
  position: "relative",
  border: "1px solid color-mix(in srgb, var(--ds-panel-border) 72%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-bg) 97%, var(--ds-surface-canvas) 3%), color-mix(in srgb, var(--ds-panel-bg) 88%, var(--ds-surface-app) 12%))",
  borderRadius: "20px",
  overflow: "hidden",
  backdropFilter: "blur(20px)",
  boxShadow:
    "inset 1px 0 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent), 0 20px 42px color-mix(in srgb, var(--ds-brand-background) 12%, transparent)",
  selectors: {
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "0",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--ds-color-white) 6%, transparent), transparent 16%), radial-gradient(circle at top right, color-mix(in srgb, var(--ds-brand-primary) 8%, transparent), transparent 48%)",
      pointerEvents: "none",
    },
  },
});

export const rightRailResizeHandle = style({
  gridColumn: "2",
  gridRow: "2 / -1",
  zIndex: 4,
  margin: "16px 0 16px -1px",
});
