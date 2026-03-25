import type { WorkerInitializationRenderOptions } from "@pierre/diffs/react";

export const DIFF_VIEWER_SCROLL_CSS = `
[data-column-number],
[data-buffer],
[data-separator-wrapper],
[data-annotation-content] {
  position: static !important;
}

[data-buffer] {
  background-image: none !important;
}

diffs-container,
[data-diffs],
[data-diffs-header],
[data-error-wrapper] {
  position: relative !important;
  contain: layout style !important;
  isolation: isolate !important;
}

[data-diffs-header],
[data-diffs],
[data-error-wrapper] {
  --diffs-light-bg: var(--ds-diff-lib-bg-light);
  --diffs-dark-bg: var(--ds-diff-lib-bg-dark);
}

[data-diffs-header][data-theme-type='light'],
[data-diffs][data-theme-type='light'] {
  --diffs-bg: var(--ds-diff-lib-bg-light);
}

[data-diffs-header][data-theme-type='dark'],
[data-diffs][data-theme-type='dark'] {
  --diffs-bg: var(--ds-diff-lib-bg-dark);
}

@media (prefers-color-scheme: dark) {
  [data-diffs-header]:not([data-theme-type]),
  [data-diffs]:not([data-theme-type]),
  [data-diffs-header][data-theme-type='system'],
  [data-diffs][data-theme-type='system'] {
    --diffs-bg: var(--ds-diff-lib-bg-system-dark);
  }
}

@media (prefers-color-scheme: light) {
  [data-diffs-header]:not([data-theme-type]),
  [data-diffs]:not([data-theme-type]),
  [data-diffs-header][data-theme-type='system'],
  [data-diffs][data-theme-type='system'] {
    --diffs-bg: var(--ds-diff-lib-bg-system-light);
  }
}
`;

// Keep the eager preload list intentionally small; uncommon languages still load on-demand.
const DIFF_VIEWER_PRELOAD_LANGS = [
  "text",
  "ansi",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "json",
  "yaml",
  "markdown",
  "zsh",
  "python",
  "rust",
] as const;

// @pierre/diffs@1.1.3 loads Pierre JSON themes via bare dynamic imports without
// import attributes. Browsers handle that through Vite, but Vitest's Node ESM
// runner rejects the upstream JSON imports. Keep runtime Pierre themes in app
// builds and use bundled Shiki themes only under test.
const DIFF_VIEWER_THEME =
  import.meta.env.MODE === "test"
    ? { dark: "github-dark", light: "github-light" }
    : { dark: "pierre-dark", light: "pierre-light" };

export const DIFF_VIEWER_HIGHLIGHTER_OPTIONS: WorkerInitializationRenderOptions = {
  theme: DIFF_VIEWER_THEME,
  langs: [...DIFF_VIEWER_PRELOAD_LANGS],
};
