import { describe, expect, it } from "vitest";
import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import type { RequestUserInputRequest } from "../../../types";
import {
  buildHomeMissionSignalsViewModel,
  buildHomeRuntimeNoticeViewModel,
  buildHomeWorkspaceRoutingViewModel,
} from "./homeViewModel";

describe("homeViewModel", () => {
  it("prefers runtime mission-control counts when available", () => {
    const userInputRequest: RequestUserInputRequest = {
      workspace_id: "workspace-1",
      request_id: "input-1",
      params: {
        questions: [{ id: "clarify", label: "Clarify", prompt: "Need detail" }],
      },
    } as unknown as RequestUserInputRequest;
    const projection: MissionControlProjection = {
      source: "runtime_snapshot_v1",
      generatedAt: 1,
      workspaces: [],
      tasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Ready mission",
          updatedAt: 1,
          latestRunId: "run-1",
          latestRunState: "review_ready",
          origin: {
            kind: "runtime_task",
            threadId: "thread-1",
          },
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready",
          title: "Ready mission",
          summary: "Runtime evidence is ready for review.",
          updatedAt: 1,
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Ready",
          reviewStatus: "ready",
          evidenceState: "confirmed",
          validationOutcome: "passed",
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: null,
          createdAt: 1,
        },
      ],
    } as unknown as MissionControlProjection;
    const model = buildHomeMissionSignalsViewModel({
      latestAgentRuns: [
        { statusKind: "active", warningCount: 0 },
        { statusKind: "review_ready", warningCount: 0 },
      ],
      missionControlProjection: projection,
      missionControlFreshness: null,
      approvals: [],
      userInputRequests: [userInputRequest],
    });

    expect(model.missionSignals.reviewReadyCount).toBe(1);
    expect(model.missionSignals.awaitingActionCount).toBe(1);
    expect(model.missionControlStatusLabel).toBeNull();
    expect(model.missionControlStatus).toBeNull();
    expect(model.missionControlSignals?.reviewReadyCount).toBe(1);
  });

  it("condenses mission-control freshness into a badge-friendly status model", () => {
    const model = buildHomeMissionSignalsViewModel({
      latestAgentRuns: [],
      missionControlProjection: null,
      missionControlFreshness: {
        status: "loading",
        isStale: false,
        error: null,
        lastUpdatedAt: null,
      },
      approvals: [],
      userInputRequests: [],
    });

    expect(model.missionControlStatus).toEqual({
      label: "Syncing",
      tone: "progress",
    });
    expect(model.missionControlStatusLabel).toBe("Syncing mission control");
  });

  it("derives workspace routing labels from pending and active workspace state", () => {
    const model = buildHomeWorkspaceRoutingViewModel({
      workspaces: [
        { id: "workspace-1", name: "Workspace One", path: "/tmp/one", connected: true },
        { id: "workspace-2", name: "Workspace Two", path: "/tmp/two", connected: false },
      ],
      activeWorkspaceId: "workspace-1",
      pendingWorkspaceSelectionId: "workspace-2",
      workspaceLoadError: null,
      canConnectLocalRuntime: true,
    });

    expect(model.displayedWorkspaceId).toBe("workspace-2");
    expect(model.workspaceSummaryMeta).toBe("Switching");
    expect(model.workspaceSummaryDetail).toContain("/tmp/two");
    expect(model.workspaceSelectOptions).toHaveLength(2);
  });

  it("builds a manual runtime notice when no workspaces are connected", () => {
    const model = buildHomeRuntimeNoticeViewModel({
      workspaces: [],
      workspaceLoadError: null,
      runtimeUnavailable: false,
      showLocalRuntimeEntry: true,
    });

    expect(model.showRuntimeNotice).toBe(true);
    expect(model.runtimeNoticeState).toBe("manual");
    expect(model.runtimeNoticeTitle).toBe("Runtime");
  });
});
