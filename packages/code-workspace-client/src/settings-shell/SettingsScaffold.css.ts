import { style } from "@vanilla-extract/css";

const mobileBreakpoint = "(max-width: 720px)";

export const scaffold = style({
  flex: 1,
  minHeight: 0,
});

export const mobileMasterDetail = style({});

export const detailVisible = style({});

export const splitPanel = style({
  height: "100%",
  minHeight: 0,
  gridTemplateColumns: "216px minmax(0, 1fr)",
  background: "var(--ds-surface-shell)",
  "@media": {
    [mobileBreakpoint]: {
      gridTemplateColumns: "1fr",
    },
  },
});

export const sidebarSlot = style({
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  padding: "0",
  selectors: {
    [`${detailVisible} &`]: {
      "@media": {
        [mobileBreakpoint]: {
          display: "none",
        },
      },
    },
  },
});

export const detailSlot = style({
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  padding: "16px 20px 20px 0",
  "@media": {
    [mobileBreakpoint]: {
      padding: "0 12px 12px",
    },
  },
  selectors: {
    [`${mobileMasterDetail} &`]: {
      "@media": {
        [mobileBreakpoint]: {
          display: "none",
        },
      },
    },
    [`${mobileMasterDetail}.${detailVisible} &`]: {
      "@media": {
        [mobileBreakpoint]: {
          display: "flex",
        },
      },
    },
  },
});

export const sidebarNav = style({
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  padding: "12px 12px 24px 16px",
  borderRight: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  background: "var(--ds-surface-sidebar)",
  "@media": {
    [mobileBreakpoint]: {
      gap: "16px",
      padding: "12px 12px 14px",
      borderRight: "none",
    },
  },
});

export const sidebarSurface = style({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: 0,
});

export const sidebarSummaryLabel = style({
  fontSize: "var(--font-size-micro)",
  fontWeight: "700",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

export const sidebarSummaryTitle = style({
  fontSize: "var(--font-size-meta)",
  lineHeight: "1.55",
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
});

export const sidebarFooter = style({
  marginTop: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
});

export const sidebarFooterCopy = style({
  fontSize: "var(--font-size-fine)",
  lineHeight: "1.55",
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
});

export const contentSurface = style({
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});

export const mobileDetailHeader = style({
  display: "none",
  "@media": {
    [mobileBreakpoint]: {
      position: "sticky",
      top: "0",
      zIndex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      padding: "12px 14px",
      borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 96%, var(--ds-surface-shell))",
    },
  },
});

export const mobileBack = style({
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 72%, var(--ds-surface-card-base))",
  borderRadius: "999px",
  color: "var(--ds-text-strong)",
  minHeight: "34px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
});

export const mobileBackIcon = style({
  width: "14px",
  height: "14px",
});

export const mobileDetailTitle = style({
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
  color: "var(--ds-text-subtle)",
});

export const contentScroll = style({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "24px 28px 28px",
  background: "transparent",
  scrollbarWidth: "thin",
  "@media": {
    [mobileBreakpoint]: {
      padding: "16px 16px 20px",
    },
  },
});

export const contentInner = style({
  width: "min(100%, 640px)",
  paddingBottom: "8px",
});
