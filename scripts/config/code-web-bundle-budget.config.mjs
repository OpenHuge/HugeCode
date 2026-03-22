export const codeBundleBudgetConfig = {
  entryMaxBytes: 650_000,
  chunkMaxBytes: 400_000,
  growthTolerancePct: 3,
  knownLargeChunkPrefixes: {
    "MainApp-": 1_450_000,
    "MainAppContainerCore-": 1_450_000,
    "Home-": 540_000,
    "SettingsView-": 500_000,
    "xterm-": 420_000,
    "esm-": 1_135_000,
    "lib-": 610_000,
    "Markdown.styles.css-": 610_000,
    "GitDiffViewer-": 610_000,
    "wasm-": 625_000,
    "cpp-": 670_000,
    "emacs-lisp-": 785_000,
  },
};

export default codeBundleBudgetConfig;
