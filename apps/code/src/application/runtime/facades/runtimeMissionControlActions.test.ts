import { describe, expect, it } from "vitest";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import {
  collectInterruptibleRuntimeTasks,
  summarizeResumeBatchResults,
} from "./runtimeMissionControlActions";

function buildTask(
  taskId: string,
  status: RuntimeAgentTaskSummary["status"]
): RuntimeAgentTaskSummary {
  return {
    taskId,
    workspaceId: "workspace-1",
    threadId: null,
    requestId: null,
    title: `Task ${taskId}`,
    status,
    accessMode: "on-request",
    executionMode: "single",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    reasonEffort: "medium",
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: "codex",
    routedSource: "workspace-default",
    currentStep: 0,
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: status === "awaiting_approval" ? `${taskId}-approval` : null,
    steps: [],
  };
}

describe("runtimeMissionControlActions", () => {
  it("collects only queued, running, and approval-blocked tasks for batch interrupt", () => {
    expect(
      collectInterruptibleRuntimeTasks([
        buildTask("queued-task", "queued"),
        buildTask("running-task", "running"),
        buildTask("approval-task", "awaiting_approval"),
        buildTask("completed-task", "completed"),
      ]).map((task) => task.taskId)
    ).toEqual(["queued-task", "running-task", "approval-task"]);
  });

  it("summarizes accepted, runtime-rejected, and failed resume attempts", () => {
    expect(
      summarizeResumeBatchResults([
        { status: "accepted" },
        { status: "rejected", errorLabel: "checkpoint missing" },
        { status: "failed", errorLabel: "NETWORK_DOWN" },
      ])
    ).toEqual({
      info: "Resumed 1 recoverable run(s). 1 rejected by runtime. 1 failed to call resume.",
      error: "Resume errors: checkpoint missing",
    });
  });
});
