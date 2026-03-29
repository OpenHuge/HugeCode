import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import { createMissionControlSummaryLoader } from "./missionControlSummaryLoader";
import type { MissionControlSummaryComposer } from "./missionControlSummaryContracts";

function createTask(overrides: Partial<HugeCodeTaskSummary> = {}): HugeCodeTaskSummary {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    title: "Task 1",
    objective: null,
    origin: {
      kind: "run",
      runId: "run-1",
      threadId: null,
      requestId: null,
    },
    taskSource: null,
    mode: null,
    modeSource: "missing",
    status: "queued",
    createdAt: 0,
    updatedAt: 0,
    currentRunId: null,
    latestRunId: null,
    latestRunState: null,
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<HugeCodeMissionControlSnapshot> = {}
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [
      {
        id: "workspace-1",
        name: "Alpha",
        rootPath: "/alpha",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [],
    runs: [],
    reviewPacks: [],
    ...overrides,
  };
}

describe("createMissionControlSummaryLoader", () => {
  it("always composes mission control summary from snapshot truth", async () => {
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
    const snapshot = createSnapshot({
      tasks: [createTask()],
    });
    const source = {
      readMissionControlSnapshot: vi.fn(async () => snapshot),
      readMissionControlSummary,
    };
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

    const loader = createMissionControlSummaryLoader(source, {
      compose,
    } satisfies MissionControlSummaryComposer);
    const result = await loader.load("workspace-1");

    expect(readMissionControlSummary).not.toHaveBeenCalled();
    expect(source.readMissionControlSnapshot).toHaveBeenCalledTimes(1);
    expect(compose).toHaveBeenCalledWith(snapshot, "workspace-1");
    expect(result.snapshot).toBe(snapshot);
    expect(result.summary.workspaceLabel).toBe("workspace-1");
  });

  it("falls back to snapshot composition when a precomputed summary is unavailable", async () => {
    const snapshot = createSnapshot({
      workspaces: [],
    });
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
