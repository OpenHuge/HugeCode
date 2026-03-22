#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { deriveFocusPlanFromExport } from "./shared/focus-plan.mjs";
import { resolveLatestRawExportJsonPath, writeJson } from "./shared/paths.mjs";

function printHelp() {
  process.stdout.write(`Usage:
  pnpm -C tools/figma pipeline:focus-plan
  pnpm -C tools/figma pipeline:focus-plan .figma-workflow/figma-exports/example.json --output docs/design-system/figma-focus-plan.json

Options:
  --output <path>       Write the focus plan JSON to a stable path
  --families <csv>      Restrict output to specific families, for example Button,Input,Select
  --include-layout-families  Include LocalPattern, Box, Inline, and Stack families
  --help                Show this message
`);
}

function parseArgs(argv) {
  const options = {
    explicitInputPath: null,
    outputPath: null,
    families: [],
    includeLayoutFamilies: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--help" || current === "-h") {
      options.help = true;
      continue;
    }
    if (current === "--output" && next) {
      options.outputPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--families" && next) {
      options.families = next
        .split(",")
        .map((family) => family.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (current === "--include-layout-families") {
      options.includeLayoutFamilies = true;
      continue;
    }
    if (!current.startsWith("--") && options.explicitInputPath === null) {
      options.explicitInputPath = current;
    }
  }

  return options;
}

export function createFocusPlan(options) {
  const exportJsonPath = resolveLatestRawExportJsonPath(options.explicitInputPath);
  const output = deriveFocusPlanFromExport(exportJsonPath, {
    families: options.families,
    includeLayoutFamilies: options.includeLayoutFamilies,
  });

  if (options.outputPath) {
    writeJson(options.outputPath, output);
  }

  return {
    ok: true,
    exportJsonPath: path.relative(process.cwd(), exportJsonPath),
    outputPath: options.outputPath ? path.relative(process.cwd(), options.outputPath) : null,
    summary: output.summary,
    targets: output.targets,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = createFocusPlan(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
