#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { collectStyleMetrics } from "./lib/style-metrics.mjs";

function parseArgs(argv) {
  const args = { output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --output.");
      }
      args.output = next;
      index += 1;
    }
  }
  return args;
}

function main() {
  const { output } = parseArgs(process.argv.slice(2));
  const metrics = collectStyleMetrics();
  const serialized = `${JSON.stringify(metrics, null, 2)}\n`;

  if (!output) {
    process.stdout.write(serialized);
    return;
  }

  const absoluteOutput = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, serialized);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
