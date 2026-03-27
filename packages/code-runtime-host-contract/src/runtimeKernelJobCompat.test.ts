import { describe, expect, it } from "vitest";
import type { RuntimeRunRecordV2 } from "./codeRuntimeRpc.js";
import {
  projectRuntimeRunRecordToInterventionAckCompat,
  projectRuntimeRunRecordToKernelJobCompat,
  projectRuntimeRunRecordToResumeAckCompat,
  projectRuntimeRunSummaryToKernelJobCompat,
  readRuntimeRunIdCompat,
} from "./runtimeKernelJobCompat.js";

describe("runtimeKernelJobCompat", () => {
  it("projects kernel job compat from canonical continuation truth", () => {
    const record = {
      run: {
        taskId: "run-review-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        requestId: null,
        title: "Review follow-up",
        status: "needs_input",
        accessMode: "on-request",
        executionMode: "distributed",
        provider: "openai",
        modelId: "gpt-5.4",
        routedProvider: "openai",
        routedModelId: "gpt-5.4",
        routedPool: "auto",
        routedSource: "workspace-default",
        currentStep: 4,
        createdAt: 10,
        updatedAt: 25,
        startedAt: 15,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        checkpointId: "checkpoint-review-1",
        traceId: "trace-review-1",
        recovered: false,
        checkpointState: {
          state: "paused",
          checkpointId: "checkpoint-review-1",
          traceId: "trace-review-1",
          resumeReady: false,
        },
        preferredBackendIds: ["backend-a"],
        backendId: "backend-a",
        steps: [],
      },
      missionRun: {
        id: "run-review-1",
        taskId: "task-review-1",
        workspaceId: "workspace-1",
        state: "needs_input",
        title: "Review follow-up",
        summary: "Mission is waiting for follow-up.",
        startedAt: 15,
        updatedAt: 25,
        continuation: {
          state: "blocked",
          pathKind: "review",
          source: "review_actionability",
          summary: null,
          detail: null,
          recommendedAction: "Inspect blocked review follow-up",
          sessionBoundary: {
            workspaceId: "workspace-1",
            taskId: "task-review-1",
            runId: "run-review-1",
            reviewPackId: "review-pack-1",
          },
        },
        checkpoint: {
          checkpointId: "checkpoint-review-1",
          traceId: "trace-review-1",
          recovered: false,
          resumeReady: false,
        },
        takeoverBundle: {
          state: "blocked",
          pathKind: "review",
          primaryAction: "open_review_pack",
          summary: "Take over the review pack.",
          blockingReason: "Resolve review issues before continuing.",
          recommendedAction: "Open the review pack and resolve the blocked follow-up.",
          reviewPackId: "review-pack-1",
          target: {
            kind: "review_pack",
            workspaceId: "workspace-1",
            taskId: "task-review-1",
            runId: "run-review-1",
            reviewPackId: "review-pack-1",
          },
          reviewActionability: {
            state: "blocked",
            summary: "Review pack is blocked on unresolved findings.",
            degradedReasons: [],
            actions: [],
          },
        },
      },
      reviewPack: {
        id: "review-pack-1",
        workspaceId: "workspace-1",
        taskId: "task-review-1",
        runId: "run-review-1",
        reviewStatus: "blocked",
        title: "Review pack",
        summary: "Review pack summary",
        createdAt: 20,
        updatedAt: 25,
        actionability: {
          state: "ready",
          summary: "Fallback review truth",
          degradedReasons: [],
          actions: [],
        },
        takeoverBundle: {
          state: "blocked",
          pathKind: "review",
          primaryAction: "open_review_pack",
          summary: "Take over the review pack.",
          blockingReason: "Resolve review issues before continuing.",
          recommendedAction: "Open the review pack and resolve the blocked follow-up.",
          reviewPackId: "review-pack-1",
          target: {
            kind: "review_pack",
            workspaceId: "workspace-1",
            taskId: "task-review-1",
            runId: "run-review-1",
            reviewPackId: "review-pack-1",
          },
          reviewActionability: {
            state: "blocked",
            summary: "Review pack is blocked on unresolved findings.",
            degradedReasons: [],
            actions: [],
          },
        },
      },
    } satisfies RuntimeRunRecordV2;

    expect(readRuntimeRunIdCompat(record)).toBe("run-review-1");
    expect(
      projectRuntimeRunRecordToKernelJobCompat(record, "code_runtime_run_get_v2")
    ).toMatchObject({
      id: "run-review-1",
      continuation: {
        reviewActionability: {
          state: "blocked",
          summary: "Review pack is blocked on unresolved findings.",
        },
        summary: "Review pack is blocked on unresolved findings.",
        takeover: {
          state: "blocked",
          pathKind: "review",
        },
      },
      metadata: {
        canonicalMethod: "code_runtime_run_get_v2",
        runId: "run-review-1",
        reviewPackId: "review-pack-1",
      },
    });
  });

  it("preserves explicit continuation summaries and projects compat resume/intervention acks", () => {
    const record = {
      run: {
        taskId: "run-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        requestId: null,
        title: "Resume task",
        status: "running",
        accessMode: "on-request",
        executionMode: "distributed",
        provider: "openai",
        modelId: "gpt-5.4",
        routedProvider: "openai",
        routedModelId: "gpt-5.4",
        routedPool: "auto",
        routedSource: "workspace-default",
        currentStep: 2,
        createdAt: 10,
        updatedAt: 25,
        startedAt: 15,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        recovered: true,
        checkpointState: {
          state: "running",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          resumeReady: true,
        },
        preferredBackendIds: ["backend-a"],
        backendId: "backend-a",
        steps: [],
      },
      missionRun: {
        id: "run-1",
        taskId: "task-1",
        workspaceId: "workspace-1",
        state: "running",
        title: "Resume task",
        summary: "Runtime truth",
        startedAt: 15,
        updatedAt: 25,
        continuation: {
          state: "ready",
          pathKind: "resume",
          source: "takeover_bundle",
          summary: "Ready to resume.",
          detail: null,
          recommendedAction: "Resume run",
          sessionBoundary: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: null,
          },
        },
      },
      reviewPack: null,
    } satisfies RuntimeRunRecordV2;

    expect(
      projectRuntimeRunRecordToKernelJobCompat(record, "code_runtime_run_start_v2")
    ).toMatchObject({
      continuation: {
        summary: "Ready to resume.",
        resumeSupported: true,
      },
      metadata: {
        canonicalMethod: "code_runtime_run_start_v2",
      },
    });

    expect(projectRuntimeRunRecordToResumeAckCompat(record, { message: "" })).toEqual({
      accepted: true,
      runId: "run-1",
      status: "running",
      code: null,
      message: "",
      recovered: true,
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
      updatedAt: 25,
    });

    expect(
      projectRuntimeRunRecordToInterventionAckCompat(
        {
          runId: "prior-run",
          action: "retry",
        },
        record
      )
    ).toEqual({
      accepted: true,
      action: "retry",
      runId: "run-1",
      status: "running",
      outcome: "spawned",
      spawnedRunId: "run-1",
      checkpointId: "checkpoint-1",
    });
  });

  it("projects runtime run summaries to compat kernel jobs for canonical list reads", () => {
    expect(
      projectRuntimeRunSummaryToKernelJobCompat(
        {
          taskId: "run-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: null,
          title: "Review follow-up",
          status: "running",
          accessMode: "on-request",
          executionMode: "distributed",
          provider: "openai",
          modelId: "gpt-5.4",
          routedProvider: "openai",
          routedModelId: "gpt-5.4",
          routedPool: "auto",
          routedSource: "workspace-default",
          currentStep: 2,
          createdAt: 10,
          updatedAt: 20,
          startedAt: 15,
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          checkpointId: "checkpoint-1",
          recovered: true,
          reviewPackId: "review-pack-1",
          continuation: {
            summary: null,
            pathKind: "review",
          },
          takeoverBundle: {
            state: "blocked",
            pathKind: "review",
            primaryAction: "open_review_pack",
            summary: "Take over the review pack.",
            blockingReason: "Resolve review issues before continuing.",
            recommendedAction: "Open the review pack and resolve the blocked follow-up.",
            reviewPackId: "review-pack-1",
            target: {
              kind: "review_pack",
              workspaceId: "workspace-1",
              taskId: "task-review-1",
              runId: "run-1",
              reviewPackId: "review-pack-1",
            },
            reviewActionability: {
              state: "blocked",
              summary: "Review pack is blocked on unresolved findings.",
              degradedReasons: [],
              actions: [],
            },
          },
          reviewActionability: {
            state: "ready",
            summary: "Fallback review truth",
            degradedReasons: [],
            actions: [],
          },
          publishHandoff: {
            state: "available",
            summary: "Fallback publish handoff",
            label: "Open handoff",
            target: {
              kind: "mission_thread",
              workspaceId: "workspace-1",
              threadId: "thread-1",
            },
          },
          backendId: "backend-a",
          preferredBackendIds: ["backend-a"],
          steps: [],
        },
        "code_runtime_runs_list"
      )
    ).toMatchObject({
      id: "run-1",
      continuation: {
        reviewActionability: {
          state: "blocked",
          summary: "Review pack is blocked on unresolved findings.",
        },
        summary: "Review pack is blocked on unresolved findings.",
        publishHandoff: {
          summary: "Fallback publish handoff",
        },
      },
      metadata: {
        canonicalMethod: "code_runtime_runs_list",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
    });
  });
});
