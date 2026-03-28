import { describe, expect, it, vi } from "vitest";
import { createMissionControlSummaryLoader } from "./missionControlSummaryLoader";
import type { MissionControlSummaryComposer } from "./missionControlSummaryContracts";

describe("createMissionControlSummaryLoader", () => {
  it("prefers a precomputed runtime summary when available", async () => {
    const readMissionControlSummary = vi.fn(async () => ({
      workspaceLabel: "Alpha",
      tasksCount: 1,
      runsCount: 2,
      approvalCount: 0,
      reviewPacksCount: 1,
      connectedWorkspaceCount: 1,
      launchReadiness: {
        tone: "ready" as const,
        label: "Launch readiness",
        detail: "Ready",
      },
      continuityReadiness: {
        tone: "ready" as const,
        label: "Continuity readiness",
        detail: "Ready",
      },
      missionItems: [],
      reviewItems: [],
    }));
    const readMissionControlSnapshot = vi.fn(async () => {
      throw new Error("snapshot should not be called");
    });

    const loader = createMissionControlSummaryLoader({
      readMissionControlSnapshot,
      readMissionControlSummary,
    });
    const result = await loader.load("workspace-1");

    expect(readMissionControlSummary).toHaveBeenCalledWith("workspace-1");
    expect(readMissionControlSnapshot).not.toHaveBeenCalled();
    expect(result.snapshot).toBeNull();
    expect(result.summary.workspaceLabel).toBe("Alpha");
  });

  it("falls back to snapshot composition when a precomputed summary is unavailable", async () => {
    const snapshot = {
      source: "runtime_snapshot_v1" as const,
      generatedAt: 0,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [],
    };
    const readMissionControlSnapshot = vi.fn(async () => snapshot);
    const compose = vi.fn((value, activeWorkspaceId) => ({
      workspaceLabel: activeWorkspaceId ?? "all",
      tasksCount: value?.tasks.length ?? 0,
      runsCount: value?.runs.length ?? 0,
      approvalCount: 0,
      reviewPacksCount: value?.reviewPacks.length ?? 0,
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

    const loader = createMissionControlSummaryLoader(
      {
        readMissionControlSnapshot,
      },
      { compose } satisfies MissionControlSummaryComposer
    );
    const result = await loader.load("workspace-1");

    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(1);
    expect(compose).toHaveBeenCalledWith(snapshot, "workspace-1");
    expect(result.snapshot).toBe(snapshot);
    expect(result.summary.workspaceLabel).toBe("workspace-1");
  });
});
