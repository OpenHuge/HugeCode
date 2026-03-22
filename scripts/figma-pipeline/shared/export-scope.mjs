import fs from "node:fs";
import { ARTIFACT_SUFFIXES } from "./contracts.mjs";
import { readJson, replaceJsonSuffix } from "./paths.mjs";

const AUDIT_ONLY_TYPES = new Set(["CANVAS", "SECTION"]);
const DIRECT_CODEGEN_TYPES = new Set(["COMPONENT", "COMPONENT_SET", "INSTANCE"]);
const MAX_SAFE_CODEGEN_NODES = 400;
const MAX_FRAME_CODEGEN_NODES = 240;

function collectNodeCount(node) {
  if (!node || typeof node !== "object") {
    return 0;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  return 1 + children.reduce((total, child) => total + collectNodeCount(child), 0);
}

function deriveSummaryFromPayload(payload) {
  return {
    selection: payload?.selection ?? null,
    nodeCount: collectNodeCount(payload?.document?.document ?? null),
  };
}

export function readExportSummary(exportJsonPath) {
  const summaryPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.summary);
  if (fs.existsSync(summaryPath)) {
    return readJson(summaryPath);
  }
  return deriveSummaryFromPayload(readJson(exportJsonPath));
}

export function assessExportScope(summary) {
  const selectionType = String(summary?.selection?.type ?? "UNKNOWN").toUpperCase();
  const selectionName = String(summary?.selection?.name ?? "");
  const nodeCount = Number(summary?.nodeCount ?? 0);
  const reasons = [];

  if (AUDIT_ONLY_TYPES.has(selectionType)) {
    reasons.push(
      `${selectionType} exports are page or section scale and should stay in audit/token planning mode.`
    );
  }

  if (nodeCount > MAX_SAFE_CODEGEN_NODES) {
    reasons.push(
      `This export contains ${nodeCount} nodes, which is above the default codegen safety limit of ${MAX_SAFE_CODEGEN_NODES}.`
    );
  }

  if (selectionType === "FRAME" && nodeCount > MAX_FRAME_CODEGEN_NODES) {
    reasons.push(
      `FRAME exports above ${MAX_FRAME_CODEGEN_NODES} nodes are treated as pattern or shell references by default.`
    );
  }

  if (/design system|ui kit|page|shell/iu.test(selectionName) && nodeCount > 120) {
    reasons.push(
      `The selection name "${selectionName}" looks like a system or shell reference, so promotion should start from a more focused child node.`
    );
  }

  const codegenSafe =
    reasons.length === 0 &&
    (DIRECT_CODEGEN_TYPES.has(selectionType) ||
      (selectionType === "FRAME" && nodeCount > 0 && nodeCount <= MAX_FRAME_CODEGEN_NODES) ||
      (selectionType !== "UNKNOWN" && nodeCount > 0 && nodeCount <= 120));

  const recommendedMode = codegenSafe ? "develop" : "audit";
  const recommendedCommand = codegenSafe
    ? "node scripts/figma-pipeline/develop.mjs"
    : "node scripts/figma-pipeline/production-workflow.mjs";

  return {
    codegenSafe,
    recommendedMode,
    recommendedCommand,
    selectionType,
    selectionName,
    nodeCount,
    reasons,
  };
}
