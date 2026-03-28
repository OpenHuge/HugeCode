import { describe, expect, it, vi } from "vitest";
import { createSnapshotBackedMissionControlBindings } from "./missionControlBindings";

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
