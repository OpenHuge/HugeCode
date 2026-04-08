import { describe, expect, it } from "vitest";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskResumeResult } from "../types/webMcpBridge";
import {
  buildRuntimeManagedTaskStartInfo,
  buildRuntimeResumeBatchOutcome,
  buildRuntimeTaskResumeFeedback,
  readStalePendingApprovalInterruptInfo,
  resolvePrepareRunLauncherProfileId,
} from "./runtimeMissionControlControllerActionHelpers";

describe("runtimeMissionControlControllerActionHelpers", () => {
  it("formats accepted resume feedback with checkpoint context", () => {
    expect(
      buildRuntimeTaskResumeFeedback("task-1", {
        accepted: true,
        taskId: "task-1",
        status: "running",
        message: "",
        checkpointId: "checkpoint-7",
      } as RuntimeAgentTaskResumeResult)
    ).toEqual({
      info: "Run task-1 resumed (checkpoint checkpoint-7).",
      error: null,
    });
  });

  it("maps settled resume results into batch outcomes", () => {
    expect(
      buildRuntimeResumeBatchOutcome({
        status: "fulfilled",
        value: {
          accepted: false,
          taskId: "task-1",
          status: "interrupted",
          message: "checkpoint missing",
          code: "CHECKPOINT_MISSING",
        } as RuntimeAgentTaskResumeResult,
      })
    ).toEqual({
      status: "rejected",
      errorLabel: "CHECKPOINT_MISSING",
    });

    expect(
      buildRuntimeResumeBatchOutcome({
        status: "rejected",
        reason: { message: "network down", code: "NETWORK_DOWN" },
      })
    ).toEqual({
      status: "failed",
      errorLabel: "NETWORK_DOWN",
    });
  });

  it("formats dispatch and direct-run start summaries", () => {
    expect(
      buildRuntimeManagedTaskStartInfo({
        dispatchPlanTaskCount: 3,
        dispatchSessionId: "dispatch-1",
        executionProfileName: "Balanced",
        routedProvider: null,
        selectedProviderRouteLabel: null,
      })
    ).toBe("Parallel dispatch dispatch-1 started with 3 chunk(s).");

    expect(
      buildRuntimeManagedTaskStartInfo({
        dispatchPlanTaskCount: null,
        dispatchSessionId: null,
        executionProfileName: "Balanced",
        routedProvider: "backend-a",
        selectedProviderRouteLabel: "Backend A",
      })
    ).toBe("Mission run started with Balanced via Backend A.");
  });

  it("prefers explicit launcher profiles before projected run defaults", () => {
    const projectedRunsByTaskId = new Map<string, HugeCodeRunSummary>([
      [
        "task-1",
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "ws-1",
          state: "running",
          title: null,
          summary: null,
          startedAt: null,
          finishedAt: null,
          updatedAt: 1,
          currentStepIndex: null,
          warnings: [],
          validations: [],
          artifacts: [],
          changedPaths: [],
          executionProfile: {
            id: "projected-profile",
          } as HugeCodeRunSummary["executionProfile"],
        } as HugeCodeRunSummary,
      ],
    ]);

    expect(
      resolvePrepareRunLauncherProfileId({
        taskId: "task-1",
        profileId: "explicit-profile",
        projectedRunsByTaskId,
      })
    ).toBe("explicit-profile");

    expect(
      resolvePrepareRunLauncherProfileId({
        taskId: "task-1",
        projectedRunsByTaskId,
      })
    ).toBe("projected-profile");

    expect(readStalePendingApprovalInterruptInfo([])).toBe(
      "No stale pending approvals to interrupt."
    );
  });
});
