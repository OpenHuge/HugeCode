#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ARTIFACT_SUFFIXES,
  PIPELINE_VERSION,
  SUPPORTED_COMPONENT_SPEC_KINDS,
} from "./shared/contracts.mjs";
import {
  deriveComponentKind,
  deriveSharedLevel,
  deriveTargetLayer,
  getFamilyDefinition,
  inferFamilyFromComponent,
  isInteractiveFamily,
} from "./shared/family-registry.mjs";
import { loadPipelineArtifacts, readPipelineArtifacts } from "./shared/load-artifacts.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

const COMMON_SLOT_PROPS = new Map([
  ["label", "Human-readable label slot content."],
  ["description", "Supporting description slot content."],
  ["errorMessage", "Validation message slot content."],
  ["leadingIcon", "Leading icon slot content."],
  ["trailingIcon", "Trailing icon slot content."],
  ["icon", "Icon slot content."],
  ["prefix", "Leading adornment slot content."],
  ["suffix", "Trailing adornment slot content."],
  ["header", "Header slot content."],
  ["footer", "Footer slot content."],
  ["title", "Title slot content."],
  ["action", "Action slot content."],
  ["trigger", "Trigger slot content."],
  ["fallback", "Fallback slot content."],
  ["badge", "Badge/meta slot content."],
]);

function buildPropList(familyName, familyModel, kind) {
  const familyDefinition = getFamilyDefinition(familyName);
  const props = [
    {
      name: "className",
      type: "string | undefined",
      required: false,
      source: "repo-convention",
      rationale: "Allow consumer-level class composition.",
    },
  ];

  if (kind !== "local-pattern") {
    props.push({
      name: "children",
      type: "ReactNode",
      required: familyDefinition.slots.length === 0,
      source: "family-registry",
      rationale: "Default composition slot.",
    });
  }

  for (const slotName of familyDefinition.slots) {
    const slotRationale = COMMON_SLOT_PROPS.get(slotName);
    if (!slotRationale) {
      continue;
    }
    if (props.some((prop) => prop.name === slotName)) {
      continue;
    }
    props.push({
      name: slotName,
      type: "ReactNode | undefined",
      required: false,
      source: "family-registry-slot",
      rationale: slotRationale,
    });
  }

  if (familyModel.variants.length > 0) {
    props.push({
      name: "variant",
      type: familyModel.variants.map((entry) => `"${entry.name}"`).join(" | "),
      required: false,
      source: "variant-state-model",
      rationale: "Normalized visual variant axis.",
    });
  }
  if (familyModel.sizes.length > 0) {
    props.push({
      name: "size",
      type: familyModel.sizes.map((entry) => `"${entry.name}"`).join(" | "),
      required: false,
      source: "variant-state-model",
      rationale: "Normalized size axis.",
    });
  }
  if (familyModel.tones.length > 0) {
    props.push({
      name: "tone",
      type: familyModel.tones.map((entry) => `"${entry.name}"`).join(" | "),
      required: false,
      source: "variant-state-model",
      rationale: "Semantic tone axis.",
    });
  }
  if (familyModel.densities.length > 0) {
    props.push({
      name: "density",
      type: familyModel.densities.map((entry) => `"${entry.name}"`).join(" | "),
      required: false,
      source: "variant-state-model",
      rationale: "Normalized density axis.",
    });
  }

  if (isInteractiveFamily(familyName)) {
    props.push({
      name: "disabled",
      type: "boolean | undefined",
      required: false,
      source: "interactive-family-baseline",
      rationale: "Interactive controls must expose disabled semantics.",
    });
  }

  if ((familyModel.persistentStates ?? []).some((entry) => entry.name === "loading")) {
    props.push({
      name: "loading",
      type: "boolean | undefined",
      required: false,
      source: "variant-state-model",
      rationale: "Persistent loading state exposed as a first-class prop.",
    });
  }

  if ((familyModel.persistentStates ?? []).some((entry) => entry.name === "invalid")) {
    props.push({
      name: "invalid",
      type: "boolean | undefined",
      required: false,
      source: "variant-state-model",
      rationale: "Validation state should not be encoded with ad hoc booleans.",
    });
  }

  if ((familyModel.persistentStates ?? []).some((entry) => entry.name === "selected")) {
    props.push({
      name: "selected",
      type: "boolean | undefined",
      required: false,
      source: "variant-state-model",
      rationale: "Selection state is persistent and should be explicit.",
    });
  }

  if (familyName === "Button" || familyName === "IconButton") {
    props.push({
      name: "type",
      type: '"button" | "submit" | "reset" | undefined',
      required: false,
      source: "react-api-rule",
      rationale: "Button semantics require explicit type handling.",
    });
  }

  if (familyName === "Input" || familyName === "Textarea" || familyName === "Select") {
    props.push(
      {
        name: "value",
        type: "string | undefined",
        required: false,
        source: "controlled-pattern",
        rationale: "Supports controlled usage.",
      },
      {
        name: "defaultValue",
        type: "string | undefined",
        required: false,
        source: "controlled-pattern",
        rationale: "Supports uncontrolled usage.",
      },
      {
        name: "onValueChange",
        type: "(value: string) => void",
        required: false,
        source: "controlled-pattern",
        rationale: "Normalized value-change callback.",
      }
    );
  }

  if (familyName === "Dialog" || familyName === "Tabs") {
    props.push({
      name: familyName === "Dialog" ? "open" : "value",
      type: "string | boolean | undefined",
      required: false,
      source: "composite-control",
      rationale: "Supports controlled stateful composition.",
    });
  }
  if (familyName === "Tabs") {
    props.push({
      name: "orientation",
      type: '"horizontal" | "vertical" | undefined',
      required: false,
      source: "family-registry",
      rationale: "Tablist orientation changes keyboard and layout behavior.",
    });
  }

  return props;
}

function buildAccessibilityContract(familyName, familyModel) {
  const definition = getFamilyDefinition(familyName);
  return {
    role: definition.a11y.role,
    keyboard: definition.a11y.keyboard,
    labels: definition.a11y.labels,
    requiredStates: familyModel.persistentStates.map((entry) => entry.name),
    notes: isInteractiveFamily(familyName)
      ? ["Focus-visible treatment and accessible naming are mandatory."]
      : ["Use semantic HTML where applicable."],
  };
}

function buildStylingContract(familyName, sharedLevel, targetLayer, semanticMappings) {
  const definition = getFamilyDefinition(familyName);
  const semanticTokenCandidates = definition.tokenDependencies.map((tokenPath) => {
    const mapping = semanticMappings.find((entry) => entry.path === tokenPath) ?? null;
    return {
      path: tokenPath,
      status: mapping ? "mapped" : "unmapped",
      primitiveRef: mapping?.primitiveRef ?? null,
      confidence: mapping?.confidence ?? 0,
      source: mapping?.source ?? "family-registry",
      reason: mapping
        ? "Resolved against semantic token artifact."
        : "Semantic token path is not mapped yet.",
    };
  });

  return {
    approach: definition.stylingStrategy,
    recipeRecommendation: definition.stylingStrategy === "recipe",
    sprinklesRecommendation: definition.stylingStrategy === "sprinkles",
    semanticTokenDefault: true,
    rawPrimitiveExceptions: [],
    tokenDependencies: semanticTokenCandidates,
    notes: [
      `Target layer ${targetLayer} should consume semantic tokens by default.`,
      sharedLevel.startsWith("shared")
        ? "Implementation belongs in packages/design-system."
        : "Implementation remains app-local until shared evidence improves.",
    ],
  };
}

function buildImplementationBoundary(sharedLevel, familyName) {
  const targetLayer = deriveTargetLayer(sharedLevel);
  const owner =
    targetLayer === "design-system-primitive" || targetLayer === "design-system-component"
      ? "packages/design-system"
      : "apps/code";

  return {
    owner,
    sharedLevel,
    boundaryReason:
      targetLayer === "app-pattern"
        ? "Candidate remains app-local because reuse evidence is insufficient."
        : `Family ${familyName} maps to ${targetLayer}.`,
  };
}

function buildStatus(confidence, sharedLevel, manualReviewCount) {
  if (sharedLevel === "defer" || confidence < 0.55) {
    return "defer";
  }
  if (manualReviewCount > 0 || confidence < 0.75) {
    return "review";
  }
  return "ready";
}

export function generateComponentSpecs(exportJsonPath) {
  const artifacts = readPipelineArtifacts(exportJsonPath);
  const variantStatePath = loadPipelineArtifacts(exportJsonPath).variantStatePath;
  const variantStateModel = readJson(variantStatePath);
  const nodesById = new Map(artifacts.graph.nodes.map((node) => [node.id, node]));
  const familyModels = new Map(
    variantStateModel.families.map((family) => [family.familyName, family])
  );
  const semanticMappings = artifacts.semantics.mappings ?? [];

  const components = artifacts.inventory.components.map((component) => {
    const node = nodesById.get(component.sourceNodeId) ?? null;
    const inferredFamily = inferFamilyFromComponent(component, node).familyName;
    const familyModel = familyModels.get(inferredFamily);
    const familyDefinition = getFamilyDefinition(inferredFamily);
    const kind = deriveComponentKind(inferredFamily, component);
    const safeKind = SUPPORTED_COMPONENT_SPEC_KINDS.includes(kind) ? kind : "composite";
    const sharedLevel = deriveSharedLevel(inferredFamily, component);
    const targetLayer = deriveTargetLayer(sharedLevel);
    const confidence = Number(
      ((component.confidence + (familyModel?.confidence ?? 0.6)) / 2).toFixed(2)
    );
    const manualReview = [...(familyModel?.manualReview ?? [])];
    const unresolvedAssumptions = [...(familyModel?.unresolvedAssumptions ?? [])];
    const safeFamilyModel = familyModel ?? {
      variants: [],
      sizes: [],
      tones: [],
      densities: [],
      persistentStates: [],
      interactionStates: [],
      slotModel: [],
      inferredRules: [],
      unresolvedAssumptions: [],
      manualReview: [],
    };
    const styling = buildStylingContract(
      inferredFamily,
      sharedLevel,
      targetLayer,
      semanticMappings
    );
    const semanticDependencies = styling.tokenDependencies;
    const unmappedSemanticDependencies = semanticDependencies.filter(
      (dependency) => dependency.status !== "mapped"
    );

    if (unmappedSemanticDependencies.length > 0) {
      unresolvedAssumptions.push({
        reason: `Semantic token mappings still missing for ${unmappedSemanticDependencies
          .map((dependency) => dependency.path)
          .join(", ")}.`,
        confidence: 0.48,
      });
      manualReview.push("Confirm semantic token coverage before enabling code generation.");
    }
    const status = buildStatus(confidence, sharedLevel, manualReview.length);

    return {
      name: component.name,
      family: inferredFamily,
      kind: safeKind,
      sharedLevel,
      confidence,
      status,
      purpose: familyDefinition.purpose,
      sourcePatterns: [component.signature, component.rationale],
      anatomy: familyDefinition.anatomy.map((part) => ({
        name: part,
        role: part,
        required: part === "root" || part === "label" || part === "content",
      })),
      props: buildPropList(inferredFamily, safeFamilyModel, safeKind),
      variants: safeFamilyModel.variants,
      sizes: safeFamilyModel.sizes,
      tones: safeFamilyModel.tones,
      densities: safeFamilyModel.densities,
      states: {
        persistent: safeFamilyModel.persistentStates,
        interaction: safeFamilyModel.interactionStates,
      },
      slots: safeFamilyModel.slotModel,
      accessibility: buildAccessibilityContract(inferredFamily, safeFamilyModel),
      styling,
      tokenDependencies: {
        semantic: semanticDependencies,
        primitiveExceptions: [],
      },
      implementationBoundary: buildImplementationBoundary(sharedLevel, inferredFamily),
      generationTarget: {
        targetLayer,
        owner: targetLayer.startsWith("design-system") ? "packages/design-system" : "apps/code",
        readiness: status,
        directoryHint:
          targetLayer === "design-system-primitive"
            ? `packages/design-system/src/primitives/${inferredFamily}`
            : targetLayer === "design-system-component"
              ? `packages/design-system/src/components/${inferredFamily}`
              : targetLayer === "app-adapter"
                ? `apps/code/src/design-system/adapters/${inferredFamily}`
                : `apps/code/src/design-system/app-patterns/${inferredFamily}`,
      },
      notes: safeFamilyModel.inferredRules,
      unresolvedAssumptions,
      manualReview,
    };
  });

  const output = {
    artifactVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceManifest: artifacts.manifest.files?.json ?? artifacts.manifest.source?.nodeId ?? "",
    components,
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentSpecs);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = generateComponentSpecs(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, components: output.components.length }, null, 2)}\n`
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
