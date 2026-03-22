import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ARTIFACT_SUFFIXES } from "./contracts.mjs";

export const repoRoot = process.cwd();
export const figmaExportDir = path.join(repoRoot, ".figma-workflow", "figma-exports");
export const schemaDir = path.join(repoRoot, "docs", "design-system", "schemas");

function isRawExportJson(fileName) {
  return (
    fileName.endsWith(".json") &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.summary) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.rawManifest) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.classifiedNodeGraph) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.primitiveTokens) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.semanticTokens) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.componentInventory) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.variantStateModel) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.componentSpecs) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.generationPlan) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.codegenReport) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.promotionManifest) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.promotionApplyReport) &&
    !fileName.endsWith(ARTIFACT_SUFFIXES.qaReport)
  );
}

export function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function listRawExportJsonFiles() {
  if (!fileExists(figmaExportDir)) {
    return [];
  }

  return fs
    .readdirSync(figmaExportDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isRawExportJson(entry.name))
    .map((entry) => path.join(figmaExportDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function resolveLatestRawExportJsonPath(explicitPath = null) {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  const files = listRawExportJsonFiles();
  if (files.length === 0) {
    throw new Error(
      "No raw Figma export JSON files were found under .figma-workflow/figma-exports. Export a node first or pass a file path explicitly."
    );
  }

  return files[files.length - 1];
}

export function replaceJsonSuffix(filePath, suffix) {
  if (!filePath.endsWith(".json")) {
    throw new Error(`Expected a .json path, received ${filePath}`);
  }
  return `${filePath.slice(0, -".json".length)}${suffix}`;
}

export function loadSchema(schemaFileName) {
  return readJson(path.join(schemaDir, schemaFileName));
}
