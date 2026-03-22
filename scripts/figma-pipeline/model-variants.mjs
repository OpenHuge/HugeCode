#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import {
  deriveComponentKind,
  deriveSharedLevel,
  getFamilyDefinition,
  inferFamilyFromComponent,
  isInteractiveFamily,
} from "./shared/family-registry.mjs";
import { readPipelineArtifacts } from "./shared/load-artifacts.mjs";
import { replaceJsonSuffix, resolveLatestRawExportJsonPath, writeJson } from "./shared/paths.mjs";

const VARIANT_PATTERNS = [
  ["primary", /\bprimary\b/iu],
  ["secondary", /\bsecondary\b/iu],
  ["ghost", /\bghost\b/iu],
  ["danger", /\bdanger|destructive|error\b/iu],
  ["outline", /\boutline\b/iu],
  ["subtle", /\bsubtle\b/iu],
  ["solid", /\bsolid|filled\b/iu],
  ["segmented", /\bsegmented\b/iu],
  ["underline", /\bunderline\b/iu],
  ["interactive", /\binteractive\b/iu],
];

const SIZE_PATTERNS = [
  ["xs", /\b(xs|extra small)\b/iu],
  ["sm", /\b(sm|small)\b/iu],
  ["md", /\b(md|medium|default)\b/iu],
  ["lg", /\b(lg|large)\b/iu],
  ["xl", /\b(xl|extra large)\b/iu],
];

const TONE_PATTERNS = [
  ["neutral", /\bneutral|default\b/iu],
  ["accent", /\baccent|brand|primary\b/iu],
  ["success", /\bsuccess|positive|done\b/iu],
  ["warning", /\bwarning|caution\b/iu],
  ["danger", /\bdanger|error|destructive\b/iu],
  ["info", /\binfo\b/iu],
  ["muted", /\bmuted|quiet|subtle\b/iu],
];

const DENSITY_PATTERNS = [
  ["compact", /\bcompact|dense\b/iu],
  ["comfortable", /\bcomfortable|default\b/iu],
];

const PERSISTENT_STATE_PATTERNS = [
  ["selected", /\bselected|active|current\b/iu],
  ["disabled", /\bdisabled\b/iu],
  ["loading", /\bloading|busy|pending\b/iu],
  ["invalid", /\binvalid|error\b/iu],
  ["checked", /\bchecked\b/iu],
  ["indeterminate", /\bindeterminate\b/iu],
  ["open", /\bopen|expanded\b/iu],
  ["readonly", /\breadonly|read only\b/iu],
  ["empty", /\bempty|zero state|no results\b/iu],
  ["visible", /\bvisible|shown\b/iu],
];

const INTERACTION_BASELINE = ["hover", "focus-visible", "pressed"];

function uniqueByName(entries) {
  const byName = new Map();
  for (const entry of entries) {
    const existing = byName.get(entry.name);
    if (!existing || entry.confidence > existing.confidence) {
      byName.set(entry.name, entry);
    }
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function inferValuesFromPatterns(name, patterns, source, evidencePrefix) {
  return patterns
    .filter(([, pattern]) => pattern.test(name))
    .map(([valueName]) => ({
      name: valueName,
      source,
      confidence: 0.82,
      evidence: [`${evidencePrefix}: ${name}`],
    }));
}

function inferSlotModel(familyDefinition, node) {
  const slots = familyDefinition.slots.map((slotName) => ({
    name: slotName,
    required: ["label", "trigger", "content", "input", "control", "root"].includes(slotName),
    confidence: 0.72,
    source: "family-registry",
  }));

  if ((node?.childCount ?? 0) > 0 && familyDefinition.slots.length === 0) {
    return [
      {
        name: "children",
        required: true,
        confidence: 0.6,
        source: "node-children",
      },
    ];
  }

  return slots;
}

function buildFamilyModel(familyName, candidateComponents, nodesById) {
  const familyDefinition = getFamilyDefinition(familyName);
  const evidence = [];
  const variants = [];
  const sizes = [];
  const tones = [];
  const densities = [];
  const persistentStates = [];
  const interactionStates = [];
  const slotModel = [];
  const unresolvedAssumptions = [];
  const manualReview = [];
  const inferredRules = [];
  let confidenceTotal = 0;

  for (const component of candidateComponents) {
    const node = nodesById.get(component.sourceNodeId) ?? null;
    const familyInference = inferFamilyFromComponent(component, node);
    confidenceTotal += familyInference.confidence;
    evidence.push(
      ...familyInference.evidence.map((detail) => ({
        type: "family-inference",
        detail,
        componentName: component.name,
      }))
    );

    const componentName = String(component.name ?? "");
    variants.push(
      ...inferValuesFromPatterns(componentName, VARIANT_PATTERNS, "name-pattern", "variant")
    );
    sizes.push(...inferValuesFromPatterns(componentName, SIZE_PATTERNS, "name-pattern", "size"));
    tones.push(...inferValuesFromPatterns(componentName, TONE_PATTERNS, "name-pattern", "tone"));
    densities.push(
      ...inferValuesFromPatterns(componentName, DENSITY_PATTERNS, "name-pattern", "density")
    );
    persistentStates.push(
      ...inferValuesFromPatterns(
        componentName,
        PERSISTENT_STATE_PATTERNS,
        "name-pattern",
        "persistent-state"
      )
    );
    slotModel.push(...inferSlotModel(familyDefinition, node));
  }

  if (variants.length === 0 && familyDefinition.variants.length > 0) {
    inferredRules.push(
      "No explicit source-named visual variants were found; keep family baseline variants in review-only mode."
    );
    manualReview.push(
      "Confirm whether baseline family variants are present in Figma before codegen."
    );
  }

  if (sizes.length === 0 && familyDefinition.sizes.length > 0) {
    inferredRules.push(
      "No explicit size labels were found; size support should remain opt-in until source evidence appears."
    );
  }

  if (tones.length === 0 && familyDefinition.tones.length > 0) {
    inferredRules.push(
      "Tone values default to family registry expectations; verify source-specific tone coverage manually."
    );
  }

  if (densities.length === 0 && familyDefinition.densities.length > 0) {
    inferredRules.push(
      "Density is not directly labeled in source names; treat density support as provisional."
    );
  }

  if (isInteractiveFamily(familyName)) {
    interactionStates.push(
      ...familyDefinition.interactionStates.map((stateName) => ({
        name: stateName,
        source: "interactive-family-baseline",
        confidence: INTERACTION_BASELINE.includes(stateName) ? 0.68 : 0.62,
        evidence: [`Interactive family ${familyName} requires ${stateName} treatment.`],
      }))
    );
    if (persistentStates.length === 0 && familyDefinition.persistentStates.length > 0) {
      unresolvedAssumptions.push({
        reason:
          "Persistent state support is defined by family baseline but not explicitly evidenced in source naming.",
        confidence: 0.54,
      });
      manualReview.push("Review disabled/invalid/loading state coverage before codegen.");
    }
  }

  const normalizedConfidence =
    candidateComponents.length === 0
      ? 0
      : Number((confidenceTotal / candidateComponents.length).toFixed(2));

  return {
    familyName,
    candidateComponents: candidateComponents.map((component) => ({
      name: component.name,
      sourceNodeId: component.sourceNodeId,
      classification: component.classification,
      shared: component.shared,
      sharedLevel: deriveSharedLevel(familyName, component),
      kind: deriveComponentKind(familyName, component),
      occurrences: component.occurrences,
      confidence: component.confidence,
    })),
    confidence: normalizedConfidence,
    evidence,
    variants: uniqueByName(variants),
    sizes: uniqueByName(sizes),
    tones: uniqueByName(tones),
    densities: uniqueByName(densities),
    persistentStates: uniqueByName(
      persistentStates.length > 0
        ? persistentStates
        : familyDefinition.persistentStates.map((stateName) => ({
            name: stateName,
            source: "family-registry",
            confidence: 0.58,
            evidence: [`Family ${familyName} baseline includes ${stateName}.`],
          }))
    ),
    interactionStates: uniqueByName(interactionStates),
    slotModel: uniqueByName(slotModel),
    inferredRules,
    unresolvedAssumptions,
    manualReview,
  };
}

export function modelVariants(exportJsonPath) {
  const { manifest, graph, inventory } = readPipelineArtifacts(exportJsonPath);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const families = new Map();

  for (const component of inventory.components) {
    const node = nodesById.get(component.sourceNodeId) ?? null;
    const { familyName } = inferFamilyFromComponent(component, node);
    if (!families.has(familyName)) {
      families.set(familyName, []);
    }
    families.get(familyName)?.push(component);
  }

  const output = {
    artifactVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceManifest:
      manifest.files?.json ?? manifest.files?.summary ?? manifest.source?.nodeId ?? "",
    families: [...families.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([familyName, candidateComponents]) =>
        buildFamilyModel(familyName, candidateComponents, nodesById)
      ),
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.variantStateModel);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = modelVariants(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, families: output.families.length }, null, 2)}\n`
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
