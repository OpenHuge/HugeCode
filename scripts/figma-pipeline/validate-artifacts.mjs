#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import {
  deriveTargetLayer,
  getFamilyDefinition,
  isInteractiveFamily,
} from "./shared/family-registry.mjs";
import { validateAgainstSchema } from "./shared/schema-check.mjs";
import {
  loadSchema,
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

const cliArgs = process.argv.slice(2);
const allowMissingArtifacts = cliArgs.includes("--allow-missing-artifacts");
const explicitInputPath = cliArgs.find((argument) => !argument.startsWith("--")) ?? null;

function maybeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function validateArtifact(artifactPath, schemaFileName, checkedArtifacts, blockers) {
  const payload = maybeReadJson(artifactPath);
  if (!payload) {
    blockers.push(`Missing artifact: ${path.basename(artifactPath)}.`);
    return;
  }

  const issues = validateAgainstSchema(payload, loadSchema(schemaFileName));
  checkedArtifacts.push(path.basename(artifactPath));
  blockers.push(...issues.map((issue) => `${path.basename(artifactPath)}: ${issue}`));
}

function pushIssue(bucket, filePath, message) {
  bucket.push(`${path.basename(filePath)}: ${message}`);
}

function validateVariantStateModel(artifactPath, payload, blockers, warnings) {
  for (const family of payload.families ?? []) {
    const variantNames = new Set((family.variants ?? []).map((entry) => entry.name));
    const persistentStateNames = new Set(
      (family.persistentStates ?? []).map((entry) => entry.name)
    );
    const interactionStateNames = new Set(
      (family.interactionStates ?? []).map((entry) => entry.name)
    );

    for (const stateName of persistentStateNames) {
      if (interactionStateNames.has(stateName)) {
        pushIssue(
          blockers,
          artifactPath,
          `Family ${family.familyName} models "${stateName}" as both persistent and interaction state.`
        );
      }
      if (variantNames.has(stateName)) {
        pushIssue(
          blockers,
          artifactPath,
          `Family ${family.familyName} reuses "${stateName}" as both variant and persistent state.`
        );
      }
    }

    if (isInteractiveFamily(family.familyName) && interactionStateNames.size === 0) {
      pushIssue(
        blockers,
        artifactPath,
        `Interactive family ${family.familyName} is missing interaction states.`
      );
    }

    if ((family.candidateComponents ?? []).length === 0) {
      pushIssue(warnings, artifactPath, `Family ${family.familyName} has no candidate components.`);
    }
  }
}

function validateComponentSpecsArtifact(artifactPath, payload, blockers, warnings) {
  for (const component of payload.components ?? []) {
    const interactive = isInteractiveFamily(component.family);
    const semanticDependencies = component.tokenDependencies?.semantic ?? [];
    const unresolvedSemanticDependencies = semanticDependencies.filter(
      (dependency) => dependency?.status !== "mapped"
    );

    if (!component.generationTarget?.targetLayer) {
      pushIssue(
        blockers,
        artifactPath,
        `Component ${component.name} is missing generation target.`
      );
    }

    if (semanticDependencies.length === 0) {
      pushIssue(
        blockers,
        artifactPath,
        `Component ${component.name} does not declare semantic token dependencies.`
      );
    }
    if (component.status === "ready" && unresolvedSemanticDependencies.length > 0) {
      pushIssue(
        blockers,
        artifactPath,
        `Component ${component.name} is marked ready with unmapped semantic token dependencies.`
      );
    } else if (unresolvedSemanticDependencies.length > 0) {
      pushIssue(
        warnings,
        artifactPath,
        `Component ${component.name} still has unmapped semantic token dependencies.`
      );
    }

    for (const primitiveException of component.tokenDependencies?.primitiveExceptions ?? []) {
      if (!primitiveException?.reason) {
        pushIssue(
          blockers,
          artifactPath,
          `Component ${component.name} has a primitive exception without a reason.`
        );
      }
    }

    const targetLayer = component.generationTarget?.targetLayer;
    const derivedTargetLayer = deriveTargetLayer(component.sharedLevel);
    if (
      component.sharedLevel?.startsWith("shared") &&
      !["design-system-primitive", "design-system-component"].includes(targetLayer)
    ) {
      pushIssue(
        blockers,
        artifactPath,
        `Shared component ${component.name} is routed outside packages/design-system.`
      );
    }
    if (
      ["app-adapter", "app-local"].includes(component.sharedLevel) &&
      ["design-system-primitive", "design-system-component"].includes(targetLayer)
    ) {
      pushIssue(
        blockers,
        artifactPath,
        `App-scoped component ${component.name} is incorrectly routed to the shared design system.`
      );
    }
    if (targetLayer && targetLayer !== derivedTargetLayer && component.status === "ready") {
      pushIssue(
        warnings,
        artifactPath,
        `Component ${component.name} target layer ${targetLayer} differs from shared-level default ${derivedTargetLayer}.`
      );
    }

    if (interactive) {
      if ((component.states?.interaction ?? []).length === 0) {
        pushIssue(
          blockers,
          artifactPath,
          `Interactive component ${component.name} is missing interaction states.`
        );
      }
      if (!component.accessibility?.role) {
        pushIssue(
          blockers,
          artifactPath,
          `Interactive component ${component.name} is missing an accessibility role.`
        );
      }
      if ((component.accessibility?.keyboard ?? []).length === 0) {
        pushIssue(
          blockers,
          artifactPath,
          `Interactive component ${component.name} is missing keyboard expectations.`
        );
      }
    }

    if ((component.props ?? []).length === 0) {
      pushIssue(blockers, artifactPath, `Component ${component.name} is missing prop contracts.`);
    }
    if (
      (component.slots ?? []).length === 0 &&
      getFamilyDefinition(component.family).slots.length > 0
    ) {
      pushIssue(
        warnings,
        artifactPath,
        `Component ${component.name} has no slots listed despite family ${component.family} defining slots.`
      );
    }
  }
}

function validateGenerationPlanArtifact(artifactPath, payload, blockers, warnings) {
  for (const target of payload.targets ?? []) {
    const unresolvedSemanticDependencies = (target.tokenStrategy?.semanticTokens ?? []).filter(
      (token) => token?.status !== "mapped"
    );
    if (!target.targetLayer) {
      pushIssue(blockers, artifactPath, `Target ${target.componentName} is missing targetLayer.`);
    }
    if ((target.files ?? []).length === 0) {
      pushIssue(blockers, artifactPath, `Target ${target.componentName} has no file plan.`);
    }
    if ((target.tokenStrategy?.semanticTokens ?? []).length === 0) {
      pushIssue(
        blockers,
        artifactPath,
        `Target ${target.componentName} is missing semantic token routing.`
      );
    }
    if (target.status === "ready" && target.targetLayer === "defer") {
      pushIssue(
        blockers,
        artifactPath,
        `Target ${target.componentName} is ready but routed to defer.`
      );
    }
    if (target.codegenReadiness?.status === "ready" && (target.blockers ?? []).length > 0) {
      pushIssue(
        warnings,
        artifactPath,
        `Target ${target.componentName} is marked ready while blockers are still present.`
      );
    }
    if (target.status === "ready" && unresolvedSemanticDependencies.length > 0) {
      pushIssue(
        blockers,
        artifactPath,
        `Target ${target.componentName} is ready with unresolved semantic token dependencies.`
      );
    }
  }
}

function validateCodegenReportArtifact(artifactPath, payload, blockers, warnings) {
  if (payload.mode === "artifacts-only" && (payload.promotedTargets ?? []).length > 0) {
    pushIssue(
      blockers,
      artifactPath,
      "Codegen report cannot list promoted targets while mode is artifacts-only."
    );
  }
  if (payload.mode === "artifacts-and-promote" && payload.promotion?.enabled !== true) {
    pushIssue(
      blockers,
      artifactPath,
      "Codegen report promotion mode must mark promotion.enabled=true."
    );
  }

  for (const skippedTarget of payload.skippedTargets ?? []) {
    if (skippedTarget.stage === "generate" && skippedTarget.readiness === "ready") {
      pushIssue(
        blockers,
        artifactPath,
        `Ready target ${skippedTarget.componentName} was skipped during scaffold generation: ${skippedTarget.reason}`
      );
    } else if (skippedTarget.stage === "generate" && skippedTarget.readiness === "review") {
      pushIssue(
        warnings,
        artifactPath,
        `Review target ${skippedTarget.componentName} was skipped during scaffold generation: ${skippedTarget.reason}`
      );
    }
    if (skippedTarget.stage === "promote" && payload.promotion?.enabled !== true) {
      pushIssue(
        blockers,
        artifactPath,
        `Skipped promote target ${skippedTarget.componentName} was recorded without promotion mode enabled.`
      );
    }
  }

  if (
    payload.promotion?.enabled === true &&
    (payload.generatedTargets ?? []).length > 0 &&
    (payload.promotedTargets ?? []).length === 0
  ) {
    pushIssue(warnings, artifactPath, "Promotion mode ran without promoting any scaffold targets.");
  }
}

function validatePromotionManifestArtifact(artifactPath, payload, blockers, warnings) {
  for (const target of payload.targets ?? []) {
    if ((target.files ?? []).length === 0) {
      pushIssue(blockers, artifactPath, `Promotion target ${target.componentName} has no files.`);
    }
    if (target.approvalStatus === "approved" && target.readiness === "defer") {
      pushIssue(
        blockers,
        artifactPath,
        `Deferred target ${target.componentName} cannot be pre-approved for apply.`
      );
    }
    if (target.approvalStatus === "approved" && (target.approvalNotes ?? []).length === 0) {
      pushIssue(
        warnings,
        artifactPath,
        `Approved target ${target.componentName} should include approval notes.`
      );
    }
  }
}

function validatePromotionApplyReportArtifact(artifactPath, payload, blockers, warnings) {
  for (const target of payload.appliedTargets ?? []) {
    if ((target.appliedFiles ?? []).length === 0) {
      pushIssue(
        blockers,
        artifactPath,
        `Applied target ${target.componentName} has no applied files.`
      );
    }
  }
  if ((payload.appliedTargets ?? []).length === 0) {
    pushIssue(
      warnings,
      artifactPath,
      "Promotion apply report completed without applying any targets."
    );
  }
}

export function validatePipelineArtifacts(exportJsonPath, options = {}) {
  const checkedArtifacts = [];
  const blockers = [];
  const warnings = [];

  const artifacts = [
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.rawManifest),
      "raw-artifact-manifest.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.classifiedNodeGraph),
      "classified-node-graph.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.primitiveTokens),
      "primitive-tokens.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.semanticTokens),
      "semantic-tokens.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentInventory),
      "component-inventory.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.variantStateModel),
      "variant-state-model.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentSpecs),
      "component-specs.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.generationPlan),
      "generation-plan.schema.json",
    ],
  ];

  const optionalArtifacts = [
    [replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.qaReport), "qa-report.schema.json"],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.codegenReport),
      "codegen-report.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.promotionManifest),
      "promotion-manifest.schema.json",
    ],
    [
      replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.promotionApplyReport),
      "promotion-apply-report.schema.json",
    ],
  ];

  for (const [artifactPath, schemaPath] of artifacts) {
    validateArtifact(artifactPath, schemaPath, checkedArtifacts, blockers);
  }

  for (const [artifactPath, schemaPath] of optionalArtifacts) {
    const payload = maybeReadJson(artifactPath);
    if (!payload) {
      warnings.push(`Optional artifact missing: ${path.basename(artifactPath)}.`);
      continue;
    }
    const issues = validateAgainstSchema(payload, loadSchema(schemaPath));
    checkedArtifacts.push(path.basename(artifactPath));
    blockers.push(...issues.map((issue) => `${path.basename(artifactPath)}: ${issue}`));
  }

  const variantStatePath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.variantStateModel);
  const componentSpecsPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentSpecs);
  const generationPlanPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.generationPlan);
  const codegenReportPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.codegenReport);
  const promotionManifestPath = replaceJsonSuffix(
    exportJsonPath,
    ARTIFACT_SUFFIXES.promotionManifest
  );
  const promotionApplyReportPath = replaceJsonSuffix(
    exportJsonPath,
    ARTIFACT_SUFFIXES.promotionApplyReport
  );
  const variantStatePayload = maybeReadJson(variantStatePath);
  const componentSpecsPayload = maybeReadJson(componentSpecsPath);
  const generationPlanPayload = maybeReadJson(generationPlanPath);
  const codegenReportPayload = maybeReadJson(codegenReportPath);
  const promotionManifestPayload = maybeReadJson(promotionManifestPath);
  const promotionApplyReportPayload = maybeReadJson(promotionApplyReportPath);

  if (variantStatePayload) {
    validateVariantStateModel(variantStatePath, variantStatePayload, blockers, warnings);
  }
  if (componentSpecsPayload) {
    validateComponentSpecsArtifact(componentSpecsPath, componentSpecsPayload, blockers, warnings);
  }
  if (generationPlanPayload) {
    validateGenerationPlanArtifact(generationPlanPath, generationPlanPayload, blockers, warnings);
  }
  if (codegenReportPayload) {
    validateCodegenReportArtifact(codegenReportPath, codegenReportPayload, blockers, warnings);
  }
  if (promotionManifestPayload) {
    validatePromotionManifestArtifact(
      promotionManifestPath,
      promotionManifestPayload,
      blockers,
      warnings
    );
  }
  if (promotionApplyReportPayload) {
    validatePromotionApplyReportArtifact(
      promotionApplyReportPath,
      promotionApplyReportPayload,
      blockers,
      warnings
    );
  }

  if (
    options.allowMissingArtifacts &&
    blockers.every((entry) => entry.startsWith("Missing artifact: "))
  ) {
    blockers.length = 0;
    warnings.push(
      "No generated pipeline artifacts found; schema set validated without export data."
    );
  }

  const score = Math.max(0, 100 - blockers.length * 20 - warnings.length * 5);
  const report = {
    artifactVersion: PIPELINE_VERSION,
    checkedArtifacts,
    blockers,
    warnings,
    summary: {
      score,
      status: blockers.length === 0 ? "pass" : "fail",
    },
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.qaReport);
  writeJson(outputPath, report);
  return { outputPath, report };
}

function main() {
  let exportJsonPath = null;
  try {
    exportJsonPath = resolveLatestRawExportJsonPath(explicitInputPath);
  } catch (error) {
    if (!allowMissingArtifacts) {
      throw error;
    }
  }

  if (!exportJsonPath) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason:
            "No raw Figma export bundle was found. Schema validation ran in allow-missing-artifacts mode.",
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const { outputPath, report } = validatePipelineArtifacts(exportJsonPath, {
    allowMissingArtifacts,
  });

  process.stdout.write(
    `${JSON.stringify({ ok: report.blockers.length === 0, outputPath, score: report.summary.score }, null, 2)}\n`
  );

  if (report.blockers.length > 0) {
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
