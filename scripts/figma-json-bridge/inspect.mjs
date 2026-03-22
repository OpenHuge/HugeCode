#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { assessExportScope } from "../figma-pipeline/shared/export-scope.mjs";
import { resolveLatestRawExportJsonPath } from "../figma-pipeline/shared/paths.mjs";

function collectNodes(node, bucket) {
  if (!node || typeof node !== "object") {
    return;
  }

  bucket.nodes += 1;
  const nodeType = typeof node.type === "string" ? node.type : "UNKNOWN";
  bucket.nodeTypes.set(nodeType, (bucket.nodeTypes.get(nodeType) ?? 0) + 1);

  if (typeof node.name === "string" && node.name.length > 0) {
    bucket.names.push(node.name);
  }

  if (Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (!fill || typeof fill !== "object") {
        continue;
      }
      if (fill.type === "SOLID" && fill.color && typeof fill.color === "object") {
        const hex = toHex(fill.color);
        if (hex) {
          bucket.colors.set(hex, (bucket.colors.get(hex) ?? 0) + 1);
        }
      }
      if (fill.type === "IMAGE") {
        const imageRef = typeof fill.imageRef === "string" ? fill.imageRef : null;
        if (imageRef) {
          bucket.imageRefs.add(imageRef);
        }
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectNodes(child, bucket);
    }
  }
}

function clampChannel(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function toHex(color) {
  const red = clampChannel(color.r);
  const green = clampChannel(color.g);
  const blue = clampChannel(color.b);
  return `#${red.toString(16).padStart(2, "0")}${green
    .toString(16)
    .padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function buildSummary(payload) {
  const bucket = {
    nodes: 0,
    nodeTypes: new Map(),
    colors: new Map(),
    imageRefs: new Set(),
    names: [],
  };

  const rootNode = payload?.document?.document ?? null;
  collectNodes(rootNode, bucket);

  const topNodeTypes = [...bucket.nodeTypes.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }));

  const topColors = [...bucket.colors.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([hex, count]) => ({ hex, count }));

  return {
    fileKey: payload?.fileKey ?? null,
    selection: payload?.selection ?? null,
    currentPage: payload?.currentPage ?? null,
    exportedAt: payload?.exportedAt ?? null,
    nodeCount: bucket.nodes,
    topNodeTypes,
    topColors,
    imageRefCount: bucket.imageRefs.size,
    imageRefs: [...bucket.imageRefs].slice(0, 20),
    sampleNames: bucket.names.slice(0, 20),
    hasPngPreview:
      typeof payload?.resources?.pngBase64 === "string" && payload.resources.pngBase64.length > 0,
    hasSvgPreview:
      typeof payload?.resources?.svgString === "string" && payload.resources.svgString.length > 0,
  };
}

function resolveInputPath(argument) {
  if (argument) {
    return path.resolve(argument);
  }
  return resolveLatestRawExportJsonPath();
}

function main() {
  const inputPath = resolveInputPath(process.argv[2]);
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const summary = buildSummary(payload);
  const workflowRecommendation = assessExportScope(summary);
  const manifestPath = inputPath.endsWith(".json")
    ? `${inputPath.slice(0, -".json".length)}.manifest.json`
    : null;
  process.stdout.write(
    `${JSON.stringify(
      {
        inputPath,
        manifestPath: manifestPath && fs.existsSync(manifestPath) ? manifestPath : null,
        summary,
        workflowRecommendation,
      },
      null,
      2
    )}\n`
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
