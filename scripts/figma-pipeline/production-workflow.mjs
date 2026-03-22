#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { developFromExport } from "./develop.mjs";
import { runPipeline } from "./run.mjs";
import { assessExportScope, readExportSummary } from "./shared/export-scope.mjs";
import { resolveLatestRawExportJsonPath } from "./shared/paths.mjs";

function parseCliOptions(argv) {
  return {
    explicitInputPath: argv.find((argument) => !argument.startsWith("--")) ?? null,
    applyRoot:
      argv
        .find((argument) => argument.startsWith("--apply-root="))
        ?.slice("--apply-root=".length) ?? process.cwd(),
    approveReadyTargets: argv.includes("--approve-ready-targets"),
    approveAllTargets: argv.includes("--approve-all-targets"),
    applyApproved: argv.includes("--apply-approved"),
    forceCodegen: argv.includes("--force-codegen"),
    overwrite: argv.includes("--overwrite"),
  };
}

export function runProductionWorkflow(exportJsonPath, options = {}) {
  const exportScope = assessExportScope(readExportSummary(exportJsonPath));
  const result =
    exportScope.codegenSafe || options.forceCodegen
      ? developFromExport(exportJsonPath, options)
      : (() => {
          const pipeline = runPipeline(exportJsonPath);
          return {
            ok: pipeline.ok,
            exportJsonPath,
            exportScope,
            mode: "audit",
            outputs: pipeline.outputs,
            generatedTargets: 0,
            approvedTargets: 0,
            appliedTargets: 0,
            warnings: [
              `Detected ${exportScope.selectionType} export with ${exportScope.nodeCount} nodes; defaulting to audit-only pipeline mode.`,
              ...exportScope.reasons,
              "Capture a component, component set, or a smaller frame if you want governed codegen and promotion review artifacts.",
            ],
          };
        })();

  return {
    ...result,
    mode: exportScope.codegenSafe || options.forceCodegen ? "develop" : "audit",
  };
}

function main() {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const exportJsonPath = resolveLatestRawExportJsonPath(cliOptions.explicitInputPath);
  const result = runProductionWorkflow(exportJsonPath, cliOptions);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.exit(1);
  }
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
