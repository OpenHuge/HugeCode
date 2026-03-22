import { typographyValues } from "@ku0/design-system";
import { globalStyle } from "@vanilla-extract/css";

const mobileBreakpoint = "(max-width: 720px)";

globalStyle(
  '.settings-overlay--chatgpt[data-overlay-root="dialog"] > .ds-modal-backdrop[data-overlay-phase="backdrop"]',
  {
    background:
      "radial-gradient(circle at 50% 6%, color-mix(in srgb, var(--ds-brand-primary) 10%, transparent), transparent 32%), linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-overlay) 14%, transparent), transparent 28%), color-mix(in srgb, var(--ds-color-black) 58%, transparent)",
    backdropFilter: "blur(16px) saturate(1.08)",
    WebkitBackdropFilter: "blur(16px) saturate(1.08)",
  }
);

globalStyle(
  '.settings-window--chatgpt[data-overlay-phase="surface"][data-overlay-treatment="translucent"]',
  {
    width: "min(1280px, calc(100vw - 28px))",
    maxWidth: "none",
    height: "min(820px, calc(100vh - 28px))",
    borderRadius: "24px",
    border: "1px solid color-mix(in srgb, var(--ds-border-default) 84%, transparent)",
    background: "color-mix(in srgb, var(--ds-surface-shell) 98%, var(--ds-surface-panel))",
    boxShadow:
      "0 28px 68px -42px color-mix(in srgb, var(--ds-shadow-color) 54%, transparent), 0 10px 22px -18px color-mix(in srgb, var(--ds-color-black) 34%, transparent)",
    overflow: "hidden",
    "@media": {
      [mobileBreakpoint]: {
        width: "min(720px, calc(100vw - 14px))",
        height: "min(820px, calc(100vh - env(safe-area-inset-top, 0px) - 10px))",
        borderRadius: "20px",
      },
    },
  }
);

globalStyle(
  '.settings-window--chatgpt[data-overlay-phase="surface"][data-overlay-treatment="translucent"] .settings-titlebar',
  {
    alignItems: "flex-start",
    gap: "14px",
    padding: "18px 20px 14px",
    borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
    background: "color-mix(in srgb, var(--ds-surface-topbar) 94%, var(--ds-surface-shell))",
    "@media": {
      [mobileBreakpoint]: {
        padding: "16px 16px 14px",
      },
    },
  }
);

globalStyle(".settings-header-copy", {
  minWidth: "0",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

globalStyle(".settings-kicker-row", {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
});

globalStyle(".settings-kicker", {
  fontSize: "var(--font-size-micro)",
  fontWeight: "600",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

globalStyle(".settings-context-chip", {
  fontSize: "var(--font-size-fine)",
  color: "color-mix(in srgb, var(--ds-text-subtle) 88%, white)",
});

globalStyle(".settings-window--chatgpt .settings-title", {
  fontSize: "var(--font-size-display-sm)",
  lineHeight: typographyValues.displaySm.lineHeight,
  letterSpacing: "-0.025em",
  color: "var(--ds-text-stronger)",
  "@media": {
    [mobileBreakpoint]: {
      fontSize: "var(--font-size-title-lg)",
    },
  },
});

globalStyle(".settings-subtitle", {
  maxWidth: "60ch",
  fontSize: "var(--font-size-meta)",
  lineHeight: typographyValues.meta.lineHeight,
  color: "var(--ds-text-subtle)",
  textWrap: "pretty",
  "@media": {
    [mobileBreakpoint]: {
      fontSize: "var(--font-size-fine)",
    },
  },
});

globalStyle(".settings-header-actions", {
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  flexShrink: "0",
});

globalStyle(".settings-active-pill", {
  minHeight: "36px",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
  letterSpacing: "0.01em",
});

globalStyle(".settings-window--chatgpt .settings-close", {
  width: "40px",
  height: "40px",
  padding: "0",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--ds-border-default) 84%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 86%, var(--ds-surface-card-base))",
  color: "var(--ds-text-stronger)",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 8%, transparent)",
});
