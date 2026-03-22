import { applyGlobalStyle } from "./system/globalStyleHelpers";

applyGlobalStyle(".panel-tabs", {
  display: "inline-flex",
  "align-items": "center",
  "align-self": "flex-start",
  "flex-wrap": "nowrap",
  flex: "0 0 auto",
  width: "max-content",
  "max-width": "100%",
  gap: "3px",
  padding: "3px",
  "border-radius": "10px",
  background: "color-mix(in srgb, var(--ds-surface-control) 84%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 54%, transparent)",
  "box-shadow": "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 5%, transparent)",
});
applyGlobalStyle(".panel-tabs .panel-tab", {
  display: "inline-flex",
  "align-items": "center",
  "justify-content": "center",
  flex: "0 0 auto",
  gap: "7px",
  "min-width": "64px",
  "min-height": "30px",
  height: "30px",
  padding: "0 10px",
  "border-radius": "8px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ds-text-subtle)",
  "box-shadow": "none",
  "white-space": "nowrap",
  transition:
    "border-color var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    background var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    gap var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
});
applyGlobalStyle(".panel-tabs .panel-tab:hover:not(:disabled)", {
  transform: "none",
  "box-shadow": "none",
  color: "var(--ds-text-stronger)",
  "border-color": "color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control-hover) 84%, transparent)",
});
applyGlobalStyle(".panel-tabs .panel-tab.is-active", {
  "border-color": "color-mix(in srgb, var(--ds-border-subtle) 54%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-elevated) 92%, transparent)",
  color: "var(--ds-text-stronger)",
  "box-shadow":
    "0 1px 2px color-mix(in srgb, var(--ds-shadow-color) 8%, transparent),\n    0 0 0 1px color-mix(in srgb, var(--ds-color-white) 6%, transparent) inset",
});
applyGlobalStyle(".panel-tabs .panel-tab:focus-visible", {
  outline: "2px solid var(--ds-focus-ring)",
  "outline-offset": "1px",
});
applyGlobalStyle(".panel-tabs .panel-tab-icon", {
  display: "inline-flex",
  "align-items": "center",
  "justify-content": "center",
  transition:
    "transform var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    color var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
});
applyGlobalStyle(".panel-tabs .panel-tab-icon svg", {
  width: "13px",
  height: "13px",
});
applyGlobalStyle(".panel-tabs .panel-tab:hover .panel-tab-icon", {
  transform: "none",
});
applyGlobalStyle(".panel-tabs .panel-tab-label", {
  "max-width": "none",
  opacity: "0.88",
  overflow: "visible",
  "white-space": "nowrap",
  "font-size": "var(--font-size-fine)",
  "font-weight": "600",
  "letter-spacing": "0.01em",
  "text-transform": "none",
  transform: "translateX(0)",
  transition:
    "max-width var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    opacity var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth)),\n    transform var(--ds-motion-base, var(--duration-fast)) var(--ds-motion-ease-standard, var(--ease-smooth))",
});
applyGlobalStyle(".panel-tabs .panel-tab.is-active .panel-tab-label", {
  opacity: "1",
  transform: "translateX(0)",
});
