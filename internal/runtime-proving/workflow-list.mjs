#!/usr/bin/env node

const output = [
  "Internal runtime proving",
  "",
  "Root entrypoint:",
  "  pnpm runtime:prove                            Export candidate intake and run the internal nightly proving lane.",
  "",
  "Internal commands:",
  "  pnpm -C internal/runtime-proving workflow:list          Show internal runtime proving commands.",
  "  pnpm -C internal/runtime-proving replay:intake         Export the candidate intake artifact.",
  "  pnpm -C internal/runtime-proving replay:nightly        Run the background-ready proving lane.",
  "  pnpm -C internal/runtime-proving replay:list           Export the dataset selection report.",
  "  pnpm -C internal/runtime-proving replay:lineage        Export the lineage graph.",
  "  pnpm -C internal/runtime-proving replay:golden         Run the golden runtime replay lane.",
  "  pnpm -C internal/runtime-proving replay:smoke          Run the smoke replay sample.",
  "  pnpm -C internal/runtime-proving replay:rerecord       Re-record the golden dataset.",
  "  pnpm -C internal/runtime-proving replay:lint          Validate the golden replay dataset.",
  "  pnpm -C internal/runtime-proving provider:record      Record provider replay fixtures.",
  "  pnpm -C internal/runtime-proving provider:validate    Validate provider replay fixtures.",
  "  pnpm -C internal/runtime-proving test:runtime-replay-e2e Run the replay E2E harness directly.",
  "  pnpm -C internal/runtime-proving test:runtime-replay-dataset Run the replay dataset node tests.",
  "",
  "This lane is internal-only and intentionally no longer occupies root replay command space.",
].join("\n");

process.stdout.write(`${output}\n`);
