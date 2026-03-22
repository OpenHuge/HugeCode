import fs from "node:fs";
import path from "node:path";

const DEFAULT_DATASET_ROOT = path.join(
  process.cwd(),
  "packages",
  "code-runtime-service-rs",
  "testdata",
  "provider-replay"
);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseTimestamp(value) {
  const normalized = ensureString(value);
  if (!normalized) {
    return null;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCountRecord(entries) {
  return Object.fromEntries(
    [...entries.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

function pushUnique(items, item, seen, id) {
  if (seen.has(id)) {
    return;
  }
  seen.add(id);
  items.push(item);
}

function normalizeFailureClass(failure) {
  const explicit = ensureString(failure?.class);
  if (explicit) {
    return explicit;
  }

  const detail = `${String(failure?.code ?? "").toLowerCase()} ${String(failure?.message ?? "").toLowerCase()}`;
  if (
    detail.includes("runtime.turn.provider.stream_read_failed") ||
    detail.includes("failed to read chatgpt codex response stream") ||
    detail.includes("error decoding response body")
  ) {
    return "provider.stream-interrupted";
  }
  if (
    detail.includes("runtime.turn.provider.rejected") ||
    detail.includes("provider rejected") ||
    detail.includes("rejected by provider")
  ) {
    return "provider.rejected";
  }
  if (detail.includes("request failed") || detail.includes("error sending request")) {
    return "provider.request-failed";
  }
  if (ensureString(failure?.message) || ensureString(failure?.code)) {
    return "provider.unknown";
  }
  return null;
}

function collectSamplePathsFromDirectory(samplesDirPath) {
  if (!fs.existsSync(samplesDirPath)) {
    return [];
  }
  return fs
    .readdirSync(samplesDirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(samplesDirPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function collectSamplePathsFromManifest(datasetRoot, manifest) {
  const missingFiles = [];
  const samplePaths = [];

  for (const entry of ensureArray(manifest?.samples)) {
    const file = ensureString(entry?.file);
    if (!file) {
      continue;
    }
    const absolutePath = path.resolve(datasetRoot, file);
    if (!fs.existsSync(absolutePath)) {
      missingFiles.push({
        type: "missing-manifest-sample-file",
        sampleId: ensureString(entry?.id),
        file,
      });
      continue;
    }
    samplePaths.push(absolutePath);
  }

  return { samplePaths, missingFiles };
}

function buildCycleSignatures(cycleIds) {
  if (cycleIds.length === 0) {
    return [];
  }
  const rotations = [];
  for (let index = 0; index < cycleIds.length; index += 1) {
    const rotated = cycleIds.slice(index).concat(cycleIds.slice(0, index));
    rotations.push(rotated);
  }
  rotations.sort((left, right) => left.join(">").localeCompare(right.join(">")));
  return rotations[0] ?? [];
}

function detectDerivedCycles(derivedEdges) {
  const adjacency = new Map();
  const nodeIds = new Set();
  for (const edge of derivedEdges) {
    const fromId = edge.from.slice("sample:".length);
    const toId = edge.to.slice("sample:".length);
    nodeIds.add(fromId);
    nodeIds.add(toId);
    if (!adjacency.has(fromId)) {
      adjacency.set(fromId, []);
    }
    adjacency.get(fromId).push(toId);
  }

  for (const values of adjacency.values()) {
    values.sort((left, right) => left.localeCompare(right));
  }

  const state = new Map();
  const stack = [];
  const cycles = [];
  const seenCycleSignatures = new Set();

  function visit(nodeId) {
    state.set(nodeId, 1);
    stack.push(nodeId);

    for (const nextId of adjacency.get(nodeId) ?? []) {
      const nextState = state.get(nextId) ?? 0;
      if (nextState === 0) {
        visit(nextId);
        continue;
      }
      if (nextState !== 1) {
        continue;
      }

      const cycleStartIndex = stack.lastIndexOf(nextId);
      if (cycleStartIndex < 0) {
        continue;
      }
      const cycleNodes = stack.slice(cycleStartIndex);
      const canonicalCycleNodes = buildCycleSignatures(cycleNodes);
      if (canonicalCycleNodes.length === 0) {
        continue;
      }
      const signature = canonicalCycleNodes.join(">");
      if (seenCycleSignatures.has(signature)) {
        continue;
      }
      seenCycleSignatures.add(signature);
      const sampleIds = canonicalCycleNodes.concat(canonicalCycleNodes[0]);
      const edgeIds = [];
      for (let edgeIndex = 0; edgeIndex < sampleIds.length - 1; edgeIndex += 1) {
        edgeIds.push(`derived-from:${sampleIds[edgeIndex]}:${sampleIds[edgeIndex + 1]}`);
      }
      cycles.push({
        type: "lineage-cycle",
        sampleIds,
        edgeIds,
      });
    }

    stack.pop();
    state.set(nodeId, 2);
  }

  for (const nodeId of [...nodeIds].sort()) {
    if ((state.get(nodeId) ?? 0) !== 0) {
      continue;
    }
    visit(nodeId);
  }

  return cycles.sort((left, right) =>
    left.sampleIds.join(">").localeCompare(right.sampleIds.join(">"))
  );
}

function deriveTopologicalOrderSampleIds(sampleIds, derivedEdges) {
  const sortedIds = [...sampleIds].sort((left, right) => left.localeCompare(right));
  const inDegree = new Map(sortedIds.map((entry) => [entry, 0]));
  const adjacency = new Map(sortedIds.map((entry) => [entry, []]));

  for (const edge of derivedEdges) {
    const fromId = edge.from.slice("sample:".length);
    const toId = edge.to.slice("sample:".length);
    if (!inDegree.has(fromId) || !inDegree.has(toId)) {
      continue;
    }
    adjacency.get(fromId).push(toId);
    inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1);
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => left.localeCompare(right));
  }

  const queue = sortedIds.filter((entry) => (inDegree.get(entry) ?? 0) === 0);
  const order = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const remaining = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
      }
    }
    queue.sort((left, right) => left.localeCompare(right));
  }

  if (order.length !== sortedIds.length) {
    return null;
  }

  return order;
}

export function extractRuntimeReplayLineageDescriptor(sampleRecord, options = {}) {
  const sampleMeta = sampleRecord?.sample;
  const sampleId = ensureString(sampleMeta?.id);
  if (!sampleId) {
    return null;
  }

  const optimizationSignals = sampleRecord?.governance?.optimizationSignals;
  const parentSampleId = ensureString(optimizationSignals?.lineage?.parentSampleId);
  const lineageStrategy = ensureString(optimizationSignals?.lineage?.strategy);
  const deterministicRegressions = ensureArray(sampleRecord?.governance?.deterministicRegressions)
    .map((entry) => ({
      id: ensureString(entry?.id),
      layer: ensureString(entry?.layer),
      path: ensureString(entry?.path),
      testName: ensureString(entry?.testName),
      status: ensureString(entry?.status) ?? "active",
    }))
    .filter((entry) => entry.id && entry.layer && entry.path && entry.testName);
  const recoveryExpected = sampleRecord?.process?.errorRecovery?.expected === true;
  const expectedFailureClasses = [
    ...new Set(
      ensureArray(sampleRecord?.process?.errorRecovery?.expectedFailureClasses)
        .map((entry) => ensureString(entry))
        .filter(Boolean)
    ),
  ].sort((left, right) => left.localeCompare(right));
  const observedFailureClasses = [
    ...new Set(
      ensureArray(sampleRecord?.result?.providerReplay?.turns)
        .map((turn) => normalizeFailureClass(turn?.failure))
        .filter(Boolean)
    ),
  ].sort((left, right) => left.localeCompare(right));

  return {
    sampleId,
    filePath: ensureString(options.filePath),
    recordedAt: ensureString(sampleMeta?.recordedAt),
    recordedAtMs: parseTimestamp(sampleMeta?.recordedAt),
    scenarioType: ensureString(sampleMeta?.scenarioType),
    stability: ensureString(sampleMeta?.stability),
    source: ensureString(sampleMeta?.source),
    seedSource: ensureString(optimizationSignals?.seedSource),
    incubationTrack: ensureString(optimizationSignals?.incubationTrack),
    recommendedLevers: [
      ...new Set(
        ensureArray(optimizationSignals?.recommendedLevers)
          .map((entry) => ensureString(entry))
          .filter(Boolean)
      ),
    ].sort((left, right) => left.localeCompare(right)),
    lineage:
      parentSampleId && lineageStrategy
        ? {
            parentSampleId,
            strategy: lineageStrategy,
          }
        : null,
    goldenBlockers: [
      ...new Set(
        [
          ...ensureArray(sampleRecord?.governance?.goldenBlockers),
          ...ensureArray(sampleRecord?.governance?.manualGoldenBlockers),
          ...ensureArray(sampleRecord?.governance?.recoveryQualification?.goldenBlockers),
        ]
          .map((entry) => ensureString(entry))
          .filter(Boolean)
      ),
    ].sort((left, right) => left.localeCompare(right)),
    deterministicRegressions,
    recoveryExpected,
    expectedFailureClasses,
    observedFailureClasses,
  };
}

export function collectRuntimeReplayLineageInputs(options = {}) {
  const datasetRoot = path.resolve(options.datasetRoot ?? DEFAULT_DATASET_ROOT);
  const manifestPath = path.resolve(
    options.manifestPath ?? path.join(datasetRoot, "manifest.json")
  );
  const unresolved = [];
  const descriptors = [];

  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : null;
  if (!manifest) {
    unresolved.push({
      type: "missing-manifest",
      manifestPath,
    });
  }

  const fromManifest = collectSamplePathsFromManifest(datasetRoot, manifest);
  const fromDirectory = collectSamplePathsFromDirectory(path.join(datasetRoot, "samples"));
  const samplePaths = [...new Set([...fromManifest.samplePaths, ...fromDirectory])].sort(
    (left, right) => left.localeCompare(right)
  );
  unresolved.push(...fromManifest.missingFiles);

  for (const samplePath of samplePaths) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(samplePath, "utf8"));
    } catch (error) {
      unresolved.push({
        type: "invalid-sample-json",
        filePath: samplePath,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const descriptor = extractRuntimeReplayLineageDescriptor(parsed, { filePath: samplePath });
    if (!descriptor) {
      unresolved.push({
        type: "missing-sample-id",
        filePath: samplePath,
      });
      continue;
    }
    descriptors.push(descriptor);
  }

  descriptors.sort((left, right) => left.sampleId.localeCompare(right.sampleId));

  return {
    datasetId: ensureString(manifest?.datasetId) ?? "runtime-provider-replay",
    datasetRoot,
    manifestPath,
    descriptors,
    unresolved,
  };
}

export function buildRuntimeReplayLineageGraphFromDescriptors(options) {
  const datasetId = ensureString(options?.datasetId) ?? "runtime-provider-replay";
  const descriptors = ensureArray(options?.descriptors).filter(
    (entry) => entry && typeof entry === "object" && ensureString(entry.sampleId)
  );
  const descriptorMap = new Map(descriptors.map((entry) => [entry.sampleId, entry]));
  const selectedSampleIds = ensureArray(options?.selectedSampleIds)
    .map((entry) => ensureString(entry))
    .filter(Boolean);
  const relevantIds = new Set(
    (selectedSampleIds.length > 0
      ? selectedSampleIds
      : descriptors.map((entry) => entry.sampleId)
    ).filter(Boolean)
  );
  const unresolved = [...ensureArray(options?.unresolved)].map((entry) => ({ ...entry }));

  for (const sampleId of [...relevantIds]) {
    const descriptor = descriptorMap.get(sampleId);
    if (!descriptor) {
      unresolved.push({
        type: "missing-selected-sample",
        sampleId,
      });
      continue;
    }
    if (descriptor.lineage?.parentSampleId) {
      relevantIds.add(descriptor.lineage.parentSampleId);
    }
  }

  const nodes = [];
  const edges = [];
  const blocked = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  const seedCounts = new Map();
  const incubationTrackCounts = new Map();
  const strategyCounts = new Map();

  for (const sampleId of [...relevantIds].sort((left, right) => left.localeCompare(right))) {
    const descriptor = descriptorMap.get(sampleId);
    if (!descriptor) {
      continue;
    }

    pushUnique(
      nodes,
      {
        id: `sample:${sampleId}`,
        type: "sample",
        sampleId,
        recordedAt: descriptor.recordedAt,
        scenarioType: descriptor.scenarioType,
        stability: descriptor.stability,
        source: descriptor.source,
        seedSource: descriptor.seedSource,
        incubationTrack: descriptor.incubationTrack,
        recommendedLevers: descriptor.recommendedLevers,
        goldenBlockers: descriptor.goldenBlockers,
        recoveryExpected: descriptor.recoveryExpected,
        expectedFailureClasses: descriptor.expectedFailureClasses,
        observedFailureClasses: descriptor.observedFailureClasses,
      },
      nodeIds,
      `sample:${sampleId}`
    );

    if (descriptor.seedSource) {
      const seedNodeId = `seed:${descriptor.seedSource}`;
      pushUnique(
        nodes,
        {
          id: seedNodeId,
          type: "seed",
          seedSource: descriptor.seedSource,
        },
        nodeIds,
        seedNodeId
      );
      pushUnique(
        edges,
        {
          id: `seeded-by:${sampleId}:${descriptor.seedSource}`,
          type: "seeded-by",
          from: `sample:${sampleId}`,
          to: seedNodeId,
          origin: "governance.optimizationSignals.seedSource",
          evidence: {
            seedSource: descriptor.seedSource,
          },
        },
        edgeIds,
        `seeded-by:${sampleId}:${descriptor.seedSource}`
      );
      seedCounts.set(descriptor.seedSource, (seedCounts.get(descriptor.seedSource) ?? 0) + 1);
    }

    if (descriptor.incubationTrack) {
      incubationTrackCounts.set(
        descriptor.incubationTrack,
        (incubationTrackCounts.get(descriptor.incubationTrack) ?? 0) + 1
      );
    }

    for (const regression of descriptor.deterministicRegressions) {
      const regressionNodeId = `regression:${regression.id}`;
      pushUnique(
        nodes,
        {
          id: regressionNodeId,
          type: "regression",
          regressionId: regression.id,
          layer: regression.layer,
          path: regression.path,
          testName: regression.testName,
          status: regression.status,
        },
        nodeIds,
        regressionNodeId
      );
      pushUnique(
        edges,
        {
          id: `linked-regression:${sampleId}:${regression.id}`,
          type: "linked-regression",
          from: `sample:${sampleId}`,
          to: regressionNodeId,
          origin: "governance.deterministicRegressions",
          evidence: {
            layer: regression.layer,
            path: regression.path,
            testName: regression.testName,
          },
        },
        edgeIds,
        `linked-regression:${sampleId}:${regression.id}`
      );
    }
  }

  for (const sampleId of [...relevantIds].sort((left, right) => left.localeCompare(right))) {
    const descriptor = descriptorMap.get(sampleId);
    const parentSampleId = descriptor?.lineage?.parentSampleId;
    if (!descriptor || !parentSampleId) {
      continue;
    }
    if (!descriptorMap.has(parentSampleId)) {
      unresolved.push({
        type: "missing-parent",
        sampleId,
        parentSampleId,
      });
      continue;
    }
    pushUnique(
      edges,
      {
        id: `derived-from:${sampleId}:${parentSampleId}`,
        type: "derived-from",
        from: `sample:${sampleId}`,
        to: `sample:${parentSampleId}`,
        origin: "governance.optimizationSignals.lineage",
        evidence: {
          strategy: descriptor.lineage.strategy,
        },
      },
      edgeIds,
      `derived-from:${sampleId}:${parentSampleId}`
    );
    const parentDescriptor = descriptorMap.get(parentSampleId);
    if (
      typeof descriptor.recordedAtMs === "number" &&
      Number.isFinite(descriptor.recordedAtMs) &&
      typeof parentDescriptor?.recordedAtMs === "number" &&
      Number.isFinite(parentDescriptor.recordedAtMs) &&
      descriptor.recordedAtMs < parentDescriptor.recordedAtMs
    ) {
      unresolved.push({
        type: "temporal-order-violation",
        sampleId,
        parentSampleId,
        recordedAt: descriptor.recordedAt,
        parentRecordedAt: parentDescriptor.recordedAt,
      });
    }
    strategyCounts.set(
      descriptor.lineage.strategy,
      (strategyCounts.get(descriptor.lineage.strategy) ?? 0) + 1
    );
    if (descriptor.goldenBlockers.length > 0) {
      blocked.push({
        sampleId,
        parentSampleId,
        blockers: descriptor.goldenBlockers,
        reason: "active_golden_blockers",
      });
    }
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  blocked.sort((left, right) =>
    `${left.sampleId}:${left.parentSampleId}`.localeCompare(
      `${right.sampleId}:${right.parentSampleId}`
    )
  );
  unresolved.sort((left, right) =>
    `${left.type ?? ""}:${left.sampleId ?? ""}:${left.parentSampleId ?? ""}:${left.filePath ?? ""}`.localeCompare(
      `${right.type ?? ""}:${right.sampleId ?? ""}:${right.parentSampleId ?? ""}:${right.filePath ?? ""}`
    )
  );

  const derivedEdges = edges.filter((edge) => edge.type === "derived-from");
  const cycles = detectDerivedCycles(derivedEdges);
  const sampleIds = [...relevantIds].sort((left, right) => left.localeCompare(right));
  const topologicalOrder =
    cycles.length === 0 ? deriveTopologicalOrderSampleIds(sampleIds, derivedEdges) : null;
  const nodeCounts = new Map();
  const edgeCounts = new Map();
  const failureClassCounts = new Map();
  let recoverySampleCount = 0;

  for (const node of nodes) {
    nodeCounts.set(node.type, (nodeCounts.get(node.type) ?? 0) + 1);
    if (node.type === "sample" && node.recoveryExpected) {
      recoverySampleCount += 1;
      for (const failureClass of ensureArray(node.observedFailureClasses)) {
        failureClassCounts.set(failureClass, (failureClassCounts.get(failureClass) ?? 0) + 1);
      }
    }
  }
  for (const edge of edges) {
    edgeCounts.set(edge.type, (edgeCounts.get(edge.type) ?? 0) + 1);
  }

  return {
    schemaVersion: 1,
    schema: "runtime-replay-lineage-v1",
    generatedAt: new Date().toISOString(),
    datasetId,
    selection: sampleIds,
    nodes,
    edges,
    blocked,
    unresolved,
    cycles,
    summary: {
      sampleIds,
      nodeCounts: toCountRecord(nodeCounts),
      edgeCounts: toCountRecord(edgeCounts),
      seedSourceCounts: toCountRecord(seedCounts),
      incubationTrackCounts: toCountRecord(incubationTrackCounts),
      lineageStrategyCounts: toCountRecord(strategyCounts),
      unresolvedCount: unresolved.length,
      blockedCount: blocked.length,
      cycleCount: cycles.length,
      isDag: cycles.length === 0,
      topologicalOrderSampleIds: topologicalOrder,
      recoverySampleCount,
      observedFailureClassCounts: toCountRecord(failureClassCounts),
    },
  };
}

export function buildRuntimeReplayLineageFromDirectory(options = {}) {
  const inputs = collectRuntimeReplayLineageInputs(options);
  return buildRuntimeReplayLineageGraphFromDescriptors({
    datasetId: inputs.datasetId,
    descriptors: inputs.descriptors,
    selectedSampleIds: options.selectedSampleIds,
    unresolved: inputs.unresolved,
  });
}

export function writeRuntimeReplayLineageJson(outputPath, graph) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 2)}\n`);
}

export const RUNTIME_REPLAY_DEFAULT_DATASET_ROOT = DEFAULT_DATASET_ROOT;
