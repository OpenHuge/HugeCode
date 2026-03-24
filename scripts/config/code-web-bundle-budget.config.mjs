export const codeBundleBudgetConfig = {
  entryMaxBytes: 650_000,
  chunkMaxBytes: 400_000,
  growthTolerancePct: 3,
  // The Cloudflare web shell should not inherit desktop-only large-chunk baselines.
  knownLargeChunkPrefixes: {},
};

export default codeBundleBudgetConfig;
