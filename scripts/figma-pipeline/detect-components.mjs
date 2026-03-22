#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ARTIFACT_SUFFIXES,
  PIPELINE_VERSION,
  SHARED_COMPONENT_ELIGIBILITY,
  SUPPORTED_COMPONENT_CLASSIFICATIONS,
} from "./shared/contracts.mjs";
import { slugify, stableSignature, valueFrequencyMap } from "./shared/normalize.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

function classifyComponent(node) {
  if (node.role === "layout" || /^(stack|inline|row|column|group)$/iu.test(node.name)) {
    return "primitive";
  }
  if (/page|screen|layout/iu.test(node.name) && (node.childCount ?? 0) > 6) {
    return "page-pattern";
  }
  return "composite";
}

export function detectComponents(exportJsonPath) {
  const graphPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.classifiedNodeGraph);
  const graph = readJson(graphPath);
  const candidateNodes = graph.nodes.filter((node) =>
    ["component-set", "component", "instance", "interactive-candidate", "layout", "frame"].includes(
      node.role
    )
  );

  const signatures = candidateNodes.map((node) => ({
    node,
    signature: stableSignature([
      slugify(node.name),
      node.type,
      node.role,
      node.childCount,
      node.layout?.mode ?? "none",
      node.repeatGroupId ?? "single",
    ]),
  }));
  const frequency = valueFrequencyMap(signatures.map((entry) => entry.signature));
  const components = signatures.map(({ node, signature }) => {
    const occurrences = frequency.get(signature) ?? 1;
    const classification = classifyComponent(node);
    const shared =
      classification !== "page-pattern" &&
      occurrences >= SHARED_COMPONENT_ELIGIBILITY.minOccurrences &&
      node.confidence >= SHARED_COMPONENT_ELIGIBILITY.minConfidence;

    return {
      name: node.name,
      signature,
      sourceNodeId: node.id,
      classification: SUPPORTED_COMPONENT_CLASSIFICATIONS.includes(classification)
        ? classification
        : "composite",
      shared,
      occurrences,
      confidence: Number(Math.min(0.99, node.confidence + (occurrences > 1 ? 0.08 : 0)).toFixed(2)),
      rationale: shared
        ? "Repeated structure with stable role signature."
        : "Keep local until repetition or semantic stability improves.",
    };
  });

  const output = {
    artifactVersion: PIPELINE_VERSION,
    sourceGraphRef: graphPath.split(/[\\/]/u).pop(),
    components,
    summary: {
      totalCandidates: components.length,
      sharedCount: components.filter((component) => component.shared).length,
      localCount: components.filter((component) => !component.shared).length,
    },
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentInventory);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = detectComponents(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, sharedCount: output.summary.sharedCount }, null, 2)}\n`
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
