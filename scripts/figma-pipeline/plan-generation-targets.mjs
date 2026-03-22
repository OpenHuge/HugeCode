#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import { getFamilyDefinition } from "./shared/family-registry.mjs";
import { loadPipelineArtifacts, readPipelineArtifacts } from "./shared/load-artifacts.mjs";
import {
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
  readJson,
} from "./shared/paths.mjs";

function toPascalCase(value) {
  return String(value ?? "")
    .replace(/[^a-z0-9]+/giu, " ")
    .trim()
    .split(/\s+/u)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function buildTargetNotes(component, targetLayer, baseName) {
  const notes = [...(component.notes ?? [])];

  if (targetLayer === "app-adapter") {
    notes.push(
      `App adapter scaffolds belong under apps/code/src/design-system/adapters/${baseName} as app-only compatibility wrappers on top of @ku0/design-system.`,
      "After promotion, wire the family through apps/code/src/design-system/adapters/index.ts and then re-export it from apps/code/src/design-system/index.ts."
    );
  }

  return notes;
}

function buildTargetForComponent(component) {
  const familyDefinition = getFamilyDefinition(component.family);
  const baseName = toPascalCase(component.family);
  const targetLayer = component.generationTarget.targetLayer;
  const isShared =
    targetLayer === "design-system-primitive" || targetLayer === "design-system-component";
  const packagePath = isShared ? "packages/design-system" : "apps/code";
  const directoryPath =
    targetLayer === "design-system-primitive"
      ? `packages/design-system/src/primitives/${baseName}`
      : targetLayer === "design-system-component"
        ? `packages/design-system/src/components/${baseName}`
        : targetLayer === "app-adapter"
          ? `apps/code/src/design-system/adapters/${baseName}`
          : targetLayer === "app-pattern"
            ? `apps/code/src/design-system/app-patterns/${baseName}`
            : `apps/code/src/design-system/deferred/${baseName}`;
  const publicPath =
    targetLayer === "design-system-primitive" || targetLayer === "design-system-component"
      ? `@ku0/design-system/${baseName}`
      : `${directoryPath}/${baseName}.tsx`;
  const readinessStatus =
    component.status === "ready" && component.manualReview.length === 0 ? "ready" : "review";
  const unresolvedSemanticTokens = component.tokenDependencies.semantic.filter(
    (token) => token.status !== "mapped"
  );
  const blockers = [
    ...(component.status === "defer"
      ? ["Insufficient confidence or unresolved assumptions for code generation."]
      : []),
    ...component.manualReview,
    ...unresolvedSemanticTokens.map(
      (token) => `Semantic token ${token.path} is not mapped and must be reviewed before codegen.`
    ),
  ];

  return {
    componentName: component.name,
    family: component.family,
    status: component.status,
    targetLayer,
    packagePath,
    directoryPath,
    files: [
      { path: `${directoryPath}/${baseName}.tsx`, role: "component" },
      { path: `${directoryPath}/${baseName}.css.ts`, role: "styles" },
      { path: `${directoryPath}/${baseName}.test.tsx`, role: "test" },
      { path: `${directoryPath}/${baseName}.examples.tsx`, role: "examples" },
    ],
    exportStrategy: {
      publicPath,
      barrelExport: isShared,
    },
    stylingStrategy: {
      mode: familyDefinition.stylingStrategy,
      recipe: familyDefinition.stylingStrategy === "recipe",
      sprinkles: familyDefinition.stylingStrategy === "sprinkles",
      styleModule: true,
    },
    tokenStrategy: {
      semanticTokens: component.tokenDependencies.semantic,
      primitiveExceptions: component.tokenDependencies.primitiveExceptions,
      defaultPolicy: "semantic-first",
    },
    themeStrategy: {
      contract:
        packagePath === "packages/design-system"
          ? "shared semantic theme contract"
          : "apps/code semantic theme bridge",
      requiresThemeValues: component.tokenDependencies.semantic.length > 0,
    },
    hookDependencies: familyDefinition.hookDependencies,
    utilityDependencies: familyDefinition.utilityDependencies,
    dependsOn: [
      "semantic token contract coverage",
      ...(familyDefinition.utilityDependencies ?? []),
      ...(familyDefinition.hookDependencies ?? []),
    ],
    testRequirements: [
      "render smoke",
      isShared ? "public API contract" : "app integration smoke",
      component.accessibility.role ? "a11y assertions" : "structural assertions",
    ],
    exampleRequirements: ["default example", "state example", "token-consumption example"],
    codegenReadiness: {
      status: readinessStatus,
      confidence: component.confidence,
    },
    blockers,
    notes: buildTargetNotes(component, targetLayer, baseName),
  };
}

export function planGenerationTargets(exportJsonPath) {
  const artifacts = readPipelineArtifacts(exportJsonPath);
  const componentSpecsPath = loadPipelineArtifacts(exportJsonPath).componentSpecsPath;
  const componentSpecs = readJson(componentSpecsPath);

  const output = {
    artifactVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceManifest: artifacts.manifest.files?.json ?? artifacts.manifest.source?.nodeId ?? "",
    targets: componentSpecs.components.map((component) => buildTargetForComponent(component)),
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.generationPlan);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = planGenerationTargets(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, targets: output.targets.length }, null, 2)}\n`
  );
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
