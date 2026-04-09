import { describe, expect, it } from "vitest";
import type { HugeCodeRunSummary, HugeCodeTakeoverBundle } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import {
  resolveSubAgentContinuationLabel,
  resolveSubAgentContinuationTarget,
} from "./runtimeSubAgentNavigation";

function buildTask(overrides: Partial<RuntimeAgentTaskSummary> = {}): RuntimeAgentTaskSummary {
  const now = 1_700_000_000_000;
  return {
    taskId: "runtime-task-1",
    workspaceId: "workspace-1",
    threadId: "thread-parent-1",
    title: "Delegated runtime task",
    status: "running",
    accessMode: "on-request",
    distributedStatus: null,
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    ...overrides,
  };
}

function buildRun(overrides: Partial<HugeCodeRunSummary> = {}): HugeCodeRunSummary {
  return {
    id: "runtime-run-1",
    taskId: "runtime-task-1",
    workspaceId: "workspace-1",
    state: "running",
    title: "Delegated runtime task",
    summary: "Runtime is coordinating delegated work.",
    startedAt: 1_700_000_000_000,
    finishedAt: null,
    updatedAt: 1_700_000_050_000,
    warnings: [],
    validations: [],
    artifacts: [],
    changedPaths: [],
    ...overrides,
  } as HugeCodeRunSummary;
}

function buildTakeoverBundle(
  overrides: Partial<HugeCodeTakeoverBundle> = {}
): HugeCodeTakeoverBundle {
  return {
    state: "ready",
    pathKind: "handoff",
    primaryAction: "open_sub_agent_session",
    summary: "Continue through the delegated session handle.",
    recommendedAction: "Use the delegated session handle.",
    ...overrides,
  };
}

describe("runtimeSubAgentNavigation", () => {
  it("labels thread-backed child continuation links as thread navigation", () => {
    const target = resolveSubAgentContinuationTarget({
      task: buildTask(),
      run: buildRun(),
      takeoverBundle: buildTakeoverBundle({
        pathKind: "approval",
        target: {
          kind: "sub_agent_session",
          workspaceId: "workspace-1",
          sessionId: "session-child-1",
          parentRunId: "runtime-run-1",
          threadId: "thread-child-1",
        },
      }),
    });

    expect(target).toEqual({
      kind: "thread",
      workspaceId: "workspace-1",
      threadId: "thread-child-1",
    });
    expect(resolveSubAgentContinuationLabel({ pathKind: "approval", target })).toBe("Open thread");
  });

  it("labels parent-run fallbacks as mission navigation instead of resume/takeover actions", () => {
    const target = resolveSubAgentContinuationTarget({
      task: buildTask({ threadId: null }),
      run: buildRun({ reviewPackId: "review-pack-parent" }),
      takeoverBundle: buildTakeoverBundle({
        pathKind: "resume",
        primaryAction: "resume",
        target: {
          kind: "sub_agent_session",
          workspaceId: "workspace-1",
          sessionId: "session-child-2",
          parentRunId: "runtime-run-parent",
          threadId: null,
        },
      }),
    });

    expect(target).toEqual({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task-1",
      runId: "runtime-run-parent",
      reviewPackId: "review-pack-parent",
      threadId: null,
      limitation: "thread_unavailable",
    });
    expect(resolveSubAgentContinuationLabel({ pathKind: "resume", target })).toBe("Open mission");
  });
});
