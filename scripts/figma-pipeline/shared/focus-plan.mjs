import { ARTIFACT_SUFFIXES } from "./contracts.mjs";
import { assessExportScope } from "./export-scope.mjs";
import { readJson, replaceJsonSuffix } from "./paths.mjs";

const LAYOUT_FAMILIES = new Set(["LocalPattern", "Box", "Inline", "Stack"]);
const DEFAULT_PRIORITY_ORDER = [
  "Button",
  "Input",
  "Select",
  "Checkbox",
  "Switch",
  "Tabs",
  "Badge",
  "Avatar",
  "DropdownMenu",
  "Tooltip",
  "Radio",
  "Text",
  "Card",
  "EmptyState",
];
const MANUAL_FAMILY_PATTERNS = new Map([
  ["Select", [/dropdown/iu, /selector/iu]],
  ["Switch", [/\btoggle\b/iu, /\bswitch\b/iu]],
  ["Avatar", [/avatar/iu]],
  ["Badge", [/\bbadge\b/iu, /\btag\b/iu, /percentage/iu]],
]);
const NODE_TYPE_SCORES = new Map([
  ["COMPONENT_SET", 50],
  ["COMPONENT", 40],
  ["INSTANCE", 28],
  ["FRAME", 20],
  ["GROUP", 10],
  ["SECTION", -20],
  ["CANVAS", -50],
]);

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);
}

function singularizeName(value) {
  if (/ies$/iu.test(value)) {
    return value.replace(/ies$/iu, "y");
  }
  if (/sses$/iu.test(value)) {
    return value.slice(0, -"es".length);
  }
  if (/s$/iu.test(value) && !/ss$/iu.test(value)) {
    return value.slice(0, -1);
  }
  return value;
}

function normalizeFamilyName(rawName, familyLookup) {
  const direct = familyLookup.get(rawName.toLowerCase());
  if (typeof direct === "string") {
    return direct;
  }

  const singular = singularizeName(rawName).toLowerCase();
  const singularMatch = familyLookup.get(singular);
  return typeof singularMatch === "string" ? singularMatch : null;
}

function normalizeLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseNodeTypeFromSignature(signature) {
  const segments = String(signature ?? "").split("|");
  return segments.length >= 2 ? String(segments[1]).toUpperCase() : "UNKNOWN";
}

export function canonicalizeSourceNodeId(rawValue) {
  const parts = String(rawValue ?? "")
    .split(";")
    .map((part) => part.trim().replace(/^I/iu, "").replace(/-/gu, ":"))
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function indexNodeTree(node, parentId = null, depth = 0, index = new Map()) {
  if (!node || typeof node !== "object") {
    return 0;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  let subtreeNodeCount = 1;
  for (const child of children) {
    subtreeNodeCount += indexNodeTree(child, node.id ?? null, depth + 1, index);
  }

  if (typeof node.id === "string" && node.id.length > 0) {
    index.set(node.id, {
      id: node.id,
      name: String(node.name ?? ""),
      type: String(node.type ?? "UNKNOWN").toUpperCase(),
      parentId,
      depth,
      childCount: children.length,
      subtreeNodeCount,
    });
  }

  return subtreeNodeCount;
}

function buildPriorityMap(priorityOrder = DEFAULT_PRIORITY_ORDER) {
  return new Map(priorityOrder.map((family, index) => [family, index]));
}

function buildFamilyLookup(specs) {
  const familyLookup = new Map();
  function registerAlias(alias, family) {
    const normalizedAlias = String(alias ?? "")
      .toLowerCase()
      .replace(/[_-]+/gu, " ")
      .trim();
    if (normalizedAlias.length === 0) {
      return;
    }

    const existing = familyLookup.get(normalizedAlias);
    if (!existing) {
      familyLookup.set(normalizedAlias, family);
      return;
    }
    if (existing !== family) {
      familyLookup.set(normalizedAlias, null);
    }
  }

  for (const component of Array.isArray(specs?.components) ? specs.components : []) {
    if (typeof component?.family === "string" && component.family.length > 0) {
      registerAlias(component.family, component.family);
    }
    if (typeof component?.name === "string" && component.name.length > 0) {
      registerAlias(component.name, component.family);
    }
    for (const sourcePattern of Array.isArray(component?.sourcePatterns)
      ? component.sourcePatterns
      : []) {
      if (typeof sourcePattern !== "string" || sourcePattern.length === 0) {
        continue;
      }
      const signatureName = sourcePattern.split("|")[0];
      registerAlias(signatureName, component.family);
    }
  }

  return familyLookup;
}

function resolveFamily(component, familyLookup) {
  const direct = normalizeFamilyName(String(component?.name ?? ""), familyLookup);
  if (direct) {
    return {
      family: direct,
      matchKind: "name",
    };
  }

  const signaturePrefix = String(component?.signature ?? "")
    .split("|")[0]
    .replace(/-/gu, " ");
  const signatureMatch = normalizeFamilyName(signaturePrefix, familyLookup);
  if (signatureMatch) {
    return {
      family: signatureMatch,
      matchKind: "signature",
    };
  }

  const haystack = `${String(component?.name ?? "")} ${signaturePrefix}`.toLowerCase();
  for (const [family, patterns] of MANUAL_FAMILY_PATTERNS.entries()) {
    if (patterns.some((pattern) => pattern.test(haystack))) {
      return {
        family,
        matchKind: "pattern",
      };
    }
  }

  return null;
}

function computeFamilyLabelStrength(component, family) {
  const normalizedFamily = normalizeLabel(family);
  const normalizedName = normalizeLabel(component?.name ?? "");
  const normalizedSignature = normalizeLabel(String(component?.signature ?? "").split("|")[0]);

  if (
    normalizedName === normalizedFamily ||
    normalizeLabel(singularizeName(normalizedName)) === normalizedFamily
  ) {
    return 3;
  }
  if (
    normalizedName.includes(normalizedFamily) ||
    normalizedSignature === normalizedFamily ||
    normalizedSignature.includes(normalizedFamily)
  ) {
    return 2;
  }
  return 0;
}

function computeTargetScore(candidate) {
  const typeScore = NODE_TYPE_SCORES.get(candidate.nodeType) ?? 0;
  const sharedScore = candidate.shared ? 12 : 0;
  const occurrenceScore = Math.min(candidate.occurrences, 12);
  const confidenceScore = Math.round(candidate.confidence * 10);
  const codegenScore = candidate.workflowRecommendation.codegenSafe ? 10 : -10;
  const sizePenalty = candidate.nodeCount > 180 ? -10 : 0;
  const priorityScore = Math.max(0, 20 - candidate.familyPriority);
  const matchKindScore =
    candidate.matchKind === "name" ? 12 : candidate.matchKind === "signature" ? 8 : 3;
  const familyLabelScore = candidate.familyLabelStrength * 8;

  return (
    typeScore +
    sharedScore +
    occurrenceScore +
    confidenceScore +
    codegenScore +
    sizePenalty +
    priorityScore +
    matchKindScore +
    familyLabelScore
  );
}

function buildCachePolicy(nodeType, workflowRecommendation) {
  const longLived = nodeType === "COMPONENT_SET" || nodeType === "COMPONENT";
  return {
    maxCacheAgeMinutes: longLived && workflowRecommendation.codegenSafe ? 1440 : 360,
    refreshStrategy: "manual-on-design-change",
    burstProtection: "sequential-cache-first",
  };
}

function buildResourceId(prefix, family) {
  return `${prefix}-${slugify(family)}`.replace(/-+/gu, "-");
}

export function deriveFocusPlan(exportPayload, componentInventory, componentSpecs, options = {}) {
  const familyLookup = buildFamilyLookup(componentSpecs);
  const priorityMap = buildPriorityMap(options.priorityOrder);
  const nodeIndex = new Map();
  indexNodeTree(exportPayload?.document?.document ?? null, null, 0, nodeIndex);

  const includeLayoutFamilies = options.includeLayoutFamilies === true;
  const requestedFamilies = new Set(
    (Array.isArray(options.families) ? options.families : [])
      .filter((family) => typeof family === "string" && family.length > 0)
      .map((family) => family.toLowerCase())
  );
  const prefix =
    options.resourceIdPrefix ??
    slugify(exportPayload?.documentMeta?.name ?? exportPayload?.selection?.name ?? "figma-focus");
  const candidates = [];

  for (const component of Array.isArray(componentInventory?.components)
    ? componentInventory.components
    : []) {
    if (typeof component?.name !== "string" || component.name.length === 0) {
      continue;
    }

    const familyMatch = resolveFamily(component, familyLookup);
    if (!familyMatch) {
      continue;
    }
    const family = familyMatch.family;
    if (!includeLayoutFamilies && LAYOUT_FAMILIES.has(family)) {
      continue;
    }
    if (requestedFamilies.size > 0 && !requestedFamilies.has(family.toLowerCase())) {
      continue;
    }

    const canonicalNodeId = canonicalizeSourceNodeId(component.sourceNodeId);
    if (!canonicalNodeId) {
      continue;
    }

    const node = nodeIndex.get(canonicalNodeId);
    if (!node) {
      continue;
    }

    const workflowRecommendation = assessExportScope({
      selection: {
        type: node.type,
        name: node.name,
      },
      nodeCount: node.subtreeNodeCount,
    });

    const familyPriority =
      priorityMap.get(family) ?? DEFAULT_PRIORITY_ORDER.length + candidates.length + 1;
    const candidate = {
      family,
      familyPriority,
      resourceId: buildResourceId(prefix, family),
      fileKey: exportPayload?.fileKey ?? null,
      nodeId: canonicalNodeId,
      nodeName: node.name,
      nodeType: node.type || parseNodeTypeFromSignature(component.signature),
      nodeCount: node.subtreeNodeCount,
      childCount: node.childCount,
      depth: node.depth,
      shared: component.shared === true,
      confidence: Number(component.confidence ?? 0),
      occurrences: Number(component.occurrences ?? 0),
      classification: String(component.classification ?? "unknown"),
      sourceComponentName: component.name,
      matchKind: familyMatch.matchKind,
      familyLabelStrength: computeFamilyLabelStrength(component, family),
      rationale: String(component.rationale ?? ""),
      signature: String(component.signature ?? ""),
      workflowRecommendation,
    };
    candidate.score = computeTargetScore(candidate);
    candidates.push(candidate);
  }

  const grouped = new Map();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.family) ?? [];
    const alreadyPresent = existing.some((entry) => entry.nodeId === candidate.nodeId);
    if (!alreadyPresent) {
      existing.push(candidate);
      grouped.set(candidate.family, existing);
    }
  }

  const targets = [...grouped.entries()]
    .map(([family, entries]) => {
      const sortedEntries = entries.sort((left, right) => right.score - left.score);
      const primary = sortedEntries[0];
      const alternates = sortedEntries.slice(1, 4).map((entry) => ({
        nodeId: entry.nodeId,
        nodeName: entry.nodeName,
        nodeType: entry.nodeType,
        nodeCount: entry.nodeCount,
        score: entry.score,
      }));

      return {
        family,
        priority: primary.familyPriority + 1,
        resourceId: primary.resourceId,
        target: {
          fileKey: primary.fileKey,
          nodeId: primary.nodeId,
          nodeName: primary.nodeName,
          nodeType: primary.nodeType,
          nodeCount: primary.nodeCount,
          childCount: primary.childCount,
          depth: primary.depth,
        },
        workflowRecommendation: primary.workflowRecommendation,
        cachePolicy: buildCachePolicy(primary.nodeType, primary.workflowRecommendation),
        evidence: {
          sourceComponentName: primary.sourceComponentName,
          classification: primary.classification,
          shared: primary.shared,
          confidence: primary.confidence,
          occurrences: primary.occurrences,
          signature: primary.signature,
          rationale: primary.rationale,
        },
        alternates,
      };
    })
    .sort(
      (left, right) => left.priority - right.priority || left.family.localeCompare(right.family)
    );

  return {
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      fileKey: exportPayload?.fileKey ?? null,
      documentMeta: exportPayload?.documentMeta ?? null,
      selection: exportPayload?.selection ?? null,
      currentPage: exportPayload?.currentPage ?? null,
    },
    strategy: {
      mode: "family-focus-plan",
      goal: "Prefer component-scale nodes over page-scale canvases for governed design-system ingestion.",
      excludedLayoutFamilies: includeLayoutFamilies ? [] : [...LAYOUT_FAMILIES],
      priorityOrder: options.priorityOrder ?? DEFAULT_PRIORITY_ORDER,
      selectionPolicy:
        "Choose the highest-scoring representative per family, favoring component sets, shared structures, safe node sizes, and cache-friendly reuse.",
      fetchPolicy:
        "Run sequential cache-first fetches, honor Retry-After on 429, and refresh only for intentional design changes.",
    },
    summary: {
      candidatesConsidered: candidates.length,
      familiesSelected: targets.length,
      codegenSafeTargets: targets.filter((target) => target.workflowRecommendation.codegenSafe)
        .length,
      auditOnlyTargets: targets.filter((target) => !target.workflowRecommendation.codegenSafe)
        .length,
    },
    targets,
  };
}

export function deriveFocusPlanFromExport(exportJsonPath, options = {}) {
  const exportPayload = readJson(exportJsonPath);
  const componentInventory = readJson(
    replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentInventory)
  );
  const componentSpecs = readJson(
    replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.componentSpecs)
  );

  return deriveFocusPlan(exportPayload, componentInventory, componentSpecs, options);
}
