#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  buildRuntimeReplayValidationReport,
  loadRuntimeReplayDataset,
  parseRuntimeReplayFilters,
  selectRuntimeReplaySamples,
  validateRuntimeReplayDataset,
  writeJson,
} from "./lib/runtimeReplayDataset.mjs";

function main() {
  const filters = parseRuntimeReplayFilters(process.argv.slice(2));
  const dataset = loadRuntimeReplayDataset({ manifestPath: filters.manifestPath });
  const selectedSamples = selectRuntimeReplaySamples(dataset, filters);
  const validation = validateRuntimeReplayDataset(dataset, {
    requireRecorded: filters.requireRecorded,
  });

  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      process.stderr.write(`error: ${error}\n`);
    }
    process.exit(1);
  }

  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples,
    validation,
  });
  const outputPath = path.isAbsolute(
    filters.outputReportPath ?? "artifacts/runtime-replay/candidate-intake.json"
  )
    ? (filters.outputReportPath ?? "artifacts/runtime-replay/candidate-intake.json")
    : path.resolve(
        process.cwd(),
        filters.outputReportPath ?? "artifacts/runtime-replay/candidate-intake.json"
      );

  writeJson(outputPath, report.candidateIntake ?? {});
  process.stdout.write(`Candidate intake: ${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
