#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { classifyExport } from "./classify.mjs";
import { detectComponents } from "./detect-components.mjs";
import { extractPrimitiveTokens } from "./extract-primitives.mjs";
import { generateComponentSpecs } from "./generate-component-specs.mjs";
import { mapSemanticTokens } from "./map-semantics.mjs";
import { modelVariants } from "./model-variants.mjs";
import { planGenerationTargets } from "./plan-generation-targets.mjs";
import { validatePipelineArtifacts } from "./validate-artifacts.mjs";
import { resolveLatestRawExportJsonPath } from "./shared/paths.mjs";

export function runPipeline(exportJsonPath) {
  const classification = classifyExport(exportJsonPath);
  const primitives = extractPrimitiveTokens(exportJsonPath);
  const semantics = mapSemanticTokens(exportJsonPath);
  const components = detectComponents(exportJsonPath);
  const variantStateModel = modelVariants(exportJsonPath);
  const componentSpecs = generateComponentSpecs(exportJsonPath);
  const generationPlan = planGenerationTargets(exportJsonPath);
  const validation = validatePipelineArtifacts(exportJsonPath);

  return {
    ok: validation.report.blockers.length === 0,
    exportJsonPath,
    outputs: {
      classifiedNodeGraph: classification.outputPath,
      primitiveTokens: primitives.outputPath,
      semanticTokens: semantics.outputPath,
      componentInventory: components.outputPath,
      variantStateModel: variantStateModel.outputPath,
      componentSpecs: componentSpecs.outputPath,
      generationPlan: generationPlan.outputPath,
      qaReport: validation.outputPath,
    },
    validation,
  };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const result = runPipeline(exportJsonPath);
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
