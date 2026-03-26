export const codeBundleBudgetConfig = {
  entryMaxBytes: 300_000,
  chunkMaxBytes: 350_000,
  growthTolerancePct: 3,
  knownLargeChunkPrefixes: {
    "MainApp-": 560_000,
    "MainAppContainerCore-": 560_000,
    "app-bootstrap-": 361_263,
    "emacs-lisp-": 779_847,
    "cpp-": 626_137,
    "wasm-": 622_325,
    "zz-git-heavy-": 546_354,
  },
};

export default codeBundleBudgetConfig;
