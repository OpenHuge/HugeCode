import { describe, expect, it } from "vitest";
import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import {
  listRunExecutionProfiles,
  resolveExecutionProfile,
} from "./runtimeMissionControlExecutionProfiles";

function createTask(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "ws-1",
    threadId: null,
    requestId: null,
    title: "Task",
    status: "queued",
    accessMode: "on-request",
    executionMode: "single",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: null,
    routedSource: "workspace-default",
    currentStep: 0,
    createdAt: 1,
    updatedAt: 1,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [],
    ...overrides,
  };
}

describe("runtimeMissionControlExecutionProfiles", () => {
  it("lists the three supported execution presets", () => {
    expect(listRunExecutionProfiles().map((profile) => profile.id)).toEqual([
      "operator-review",
      "balanced-delegate",
      "autonomous-delegate",
    ]);
  });

  it("prefers the explicit task execution profile when present", () => {
    expect(
      resolveExecutionProfile(
        createTask({
          executionProfile: {
            id: "operator-review",
            name: "Operator Review",
            description: "Read-first execution.",
            executionMode: "single",
            autonomy: "operator_review",
            supervisionLabel: "Review each mutation before execution",
            accessMode: "read-only",
            routingStrategy: "workspace_default",
            toolPosture: "read_only",
            approvalSensitivity: "heightened",
            identitySource: "workspace-routing",
            validationPresetId: "review-first",
          },
        })
      )
    ).toMatchObject({
      id: "operator-review",
      executionMode: "local_interactive",
      validationPresetId: "review-first",
    });
  });

  it("falls back to the preferred profile id before inferring from task access", () => {
    expect(resolveExecutionProfile(createTask(), "autonomous-delegate").id).toBe(
      "autonomous-delegate"
    );
  });
});
