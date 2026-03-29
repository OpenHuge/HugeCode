import { describe, expect, it } from "vitest";
import type {
  HugeCodeRunPlacementEvidence,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import {
  buildMissionControlLoopItems,
  buildMissionRunSupervisionSignals,
} from "./runtimeMissionControlPresentation";

function createRuntimeTask(
  overrides: Partial<RuntimeAgentTaskSummary> = {}
): RuntimeAgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "workspace-1",
    threadId: "thread-1",
    title: "Runtime mission",
    status: "running",
    accessMode: "full-access",
    distributedStatus: "running",
    currentStep: 1,
    createdAt: 1,
    updatedAt: 2,
    startedAt: 2,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    checkpointId: null,
    traceId: null,
    recovered: false,
    ...overrides,
  };
}

function createPlacement(
  overrides: Partial<HugeCodeRunPlacementEvidence> = {}
): HugeCodeRunPlacementEvidence {
  return {
    resolvedBackendId: "backend-primary",
    requestedBackendIds: ["backend-primary"],
    resolutionSource: "explicit_preference",
    lifecycleState: "confirmed",
    readiness: "ready",
    healthSummary: "placement_ready",
    attentionReasons: [],
    summary: "Runtime confirmed placement on backend-primary.",
    rationale: "Runtime honored the explicit backend preference.",
    backendContract: null,
    ...overrides,
  };
}

describe("runtimeMissionControlPresentation", () => {
  it("describes the control-device mission loop from runtime task counts", () => {
    const items = buildMissionControlLoopItems([
      createRuntimeTask({ taskId: "task-queued", status: "queued" }),
      createRuntimeTask({ taskId: "task-running", status: "running" }),
      createRuntimeTask({ taskId: "task-review", status: "completed" }),
    ]);

    expect(items).toEqual([
      {
        id: "observe",
        label: "Observe",
        detail: "2 active runs can be supervised from this control device.",
      },
      {
        id: "approve",
        label: "Approve",
        detail: "Approval requests stay visible here without introducing page-local task truth.",
      },
      {
        id: "intervene",
        label: "Intervene",
        detail:
          "Retry, clarify, or switch profile while runtime remains the source of truth for placement and lifecycle.",
      },
      {
        id: "resume",
        label: "Resume",
        detail: "Resume from checkpoint or handoff using published checkpoint and trace IDs.",
      },
      {
        id: "review",
        label: "Review",
        detail: "1 completed run moves into Review Pack as the primary finish-line surface.",
      },
    ]);
  });

  it("surfaces runtime-confirmed placement, checkpoint, and recovery truth for supervision", () => {
    const task = createRuntimeTask({
      checkpointId: "checkpoint-7",
      traceId: "trace-7",
      recovered: true,
      taskSource: {
        kind: "github_issue",
        label: "GitHub issue #42",
      } as RuntimeAgentTaskSummary["taskSource"],
    });
    const run: Pick<HugeCodeRunSummary, "placement"> = {
      placement: createPlacement(),
    };

    expect(buildMissionRunSupervisionSignals(task, run)).toEqual([
      "Runtime confirmed placement on backend-primary.",
      "Checkpoint checkpoint-7 is ready for resume or handoff.",
      "Recovered after a runtime restart and ready for supervised resume.",
      "Source-linked launch: GitHub issue #42.",
    ]);
  });

  it("falls back to trace and pending-routing messaging when checkpoint truth is not published yet", () => {
    const task = createRuntimeTask({
      status: "awaiting_approval",
      checkpointId: null,
      traceId: "trace-11",
    });
    const run: Pick<HugeCodeRunSummary, "placement"> = {
      placement: createPlacement({
        resolvedBackendId: null,
        lifecycleState: "requested",
        summary: "Runtime recorded routing intent.",
        rationale: "Runtime has not confirmed placement yet.",
      }),
    };

    expect(buildMissionRunSupervisionSignals(task, run)).toEqual([
      "Approval or clarification is blocking this run.",
      "Routing intent is recorded, but runtime has not confirmed placement yet.",
      "Trace trace-11 is available for remote supervision.",
    ]);
  });

  it("surfaces awaiting-runtime messaging when placement truth is missing", () => {
    const task = createRuntimeTask({
      checkpointId: null,
      traceId: "trace-21",
    });
    const run: Pick<HugeCodeRunSummary, "placement"> = {
      placement: null,
    };

    expect(buildMissionRunSupervisionSignals(task, run)).toEqual([
      "Runtime has not published placement confirmation yet.",
      "Trace trace-21 is available for remote supervision.",
    ]);
  });
});
