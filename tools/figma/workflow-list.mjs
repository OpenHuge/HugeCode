#!/usr/bin/env node

const output = [
  "Internal Figma tooling",
  "",
  "Bridge:",
  "  pnpm -C tools/figma bridge:prepare     Build the token map and print local plugin workflow steps.",
  "  pnpm -C tools/figma bridge:listen      Start the local Figma export receiver.",
  "  pnpm -C tools/figma bridge:inspect     Inspect the latest raw Figma export bundle.",
  "  pnpm -C tools/figma bridge:resolve     Resolve a Figma URL or registry target into a local artifact.",
  "  pnpm -C tools/figma bridge:doctor      Maintenance-only connectivity and target checks.",
  "  pnpm -C tools/figma bridge:fetch       Maintenance-only REST fetch of a fresh Figma export.",
  "  pnpm -C tools/figma bridge:smoke       Smoke-check the local bridge workflow.",
  "",
  "Pipeline:",
  "  pnpm -C tools/figma pipeline:production Run the production-oriented pipeline after a local export.",
  "  pnpm -C tools/figma pipeline:develop    Run the staged developer flow for a focused export.",
  "  pnpm -C tools/figma pipeline:focus-plan Derive the family queue from a page-scale export.",
  "  pnpm -C tools/figma pipeline:focus-fetch Fetch only the child nodes needed for focused work.",
  "  pnpm -C tools/figma pipeline:run        Run the full staged pipeline on the latest export.",
  "  pnpm -C tools/figma pipeline:validate   Validate generated artifacts against repo schemas.",
  "",
  "This tooling is internal-only and intentionally excluded from root default workflows.",
].join("\n");

process.stdout.write(`${output}\n`);
