import { semanticColors } from "@ku0/design-system";
import { keyframes, style, styleVariants } from "@vanilla-extract/css";

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
  gridTemplateRows: "auto minmax(0, 1fr) auto auto auto",
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
  transition:
    "grid-template-columns var(--duration-slow) var(--ds-motion-ease-standard, var(--ease-smooth))",
};

export const mainShell = styleVariants({
  expanded: {
    ...mainShellBase,
    gridTemplateColumns:
      "minmax(0, 1fr) 12px clamp(320px, var(--right-panel-width-live, var(--right-panel-width, 360px)), 440px)",
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
  padding: "0 0 0 var(--main-panel-padding)",
});

export const composerDock = style({
  gridColumn: "1",
  gridRow: 3,
  position: "relative",
  zIndex: 1,
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  padding: "0 0 8px var(--main-panel-padding)",
});

export const rightRail = style({
  gridColumn: "3",
  gridRow: "1 / -1",
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  width: "100%",
  margin: "0",
  position: "relative",
  borderLeft: `1px solid color-mix(in srgb, ${semanticColors.border} 72%, transparent)`,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-panel-bg) 97%, var(--ds-surface-canvas) 3%), color-mix(in srgb, var(--ds-panel-bg) 88%, var(--ds-surface-app) 12%))",
  borderRadius: "0 18px 18px 0",
  overflow: "hidden",
  backdropFilter: "blur(20px)",
  boxShadow: "none",
  transformOrigin: "left center",
  willChange: "transform, opacity",
  contain: "paint",
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

const rightRailEnter = keyframes({
  "0%": {
    opacity: 0,
    transform: "translateX(18px) scaleX(0.986)",
  },
  "72%": {
    opacity: 1,
    transform: "translateX(-1px) scaleX(1.002)",
  },
  "100%": {
    opacity: 1,
    transform: "translateX(0) scaleX(1)",
  },
});

const rightRailExit = keyframes({
  "0%": {
    opacity: 1,
    transform: "translateX(0) scaleX(1)",
  },
  "100%": {
    opacity: 0,
    transform: "translateX(14px) scaleX(0.992)",
  },
});

export const rightRailMotion = styleVariants({
  entering: {
    animation: `${rightRailEnter} 190ms cubic-bezier(0, 0, 0.2, 1) both`,
  },
  open: {
    opacity: 1,
    transform: "translateX(0) scaleX(1)",
  },
  exiting: {
    pointerEvents: "none",
    animation: `${rightRailExit} 170ms cubic-bezier(0.4, 0, 1, 1) both`,
  },
  hidden: {},
});

export const rightRailResizeHandle = style({
  gridColumn: "2",
  gridRow: "1 / -1",
  width: "12px",
  minWidth: "12px",
  justifySelf: "stretch",
  alignSelf: "stretch",
  zIndex: 4,
  margin: "0",
  willChange: "transform, opacity",
  transition:
    "opacity var(--duration-fast) var(--ds-motion-ease-standard, var(--ease-smooth)), transform var(--duration-fast) var(--ds-motion-ease-standard, var(--ease-smooth))",
});

export const rightRailResizeHandleMotion = styleVariants({
  entering: {
    opacity: 0,
    transform: "translateX(4px)",
  },
  open: {
    opacity: 1,
    transform: "translateX(0)",
  },
  exiting: {
    opacity: 0,
    transform: "translateX(3px)",
    pointerEvents: "none",
  },
  hidden: {
    opacity: 0,
    transform: "translateX(4px)",
    pointerEvents: "none",
  },
});
