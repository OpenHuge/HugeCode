import { ARTIFACT_SUFFIXES } from "./contracts.mjs";
import { readJson, replaceJsonSuffix } from "./paths.mjs";

export function loadPipelineArtifacts(exportJsonPath) {
  return {
    manifestPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.rawManifest),
    graphPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.classifiedNodeGraph),
    primitivePath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.primitiveTokens),
    semanticPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.semanticTokens),
    inventoryPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentInventory),
    variantStatePath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.variantStateModel),
    componentSpecsPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentSpecs),
    generationPlanPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.generationPlan),
    codegenReportPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.codegenReport),
    promotionManifestPath: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.promotionManifest),
    promotionApplyReportPath: replaceJsonSuffix(
      exportJsonPath,
      ARTIFACT_SUFFIXES.promotionApplyReport
    ),
  };
}

export function readPipelineArtifacts(exportJsonPath) {
  const paths = loadPipelineArtifacts(exportJsonPath);
  return {
    ...paths,
    manifest: readJson(paths.manifestPath),
    graph: readJson(paths.graphPath),
    primitives: readJson(paths.primitivePath),
    semantics: readJson(paths.semanticPath),
    inventory: readJson(paths.inventoryPath),
  };
}
