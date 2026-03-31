import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import {
  createSnapshotBackedMissionControlBindings,
  createSnapshotBackedMissionControlSurfaceBindings,
  createWorkspaceClientRuntimeMissionControlSurfaceBindings,
  readMissionControlSnapshotFromSourceAdapter,
} from "./missionControlBindings";

function createReviewPack(
  overrides: Partial<HugeCodeReviewPackSummary> = {}
): HugeCodeReviewPackSummary {
  return {
    id: "review-pack-1",
    runId: "run-1",
    taskId: "task-1",
    workspaceId: "workspace-1",
    taskSource: null,
    summary: "Review ready",
    reviewStatus: "ready",
    evidenceState: "confirmed",
    validationOutcome: "passed",
    warningCount: 0,
    warnings: [],
    validations: [],
    artifacts: [],
    checksPerformed: [],
    recommendedNextAction: null,
    assumptions: [],
    reproductionGuidance: [],
    rollbackGuidance: [],
    backendAudit: undefined,
    reviewDecision: null,
    createdAt: 0,
    lineage: null,
    ledger: null,
    checkpoint: null,
    missionLinkage: null,
    actionability: null,
    reviewProfileId: null,
    reviewGate: null,
    reviewFindings: null,
    reviewRunId: null,
    skillUsage: null,
    autofixCandidate: null,
    sessionBoundary: null,
    continuation: null,
    nextOperatorAction: null,
    governance: null,
    placement: null,
    workspaceEvidence: null,
    failureClass: null,
    relaunchOptions: null,
    subAgentSummary: null,
    publishHandoff: null,
    takeoverBundle: null,
    selectedOpportunityId: null,
    wakeReason: null,
    wakeState: null,
    sourceCitations: null,
    queuePosition: null,
    nextEligibleAction: null,
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<HugeCodeMissionControlSnapshot> = {}
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
    ...overrides,
  };
}

describe("createSnapshotBackedMissionControlBindings", () => {
  it("uses the injected snapshot reader for mission control snapshot calls", async () => {
    const snapshot = createSnapshot();
    const readMissionControlSnapshot = vi.fn(async () => snapshot);

    const bindings = createSnapshotBackedMissionControlBindings({
      readMissionControlSnapshot,
    });

    await expect(bindings.readMissionControlSnapshot()).resolves.toBe(snapshot);
    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("createSnapshotBackedMissionControlSurfaceBindings", () => {
  it("derives review bindings from the same snapshot-backed surface", async () => {
    const snapshot = createSnapshot({
      reviewPacks: [createReviewPack()],
    });
    const readMissionControlSnapshot = vi.fn(async () => snapshot);

    const bindings = createSnapshotBackedMissionControlSurfaceBindings({
      readMissionControlSnapshot,
    });

    await expect(bindings.review.listReviewPacks()).resolves.toEqual(snapshot.reviewPacks);

    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("readMissionControlSnapshotFromSourceAdapter", () => {
  it("prefers projection bootstrap mission-control truth over snapshot fallback", async () => {
    const projectionSnapshot = createSnapshot({
      generatedAt: 1,
      reviewPacks: [createReviewPack()],
    });
    const readMissionControlSnapshot = vi.fn(async () =>
      createSnapshot({
        generatedAt: 2,
      })
    );

    const snapshot = await readMissionControlSnapshotFromSourceAdapter({
      bootstrapKernelProjection: async () => ({
        revision: 4,
        sliceRevisions: { mission_control: 4 },
        slices: {
          mission_control: projectionSnapshot,
        },
      }),
      readMissionControlSnapshot,
    });

    expect(snapshot).toEqual(projectionSnapshot);
    expect(readMissionControlSnapshot).not.toHaveBeenCalled();
  });

  it("reports when projection bootstrap falls back to snapshot truth", async () => {
    const fallbackSnapshot = createSnapshot({ generatedAt: 3 });
    const reportMissionControlFallback = vi.fn();

    const snapshot = await readMissionControlSnapshotFromSourceAdapter({
      bootstrapKernelProjection: async () => {
        throw new Error("projection unavailable");
      },
      readMissionControlSnapshot: async () => fallbackSnapshot,
      reportMissionControlFallback,
    });

    expect(snapshot).toEqual(fallbackSnapshot);
    expect(reportMissionControlFallback).toHaveBeenCalledWith({
      reason: "projection_bootstrap_failed",
      error: expect.any(Error),
    });
  });

  it("reports when bootstrap succeeds but mission-control projection truth is missing", async () => {
    const fallbackSnapshot = createSnapshot({ generatedAt: 4 });
    const reportMissionControlFallback = vi.fn();

    const snapshot = await readMissionControlSnapshotFromSourceAdapter({
      bootstrapKernelProjection: async () => ({
        revision: 2,
        sliceRevisions: {},
        slices: {},
      }),
      readMissionControlSnapshot: async () => fallbackSnapshot,
      reportMissionControlFallback,
    });

    expect(snapshot).toEqual(fallbackSnapshot);
    expect(reportMissionControlFallback).toHaveBeenCalledWith({
      reason: "projection_slice_missing",
    });
  });
});

describe("createWorkspaceClientRuntimeMissionControlSurfaceBindings", () => {
  it("falls back to snapshot-backed composition when projection bootstrap fails", async () => {
    const fallbackSnapshot = createSnapshot({
      generatedAt: 3,
      reviewPacks: [
        createReviewPack({
          id: "review-pack-2",
          workspaceId: "workspace-2",
        }),
      ],
    });
    const bindings = createWorkspaceClientRuntimeMissionControlSurfaceBindings({
      bootstrapKernelProjection: async () => {
        throw new Error("projection unavailable");
      },
      readMissionControlSnapshot: async () => fallbackSnapshot,
    });

    await expect(bindings.missionControl.readMissionControlSnapshot()).resolves.toEqual(
      fallbackSnapshot
    );
    await expect(bindings.review.listReviewPacks()).resolves.toEqual(fallbackSnapshot.reviewPacks);
  });
});
