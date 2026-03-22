#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { generateScaffolds } from "./generate-scaffolds.mjs";
import { applyPromotions } from "./apply-promotions.mjs";
import { reviewPromotions } from "./review-promotions.mjs";
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

export function developFromExport(exportJsonPath, options = {}) {
  const pipeline = runPipeline(exportJsonPath);
  const exportScope = assessExportScope(readExportSummary(exportJsonPath));
  const shouldSkipCodegen = !options.forceCodegen && !exportScope.codegenSafe;
  const codegen = shouldSkipCodegen ? null : generateScaffolds(exportJsonPath);
  const review = shouldSkipCodegen ? null : reviewPromotions(exportJsonPath, options);
  const apply =
    shouldSkipCodegen || !options.applyApproved ? null : applyPromotions(exportJsonPath, options);

  return {
    ok: pipeline.ok,
    exportJsonPath,
    exportScope,
    outputs: {
      ...pipeline.outputs,
      codegenReport: codegen?.outputPath ?? null,
      promotionManifest: review?.outputPath ?? null,
      promotionReview: review?.reviewDocPath ?? null,
      promotionApplyReport: apply?.outputPath ?? null,
    },
    generatedTargets: codegen?.report.generatedTargets.length ?? 0,
    approvedTargets:
      review?.output.targets.filter((target) => target.approvalStatus === "approved").length ?? 0,
    appliedTargets: apply?.output.appliedTargets.length ?? 0,
    warnings: [
      ...(shouldSkipCodegen
        ? [
            `Skipped codegen, review, and apply because the export scope is ${exportScope.selectionType} with ${exportScope.nodeCount} nodes.`,
            ...exportScope.reasons,
            "Capture a component, component set, or a smaller frame before using pipeline:develop, or rerun with --force-codegen for an intentional broad experiment.",
          ]
        : []),
      ...(apply
        ? []
        : [
            shouldSkipCodegen
              ? "No promotion artifacts were generated because codegen was skipped for safety."
              : "Approved targets were not applied. Run pipeline:apply or use --apply-approved after review.",
          ]),
    ],
  };
}

function main() {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const exportJsonPath = resolveLatestRawExportJsonPath(cliOptions.explicitInputPath);
  const result = developFromExport(exportJsonPath, cliOptions);
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
