#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ARTIFACT_SUFFIXES,
  PIPELINE_VERSION,
  SUPPORTED_NODE_ROLE_VALUES,
} from "./shared/contracts.mjs";
import {
  normalizeNodeId,
  slugify,
  stableSignature,
  toArray,
  valueFrequencyMap,
} from "./shared/normalize.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

function inferRole(node) {
  const nodeType = String(node?.type ?? "").toUpperCase();

  if (nodeType === "PAGE") {
    return { role: "page", confidence: 1 };
  }
  if (nodeType === "SECTION") {
    return { role: "section", confidence: 0.98 };
  }
  if (nodeType === "COMPONENT_SET") {
    return { role: "component-set", confidence: 0.98 };
  }
  if (nodeType === "COMPONENT") {
    return { role: "component", confidence: 0.97 };
  }
  if (nodeType === "INSTANCE") {
    return { role: "instance", confidence: 0.96 };
  }
  if (nodeType === "TEXT") {
    return { role: "text", confidence: 0.98 };
  }
  if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"].includes(nodeType)) {
    return { role: "vector", confidence: 0.92 };
  }
  if (Array.isArray(node?.fills) && node.fills.some((fill) => fill?.type === "IMAGE")) {
    return { role: "image", confidence: 0.92 };
  }
  if (
    typeof node?.layoutMode === "string" &&
    ["HORIZONTAL", "VERTICAL"].includes(node.layoutMode.toUpperCase())
  ) {
    return { role: "layout", confidence: 0.88 };
  }
  if (
    typeof node?.name === "string" &&
    /(button|input|select|tab|menu|dialog|toast)/iu.test(node.name)
  ) {
    return { role: "interactive-candidate", confidence: 0.72 };
  }
  if (Array.isArray(node?.children) && node.children.length > 0) {
    return { role: "frame", confidence: 0.74 };
  }
  if (nodeType.length > 0) {
    return { role: "shape", confidence: 0.66 };
  }

  return { role: "unknown", confidence: 0.4 };
}

function createNodeEntry(node, parentId, depth, pathSegments) {
  const { role, confidence } = inferRole(node);
  const childCount = Array.isArray(node?.children) ? node.children.length : 0;
  const fills = toArray(node?.fills)
    .map((fill) => fill?.type)
    .filter(Boolean);
  const strokes = toArray(node?.strokes)
    .map((stroke) => stroke?.type)
    .filter(Boolean);
  const pathValue = [...pathSegments, slugify(node?.name || node?.type || node?.id || "node")]
    .filter(Boolean)
    .join("/");

  return {
    id: normalizeNodeId(node?.id ?? `unknown-${pathValue}`),
    parentId,
    name: String(node?.name ?? node?.type ?? "Unnamed node"),
    type: String(node?.type ?? "UNKNOWN"),
    role: SUPPORTED_NODE_ROLE_VALUES.includes(role) ? role : "unknown",
    path: pathValue,
    depth,
    confidence,
    childCount,
    layout:
      typeof node?.layoutMode === "string"
        ? {
            mode: node.layoutMode.toLowerCase(),
            itemSpacing: typeof node?.itemSpacing === "number" ? node.itemSpacing : null,
            padding: {
              top: typeof node?.paddingTop === "number" ? node.paddingTop : null,
              right: typeof node?.paddingRight === "number" ? node.paddingRight : null,
              bottom: typeof node?.paddingBottom === "number" ? node.paddingBottom : null,
              left: typeof node?.paddingLeft === "number" ? node.paddingLeft : null,
            },
          }
        : null,
    size: {
      width:
        typeof node?.absoluteBoundingBox?.width === "number"
          ? node.absoluteBoundingBox.width
          : null,
      height:
        typeof node?.absoluteBoundingBox?.height === "number"
          ? node.absoluteBoundingBox.height
          : null,
    },
    styleRefs: {
      fills,
      strokes,
      effects: toArray(node?.effects)
        .map((effect) => effect?.type)
        .filter(Boolean),
      textStyle:
        node?.type === "TEXT"
          ? {
              fontFamily: node?.style?.fontFamily ?? null,
              fontWeight: node?.style?.fontWeight ?? null,
              fontSize: node?.style?.fontSize ?? null,
              lineHeightPx: node?.style?.lineHeightPx ?? null,
            }
          : null,
    },
    repeatSignature: stableSignature([
      node?.type ?? "UNKNOWN",
      role,
      childCount,
      node?.layoutMode ?? "NONE",
      fills.join(","),
      strokes.join(","),
    ]),
  };
}

function walkNodes(node, parentId, depth, pathSegments, entries) {
  const entry = createNodeEntry(node, parentId, depth, pathSegments);
  entries.push(entry);

  for (const child of toArray(node?.children)) {
    walkNodes(child, entry.id, depth + 1, [...pathSegments, slugify(entry.name)], entries);
  }
}

export function classifyExport(exportJsonPath) {
  const payload = readJson(exportJsonPath);
  const rootNode = payload?.document?.document ?? payload?.document ?? null;
  if (!rootNode || typeof rootNode !== "object") {
    throw new Error(`Export payload ${exportJsonPath} did not contain document.document.`);
  }

  const nodes = [];
  walkNodes(rootNode, null, 0, [], nodes);

  const signatureFrequency = valueFrequencyMap(nodes.map((entry) => entry.repeatSignature));
  const nodeTypes = valueFrequencyMap(nodes.map((entry) => entry.type));
  const roles = valueFrequencyMap(nodes.map((entry) => entry.role));

  const enrichedNodes = nodes.map((entry) => ({
    ...entry,
    repeatGroupId:
      (signatureFrequency.get(entry.repeatSignature) ?? 0) > 1 ? entry.repeatSignature : null,
  }));

  const output = {
    artifactVersion: PIPELINE_VERSION,
    manifestRef: path.basename(replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.rawManifest)),
    source: {
      exportJson: path.basename(exportJsonPath),
      fileKey: payload?.fileKey ?? null,
      nodeId: payload?.selection?.id ?? null,
      page: payload?.currentPage ?? null,
      selection: payload?.selection ?? null,
    },
    summary: {
      totalNodes: enrichedNodes.length,
      totalRepeatGroups: new Set(enrichedNodes.map((entry) => entry.repeatGroupId).filter(Boolean))
        .size,
      nodeTypes: Object.fromEntries(nodeTypes),
      roles: Object.fromEntries(roles),
    },
    nodes: enrichedNodes,
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.classifiedNodeGraph);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = classifyExport(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, totalNodes: output.summary.totalNodes }, null, 2)}\n`
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
