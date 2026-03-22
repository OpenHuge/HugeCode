#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  loadRuntimeReplayDataset,
  parseRuntimeReplayFilters,
  resolveDatasetDirFromManifest,
  selectRuntimeReplaySamples,
  validateRuntimeReplayDataset,
} from "./lib/runtimeReplayDataset.mjs";
import {
  buildRuntimeReplayLineageFromDirectory,
  writeRuntimeReplayLineageJson,
} from "./lib/runtimeReplayLineageExporter.mjs";

function writeStdoutLine(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderrLine(message) {
  process.stderr.write(`${message}\n`);
}

function parseArgs(argv) {
  let outputPath = "artifacts/runtime-replay/lineage-graph.json";
  const passthrough = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if ((arg === "--output" || arg === "--lineage-json") && next) {
      outputPath = next;
      index += 1;
      continue;
    }
    passthrough.push(arg);
  }

  return {
    filters: parseRuntimeReplayFilters(passthrough),
    outputPath,
  };
}

function main() {
  const { filters, outputPath } = parseArgs(process.argv.slice(2));
  const dataset = loadRuntimeReplayDataset({ manifestPath: filters.manifestPath });
  const selectedSamples = selectRuntimeReplaySamples(dataset, filters);
  const selectedDataset = {
    ...dataset,
    manifest: {
      ...dataset.manifest,
      samples: selectedSamples.map((entry) => entry.manifestEntry),
    },
    samples: selectedSamples,
  };
  const validation = validateRuntimeReplayDataset(selectedDataset, {
    requireRecorded: filters.requireRecorded,
    skipTaxonomyCoverageWarnings: selectedSamples.length !== dataset.samples.length,
  });

  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      writeStderrLine(`error: ${error}`);
    }
    process.exit(1);
  }

  const graph = buildRuntimeReplayLineageFromDirectory({
    datasetRoot: resolveDatasetDirFromManifest(filters.manifestPath),
    selectedSampleIds: selectedSamples.map((entry) => entry.sample.sample.id),
  });
  const resolvedOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath);
  writeRuntimeReplayLineageJson(resolvedOutputPath, graph);
  writeStdoutLine(`Lineage graph: ${resolvedOutputPath}`);
  writeStdoutLine(
    `Lineage summary: samples=${graph.summary?.nodeCounts?.sample ?? 0}; edges=${Object.values(graph.summary?.edgeCounts ?? {}).reduce((sum, value) => sum + value, 0)}; unresolved=${graph.summary?.unresolvedCount ?? 0}; blocked=${graph.summary?.blockedCount ?? 0}`
  );
  writeStdoutLine(`Lineage cycles: ${graph.summary?.cycleCount ?? 0}`);
  writeStdoutLine(`Lineage DAG: ${graph.summary?.isDag === true ? "yes" : "no"}`);
  if ((graph.blocked?.length ?? 0) > 0) {
    writeStdoutLine(
      `Blocked lineage: ${graph.blocked
        .slice(0, 5)
        .map((entry) => `${entry.sampleId}->${entry.parentSampleId}[${entry.blockers.join("|")}]`)
        .join(", ")}`
    );
  }
}

main();
