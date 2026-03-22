export const codeBundleBudgetConfig = {
  entryMaxBytes: 1_000_000,
  chunkMaxBytes: 350_000,
  growthTolerancePct: 3,
  knownLargeChunkPrefixes: {
    "MainApp-": 1_468_133,
    "MainAppContainerCore-": 1_468_133,
    "emacs-lisp-": 779_847,
    "cpp-": 626_137,
    "wasm-": 622_325,
    "zz-git-heavy-": 546_354,
  },
};

export default codeBundleBudgetConfig;
