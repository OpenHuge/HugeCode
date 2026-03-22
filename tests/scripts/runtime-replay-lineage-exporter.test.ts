import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildRuntimeReplayLineageFromDirectory } from "../../scripts/lib/runtimeReplayLineageExporter.mjs";

const tempRoots: string[] = [];

function createSampleRecord(options: {
  id: string;
  parentSampleId?: string;
  strategy?: string;
  seedSource?: string;
  deterministicRegressionId?: string;
  recoveryExpected?: boolean;
  observedFailureClass?: string;
  recordedAt?: string;
}) {
  const {
    id,
    parentSampleId,
    strategy = "failure-class-branch",
    seedSource = "workflow-failure",
    deterministicRegressionId,
    recoveryExpected = false,
    observedFailureClass,
    recordedAt = "2026-03-14T00:00:00.000Z",
  } = options;

  return {
    schemaVersion: 1,
    sample: {
      id,
      recordedAt,
      scenarioType: recoveryExpected ? "tool-error-recovery" : "read-only",
      stability: "candidate",
      source: "recorded",
    },
    process: {
      errorRecovery: {
        expected: recoveryExpected,
        expectedFailureClasses: recoveryExpected ? ["provider.request-failed"] : [],
      },
    },
    result: {
      providerReplay: {
        turns: observedFailureClass
          ? [
              {
                failure: {
                  class: observedFailureClass,
                },
              },
            ]
          : [],
      },
    },
    governance: {
      optimizationSignals: {
        seedSource,
        lineage:
          parentSampleId && strategy
            ? {
                parentSampleId,
                strategy,
              }
            : undefined,
      },
      deterministicRegressions: deterministicRegressionId
        ? [
            {
              id: deterministicRegressionId,
              layer: "dataset",
              path: "tests/scripts/runtime-replay-lineage-exporter.test.ts",
              testName: "runtime replay lineage exporter",
            },
          ]
        : [],
    },
  };
}

async function createDataset(records: Array<Record<string, unknown>>) {
  const datasetRoot = await mkdtemp(path.join(tmpdir(), "runtime-replay-lineage-"));
  tempRoots.push(datasetRoot);
  const samplesDir = path.join(datasetRoot, "samples");
  await mkdir(samplesDir, { recursive: true });

  const manifest = {
    schemaVersion: 1,
    datasetId: "runtime-provider-replay-test",
    samples: records.map((record) => {
      const sampleId = (record as { sample?: { id?: string } }).sample?.id;
      return {
        id: sampleId,
        file: `samples/${sampleId}.json`,
      };
    }),
  };

  await writeFile(
    path.join(datasetRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await Promise.all(
    records.map((record) => {
      const sampleId = (record as { sample?: { id?: string } }).sample?.id;
      return writeFile(
        path.join(samplesDir, `${sampleId}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8"
      );
    })
  );

  return datasetRoot;
}

describe("runtime-replay-lineage-exporter", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((rootPath) => rm(rootPath, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("builds deep branches and links recoveries/failures deterministically", async () => {
    const datasetRoot = await createDataset([
      createSampleRecord({ id: "sample-a", seedSource: "manual" }),
      createSampleRecord({ id: "sample-b", parentSampleId: "sample-a" }),
      createSampleRecord({
        id: "sample-c",
        parentSampleId: "sample-b",
        recoveryExpected: true,
        observedFailureClass: "provider.request-failed",
      }),
      createSampleRecord({
        id: "sample-d",
        parentSampleId: "sample-c",
        deterministicRegressionId: "regression-runtime-replay-lineage",
      }),
      createSampleRecord({ id: "sample-e", parentSampleId: "sample-d" }),
    ]);

    const graph = buildRuntimeReplayLineageFromDirectory({ datasetRoot });

    expect(graph.summary.edgeCounts["derived-from"]).toBe(4);
    expect(graph.summary.unresolvedCount).toBe(0);
    expect(graph.summary.cycleCount).toBe(0);
    expect(graph.edges.some((edge) => edge.id === "derived-from:sample-e:sample-d")).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "linked-regression" &&
          edge.id === "linked-regression:sample-d:regression-runtime-replay-lineage"
      )
    ).toBe(true);
    const recoveryNode = graph.nodes.find((node) => node.id === "sample:sample-c");
    expect(recoveryNode?.recoveryExpected).toBe(true);
    expect(recoveryNode?.observedFailureClasses).toEqual(["provider.request-failed"]);
  });

  it("reports orphaned lineage references without crashing", async () => {
    const datasetRoot = await createDataset([
      createSampleRecord({ id: "sample-orphan", parentSampleId: "sample-missing" }),
    ]);

    const graph = buildRuntimeReplayLineageFromDirectory({ datasetRoot });

    expect(graph.summary.edgeCounts["derived-from"] ?? 0).toBe(0);
    expect(graph.summary.unresolvedCount).toBe(1);
    expect(graph.unresolved).toEqual([
      {
        type: "missing-parent",
        sampleId: "sample-orphan",
        parentSampleId: "sample-missing",
      },
    ]);
  });

  it("detects circular derived-from dependencies and surfaces cycle metadata", async () => {
    const datasetRoot = await createDataset([
      createSampleRecord({ id: "sample-a", parentSampleId: "sample-b" }),
      createSampleRecord({ id: "sample-b", parentSampleId: "sample-c" }),
      createSampleRecord({ id: "sample-c", parentSampleId: "sample-a" }),
    ]);

    const graph = buildRuntimeReplayLineageFromDirectory({ datasetRoot });

    expect(graph.summary.edgeCounts["derived-from"]).toBe(3);
    expect(graph.summary.unresolvedCount).toBe(0);
    expect(graph.summary.cycleCount).toBe(1);
    expect(graph.cycles).toHaveLength(1);
    expect(new Set(graph.cycles[0].sampleIds.slice(0, -1))).toEqual(
      new Set(["sample-a", "sample-b", "sample-c"])
    );
    expect(graph.cycles[0].sampleIds[0]).toBe(graph.cycles[0].sampleIds.at(-1));
  });

  it("flags temporal-order violations when a child sample is older than its parent", async () => {
    const datasetRoot = await createDataset([
      createSampleRecord({ id: "sample-parent", recordedAt: "2026-03-14T10:00:00.000Z" }),
      createSampleRecord({
        id: "sample-child",
        parentSampleId: "sample-parent",
        recordedAt: "2026-03-14T09:00:00.000Z",
      }),
    ]);

    const graph = buildRuntimeReplayLineageFromDirectory({ datasetRoot });

    expect(graph.summary.cycleCount).toBe(0);
    expect(graph.summary.isDag).toBe(true);
    expect(graph.summary.topologicalOrderSampleIds).toEqual(["sample-child", "sample-parent"]);
    expect(graph.unresolved).toContainEqual({
      type: "temporal-order-violation",
      sampleId: "sample-child",
      parentSampleId: "sample-parent",
      recordedAt: "2026-03-14T09:00:00.000Z",
      parentRecordedAt: "2026-03-14T10:00:00.000Z",
    });
  });
});
