import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_MAX_ARTIFACT_BUNDLES = 3;
const DEFAULT_MAX_ARTIFACT_BUNDLES_PER_SELECTION = 1;

function toHex(color) {
  if (!color || typeof color !== "object") {
    return null;
  }

  const channels = [color.r, color.g, color.b].map((value) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(255, Math.round(value * 255)));
  });

  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function collectNodeSummary(node, summary) {
  if (!node || typeof node !== "object") {
    return;
  }

  summary.nodeCount += 1;
  const nodeType = typeof node.type === "string" ? node.type : "UNKNOWN";
  summary.nodeTypes[nodeType] = (summary.nodeTypes[nodeType] ?? 0) + 1;

  if (typeof node.name === "string" && node.name.length > 0 && summary.sampleNames.length < 20) {
    summary.sampleNames.push(node.name);
  }

  if (Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (!fill || typeof fill !== "object") {
        continue;
      }
      if (fill.type === "SOLID") {
        const hex = toHex(fill.color);
        if (hex) {
          summary.colors[hex] = (summary.colors[hex] ?? 0) + 1;
        }
      }
      if (fill.type === "IMAGE" && typeof fill.imageRef === "string") {
        summary.imageRefs.push(fill.imageRef);
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectNodeSummary(child, summary);
    }
  }
}

export function buildSummary(payload) {
  const summary = {
    exportedAt: payload.exportedAt ?? null,
    fileKey: payload.fileKey ?? null,
    documentMeta: payload.documentMeta ?? null,
    currentPage: payload.currentPage ?? null,
    selection: payload.selection ?? null,
    nodeCount: 0,
    nodeTypes: {},
    colors: {},
    imageRefs: [],
    sampleNames: [],
    hasPngPreview:
      typeof payload.resources?.pngBase64 === "string" && payload.resources.pngBase64.length > 0,
    hasSvgPreview:
      typeof payload.resources?.svgString === "string" && payload.resources.svgString.length > 0,
  };

  collectNodeSummary(payload.document?.document, summary);
  summary.imageRefs = [...new Set(summary.imageRefs)];

  return summary;
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sanitizeSegment(value) {
  return value
    .trim()
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
}

export function buildFileName(payload) {
  const selection = payload.selection ?? {};
  const safeName = sanitizeSegment(selection.name ?? "figma-node") || "figma-node";
  const safeId = String(selection.id ?? "unknown").replace(/[^a-z0-9-]+/giu, "-");
  const exportedAt =
    typeof payload.exportedAt === "string" && !Number.isNaN(Date.parse(payload.exportedAt))
      ? payload.exportedAt
      : new Date().toISOString();
  const timestamp = exportedAt.replace(/[:.]/gu, "-");
  return `${timestamp}-${safeName}-${safeId}.json`;
}

export function buildArtifactManifest(payload, absoluteJsonPath, summaryPath, pngPath, svgPath) {
  return {
    artifactVersion: 1,
    source: {
      fileKey: payload.fileKey ?? null,
      nodeId: payload.selection?.id ?? null,
      url:
        payload.fileKey && payload.selection?.id
          ? `https://www.figma.com/design/${payload.fileKey}/local-export?node-id=${String(
              payload.selection.id
            ).replace(/:/gu, "-")}`
          : "",
      exportedAt: payload.exportedAt ?? null,
      documentMeta: payload.documentMeta ?? null,
      currentPage: payload.currentPage ?? null,
      selection: payload.selection ?? null,
      requestedTarget: payload.requestedTarget ?? null,
    },
    files: {
      json: path.relative(process.cwd(), absoluteJsonPath),
      png: pngPath ? path.relative(process.cwd(), pngPath) : undefined,
      svg: svgPath ? path.relative(process.cwd(), svgPath) : undefined,
      summary: path.relative(process.cwd(), summaryPath),
    },
    checksum: {
      jsonSha256: sha256Buffer(fs.readFileSync(absoluteJsonPath)),
      pngSha256:
        pngPath && fs.existsSync(pngPath) ? sha256Buffer(fs.readFileSync(pngPath)) : undefined,
      svgSha256:
        svgPath && fs.existsSync(svgPath) ? sha256Buffer(fs.readFileSync(svgPath)) : undefined,
    },
  };
}

function parsePositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function resolveRetentionPolicy() {
  return {
    maxBundles: parsePositiveInteger(
      process.env.FIGMA_EXPORT_MAX_BUNDLES,
      DEFAULT_MAX_ARTIFACT_BUNDLES
    ),
    maxBundlesPerSelection: parsePositiveInteger(
      process.env.FIGMA_EXPORT_MAX_BUNDLES_PER_SELECTION,
      DEFAULT_MAX_ARTIFACT_BUNDLES_PER_SELECTION
    ),
  };
}

function readArtifactManifest(manifestPath) {
  try {
    const content = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildBundleStem(manifestPath) {
  return manifestPath.replace(/\.manifest\.json$/u, "");
}

function collectBundleFiles(outputDir, stem) {
  const baseFileName = path.basename(stem);
  return fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${baseFileName}.`))
    .map((entry) => path.join(outputDir, entry.name));
}

function buildSelectionKey(manifest) {
  const fileKey = manifest?.source?.fileKey ?? "unknown-file";
  const nodeId = manifest?.source?.nodeId ?? "unknown-node";
  return `${String(fileKey)}::${String(nodeId)}`;
}

function resolveBundleTimestampMs(manifest, fallbackMs) {
  const exportedAt = manifest?.source?.exportedAt;
  if (typeof exportedAt === "string") {
    const parsed = Date.parse(exportedAt);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallbackMs;
}

function readArtifactBundles(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  return fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".manifest.json"))
    .map((entry) => {
      const manifestPath = path.join(outputDir, entry.name);
      const manifest = readArtifactManifest(manifestPath);
      const stats = fs.statSync(manifestPath);
      const stem = buildBundleStem(manifestPath);
      return {
        manifestPath,
        stem,
        selectionKey: buildSelectionKey(manifest),
        createdAtMs: resolveBundleTimestampMs(manifest, stats.mtimeMs),
        files: collectBundleFiles(outputDir, stem),
      };
    })
    .sort(
      (left, right) => right.createdAtMs - left.createdAtMs || right.stem.localeCompare(left.stem)
    );
}

function pruneArtifactBundles(outputDir) {
  const { maxBundles, maxBundlesPerSelection } = resolveRetentionPolicy();
  const bundles = readArtifactBundles(outputDir);
  if (bundles.length <= 1) {
    return;
  }

  const manifestsToPrune = new Set();

  bundles.slice(maxBundles).forEach((bundle) => {
    manifestsToPrune.add(bundle.manifestPath);
  });

  const keptBySelection = new Map();
  for (const bundle of bundles) {
    const kept = keptBySelection.get(bundle.selectionKey) ?? 0;
    if (kept >= maxBundlesPerSelection) {
      manifestsToPrune.add(bundle.manifestPath);
      continue;
    }
    keptBySelection.set(bundle.selectionKey, kept + 1);
  }

  for (const bundle of bundles) {
    if (!manifestsToPrune.has(bundle.manifestPath)) {
      continue;
    }
    for (const filePath of bundle.files) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Best effort cleanup for prior export bundles.
      }
    }
  }
}

export function writeArtifactBundle(payload, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const fileName = buildFileName(payload);
  const absolutePath = path.join(outputDir, fileName);
  const baseName = absolutePath.slice(0, -".json".length);
  const summary = buildSummary(payload);
  const summaryPath = `${baseName}.summary.json`;
  let pngPath = null;
  let svgPath = null;

  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (typeof payload.resources?.pngBase64 === "string" && payload.resources.pngBase64.length > 0) {
    const pngBytes = Buffer.from(payload.resources.pngBase64, "base64");
    pngPath = `${baseName}.png`;
    fs.writeFileSync(pngPath, pngBytes);
  }

  if (typeof payload.resources?.svgString === "string" && payload.resources.svgString.length > 0) {
    svgPath = `${baseName}.svg`;
    fs.writeFileSync(svgPath, payload.resources.svgString, "utf8");
  }

  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const manifestPath = `${baseName}.manifest.json`;
  const manifest = buildArtifactManifest(payload, absolutePath, summaryPath, pngPath, svgPath);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  pruneArtifactBundles(outputDir);

  return {
    jsonPath: absolutePath,
    summaryPath,
    manifestPath,
    pngPath,
    svgPath,
    summary,
  };
}

export function findLatestArtifactBundleForSelection(outputDir, fileKey, nodeId) {
  const selectionKey = `${String(fileKey)}::${String(nodeId)}`;
  const bundle = readArtifactBundles(outputDir).find(
    (entry) => entry.selectionKey === selectionKey
  );
  if (!bundle) {
    return null;
  }

  const jsonPath = `${bundle.stem}.json`;
  const summaryPath = `${bundle.stem}.summary.json`;
  const manifestPath = `${bundle.stem}.manifest.json`;
  const pngPath = `${bundle.stem}.png`;
  const svgPath = `${bundle.stem}.svg`;

  return {
    jsonPath,
    summaryPath: fs.existsSync(summaryPath) ? summaryPath : null,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
    pngPath: fs.existsSync(pngPath) ? pngPath : null,
    svgPath: fs.existsSync(svgPath) ? svgPath : null,
    createdAtMs: bundle.createdAtMs,
  };
}
