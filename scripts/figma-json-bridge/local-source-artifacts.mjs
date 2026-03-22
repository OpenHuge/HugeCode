import fs from "node:fs";
import path from "node:path";

import { findLatestArtifactBundleForSelection, writeArtifactBundle } from "./artifact-helpers.mjs";

function cloneJsonValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function findNodeById(node, targetNodeId) {
  if (!node || typeof node !== "object") {
    return null;
  }
  if (node.id === targetNodeId) {
    return node;
  }

  for (const child of Array.isArray(node.children) ? node.children : []) {
    const match = findNodeById(child, targetNodeId);
    if (match) {
      return match;
    }
  }

  return null;
}

function buildOutput(artifact) {
  return {
    jsonPath: path.relative(process.cwd(), artifact.jsonPath),
    summaryPath: path.relative(process.cwd(), artifact.summaryPath),
    manifestPath: path.relative(process.cwd(), artifact.manifestPath),
    pngPath: artifact.pngPath ? path.relative(process.cwd(), artifact.pngPath) : null,
    svgPath: artifact.svgPath ? path.relative(process.cwd(), artifact.svgPath) : null,
  };
}

function resolveCurrentPage(sourcePayload) {
  if (sourcePayload?.currentPage) {
    return cloneJsonValue(sourcePayload.currentPage);
  }

  if (sourcePayload?.selection?.type === "CANVAS") {
    return {
      id: sourcePayload.selection.id,
      name: sourcePayload.selection.name,
    };
  }

  return null;
}

function buildLocalSubtreePayload(sourcePayload, target) {
  const rootNode = sourcePayload?.document?.document ?? null;
  const subtreeNode = findNodeById(rootNode, target?.target?.nodeId ?? "");
  if (!subtreeNode) {
    return null;
  }

  return {
    exportedAt: new Date().toISOString(),
    fileKey: sourcePayload.fileKey ?? target?.target?.fileKey ?? null,
    currentPage: resolveCurrentPage(sourcePayload),
    selection: {
      id: subtreeNode.id,
      name: subtreeNode.name ?? target?.target?.nodeName ?? "Focused Figma Node",
      type: subtreeNode.type ?? target?.target?.nodeType ?? "UNKNOWN",
    },
    requestedTarget: {
      raw: `${sourcePayload.fileKey ?? target?.target?.fileKey ?? "unknown"}:${target?.target?.nodeId ?? "unknown"}`,
      fileKey: sourcePayload.fileKey ?? target?.target?.fileKey ?? null,
      nodeId: target?.target?.nodeId ?? null,
      registryResourceId: target?.resourceId ?? null,
      source: "local-source-export",
      sourceSelectionId: sourcePayload?.selection?.id ?? null,
      sourceSelectionName: sourcePayload?.selection?.name ?? null,
      sourceExportedAt: sourcePayload?.exportedAt ?? null,
    },
    documentMeta: cloneJsonValue(sourcePayload?.documentMeta ?? null),
    document: {
      document: cloneJsonValue(subtreeNode),
      schemaVersion: sourcePayload?.document?.schemaVersion ?? null,
      components: {},
      componentSets: {},
      styles: {},
    },
    resources: {
      pngBase64: "",
      svgString: "",
    },
  };
}

export function findReusableFocusedArtifact(target, options) {
  const maxCacheAgeMinutes = Number.isFinite(options.maxCacheAgeMinutes)
    ? Number(options.maxCacheAgeMinutes)
    : Number(target?.cachePolicy?.maxCacheAgeMinutes ?? 360);
  if (!Number.isFinite(maxCacheAgeMinutes) || maxCacheAgeMinutes < 0 || options.refresh) {
    return null;
  }

  const bundle = findLatestArtifactBundleForSelection(
    options.outputDir,
    target?.target?.fileKey ?? "",
    target?.target?.nodeId ?? ""
  );
  if (!bundle?.jsonPath) {
    return null;
  }

  const ageMs = Date.now() - bundle.createdAtMs;
  if (ageMs > maxCacheAgeMinutes * 60 * 1000) {
    return null;
  }

  return {
    ok: true,
    source: "local-artifact-cache",
    input: {
      fileKey: target?.target?.fileKey ?? null,
      nodeId: target?.target?.nodeId ?? null,
      registryResourceId: target?.resourceId ?? null,
      apiBaseUrl: options.apiBaseUrl,
      maxCacheAgeMinutes,
    },
    output: {
      jsonPath: path.relative(process.cwd(), bundle.jsonPath),
      summaryPath: bundle.summaryPath ? path.relative(process.cwd(), bundle.summaryPath) : null,
      manifestPath: bundle.manifestPath ? path.relative(process.cwd(), bundle.manifestPath) : null,
      pngPath: bundle.pngPath ? path.relative(process.cwd(), bundle.pngPath) : null,
      svgPath: bundle.svgPath ? path.relative(process.cwd(), bundle.svgPath) : null,
    },
    cache: {
      hit: true,
      ageMs,
    },
    summary: bundle.summaryPath
      ? cloneJsonValue(JSON.parse(fs.readFileSync(bundle.summaryPath, "utf8")))
      : null,
  };
}

export function materializeFocusedArtifactFromLocalSource(sourcePayload, target, options) {
  if (!sourcePayload || sourcePayload.fileKey !== target?.target?.fileKey) {
    return null;
  }

  const payload = buildLocalSubtreePayload(sourcePayload, target);
  if (!payload) {
    return null;
  }

  const artifact = writeArtifactBundle(payload, options.outputDir);
  const maxCacheAgeMinutes = Number.isFinite(options.maxCacheAgeMinutes)
    ? Number(options.maxCacheAgeMinutes)
    : Number(target?.cachePolicy?.maxCacheAgeMinutes ?? 360);

  return {
    ok: true,
    source: "local-source-export",
    input: {
      fileKey: target?.target?.fileKey ?? null,
      nodeId: target?.target?.nodeId ?? null,
      registryResourceId: target?.resourceId ?? null,
      apiBaseUrl: options.apiBaseUrl,
      maxCacheAgeMinutes: Number.isFinite(maxCacheAgeMinutes) ? maxCacheAgeMinutes : null,
    },
    output: buildOutput(artifact),
    cache: {
      hit: false,
      ageMs: null,
    },
    summary: artifact.summary,
  };
}
