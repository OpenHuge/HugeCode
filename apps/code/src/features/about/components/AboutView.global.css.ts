import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

function feature(selector: string, rule: Record<string, unknown>) {
  globalStyle(selector, { "@layer": { [layers.features]: rule } } as unknown as GlobalStyleRule);
}

feature(".about", {
  height: "100vh",
  width: "100vw",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingTop: "8px",
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at top, color-mix(in srgb, var(--ds-surface-hover) 34%, transparent), transparent 55%), var(--ds-surface-topbar)",
  color: "var(--ds-text-emphasis)",
  "-webkit-app-region": "no-drag",
  "@media": { "(max-height: 720px)": { paddingTop: "16px" } },
});
feature(".about-card", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  padding: "28px 28px 16px",
  textAlign: "center",
  borderRadius: "var(--ds-radius-lg)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 86%, transparent), color-mix(in srgb, var(--ds-surface-card) 94%, transparent))",
  boxShadow:
    "var(--ds-elevation-2), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 32%, transparent)",
  "@media": { "(max-height: 720px)": { padding: "22px 20px 12px" } },
});
feature(".about-header", { display: "flex", alignItems: "center", gap: "10px" });
feature(".about-icon", {
  width: "44px",
  height: "44px",
  borderRadius: "8px",
  boxShadow: "0 10px 20px color-mix(in srgb, var(--ds-brand-background) 28%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 76%, transparent)",
  "@media": { "(max-height: 720px)": { width: "40px", height: "40px", borderRadius: "7px" } },
});
feature(".about-title", {
  fontSize: "var(--font-size-display)",
  fontWeight: "700",
  letterSpacing: "0.02em",
});
feature(".about-version", { fontSize: "var(--font-size-meta)", color: "var(--ds-text-faint)" });
feature(".about-meta", {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-dim)",
});
feature(".about-tagline", {
  fontSize: "var(--font-size-chrome)",
  color: "var(--ds-text-muted)",
  maxWidth: "260px",
});
feature(".about-update-capability", {
  maxWidth: "280px",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-dim)",
  lineHeight: "var(--line-height-145)",
});
feature(".about-divider", {
  width: "160px",
  height: "1px",
  background: "var(--ds-border-subtle)",
  margin: "6px 0",
});
feature(".about-links", {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "var(--font-size-meta)",
});
feature(".about-footer", {
  marginTop: "8px",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-text-faint)",
});
feature(".about-link", {
  border: "none",
  background: "transparent",
  color: "var(--ds-text-emphasis)",
  cursor: "pointer",
  fontSize: "var(--font-size-meta)",
  padding: "2px 6px",
  borderRadius: "8px",
  transition:
    "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
});
feature(".about-link:hover", {
  textDecoration: "none",
  background: "color-mix(in srgb, var(--ds-surface-hover) 70%, transparent)",
  color: "var(--ds-text-strong)",
});
feature(".about-link:focus-visible", {
  outline: "2px solid color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
  outlineOffset: "1px",
});
feature(".about-link-sep", { color: "var(--ds-text-dim)" });
