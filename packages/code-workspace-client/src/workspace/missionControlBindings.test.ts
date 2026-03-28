import { describe, expect, it, vi } from "vitest";
import {
  createSnapshotBackedMissionControlBindings,
  createSnapshotBackedMissionControlSurfaceBindings,
  createWorkspaceClientRuntimeMissionControlSurfaceBindings,
  readMissionControlSnapshotFromSourceAdapter,
} from "./missionControlBindings";

describe("createSnapshotBackedMissionControlBindings", () => {
  it("uses the injected snapshot reader for both snapshot and summary calls", async () => {
    const snapshot = {
      source: "runtime_snapshot_v1" as const,
      generatedAt: 0,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [],
    };
    const readMissionControlSnapshot = vi.fn(async () => snapshot);
    const compose = vi.fn((_value, activeWorkspaceId) => ({
      workspaceLabel: activeWorkspaceId ?? "all",
      tasksCount: 0,
      runsCount: 0,
      approvalCount: 0,
      reviewPacksCount: 0,
      connectedWorkspaceCount: 0,
      launchReadiness: {
        tone: "idle" as const,
        label: "Launch readiness",
        detail: "Idle",
      },
      continuityReadiness: {
        tone: "idle" as const,
        label: "Continuity readiness",
        detail: "Idle",
      },
      missionItems: [],
      reviewItems: [],
    }));

    const bindings = createSnapshotBackedMissionControlBindings({
      readMissionControlSnapshot,
      composer: { compose },
    });

    await expect(bindings.readMissionControlSnapshot()).resolves.toBe(snapshot);
    await expect(bindings.readMissionControlSummary?.("workspace-1")).resolves.toMatchObject({
      workspaceLabel: "workspace-1",
    });

    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(2);
    expect(compose).toHaveBeenCalledWith(snapshot, "workspace-1");
  });
});

describe("createSnapshotBackedMissionControlSurfaceBindings", () => {
  it("derives review bindings from the same snapshot-backed surface", async () => {
    const snapshot = {
      source: "runtime_snapshot_v1" as const,
      generatedAt: 0,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [
        {
          id: "review-pack-1",
          workspaceId: "workspace-1",
        },
      ],
    };
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
    const projectionSnapshot = {
      source: "runtime_snapshot_v1" as const,
      generatedAt: 1,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [{ id: "review-pack-1", workspaceId: "workspace-1" }],
    };
    const readMissionControlSnapshot = vi.fn(async () => ({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 2,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [],
    }));

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
});

describe("createWorkspaceClientRuntimeMissionControlSurfaceBindings", () => {
  it("falls back to snapshot-backed composition when projection bootstrap fails", async () => {
    const fallbackSnapshot = {
      source: "runtime_snapshot_v1" as const,
      generatedAt: 3,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [{ id: "review-pack-2", workspaceId: "workspace-2" }],
    };
    const bindings = createWorkspaceClientRuntimeMissionControlSurfaceBindings({
      bootstrapKernelProjection: async () => {
        throw new Error("projection unavailable");
      },
      readMissionControlSnapshot: async () => fallbackSnapshot,
      composer: {
        compose: (snapshot, activeWorkspaceId) => ({
          workspaceLabel: activeWorkspaceId ?? "all",
          tasksCount: snapshot?.tasks.length ?? 0,
          runsCount: snapshot?.runs.length ?? 0,
          approvalCount: 0,
          reviewPacksCount: snapshot?.reviewPacks.length ?? 0,
          connectedWorkspaceCount: snapshot?.workspaces.length ?? 0,
          launchReadiness: {
            tone: "idle",
            label: "Launch readiness",
            detail: "Idle",
          },
          continuityReadiness: {
            tone: "idle",
            label: "Continuity readiness",
            detail: "Idle",
          },
          missionItems: [],
          reviewItems: [],
        }),
      },
    });

    await expect(bindings.missionControl.readMissionControlSnapshot()).resolves.toEqual(
      fallbackSnapshot
    );
    await expect(
      bindings.missionControl.readMissionControlSummary?.("workspace-2")
    ).resolves.toMatchObject({
      reviewPacksCount: 1,
      tasksCount: 0,
      runsCount: 0,
    });
    await expect(bindings.review.listReviewPacks()).resolves.toEqual(fallbackSnapshot.reviewPacks);
  });
});
