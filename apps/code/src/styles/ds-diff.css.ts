import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(':root[data-theme="light"] .ds-diff-viewer', {
  "@layer": {
    [layers.components]: {
      "--ds-diff-lib-bg-light": "color-mix(in srgb, var(--ds-surface-card) 72%, white)",
      "--ds-diff-lib-bg-system-light": "color-mix(in srgb, var(--ds-surface-card) 72%, white)",
    },
  },
});
applyGlobalStyle(':root[data-theme="dim"] .ds-diff-viewer', {
  "@layer": {
    [layers.components]: {
      "--ds-diff-lib-bg-dark":
        "color-mix(in srgb, var(--ds-surface-muted) 72%, var(--ds-brand-background))",
      "--ds-diff-lib-bg-system-dark":
        "color-mix(\n    in srgb,\n    var(--ds-surface-muted) 72%,\n    var(--ds-brand-background)\n  )",
    },
  },
});
