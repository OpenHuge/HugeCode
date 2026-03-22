import { describe, expect, it } from "vitest";
import type { AgentTaskSummary, HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import {
  buildReviewPackAssumptions,
  buildReviewPackBackendAudit,
  buildReviewPackEvidenceRefs,
  buildReviewPackFileChanges,
  buildReviewPackReproductionGuidance,
  buildReviewPackRollbackGuidance,
  deriveRunChangedPaths,
  deriveRunArtifacts,
  deriveRunCompletionReason,
  deriveRunWarnings,
} from "./runtimeMissionControlReviewPack";

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

const baseRun: HugeCodeRunSummary = {
  id: "run-1",
  taskId: "thread-1",
  workspaceId: "ws-1",
  state: "review_ready",
  title: "Investigate regression",
  summary: null,
  startedAt: 1,
  finishedAt: 2,
  updatedAt: 3,
  currentStepIndex: 0,
  approval: {
    status: "not_required",
    approvalId: null,
    label: "No pending approval",
    summary: "This run does not currently require an approval decision.",
  },
  reviewDecision: null,
  routing: {
    backendId: null,
    provider: "openai",
    providerLabel: "OpenAI",
    pool: "codex",
    routeLabel: "OpenAI / codex",
    routeHint: "Workspace route is ready.",
    health: "ready",
    enabledAccountCount: 1,
    readyAccountCount: 1,
    enabledPoolCount: 1,
  },
  executionProfile: {
    id: "autonomous-delegate",
    name: "Autonomous Delegate",
    description: "High-autonomy execution.",
    executionMode: "remote_sandbox",
    autonomy: "autonomous_delegate",
    supervisionLabel: "Checkpointed autonomy with targeted intervention",
    accessMode: "full-access",
    networkPolicy: "default",
    routingStrategy: "workspace_default",
    toolPosture: "workspace_extended",
    approvalSensitivity: "low_friction",
    identitySource: "workspace-routing",
    validationPresetId: "fast-lane",
  },
  profileReadiness: null,
  intervention: null,
  operatorState: null,
  nextAction: null,
  validations: [],
  warnings: [],
  artifacts: [],
  changedPaths: [],
  autoDrive: null,
  completionReason: null,
  reviewPackId: null,
  lineage: null,
  ledger: null,
  governance: null,
  placement: null,
};

describe("runtimeMissionControlReviewPack", () => {
  it("derives warnings and completion reason for recoverable interrupted runs", () => {
    const task = createTask({
      status: "interrupted",
      errorCode: "runtime_restart_recovery",
      errorMessage: "Transport dropped",
      steps: [
        {
          index: 0,
          kind: "diagnostics",
          role: "planner",
          status: "completed",
          message: "validate",
          runId: null,
          output: null,
          metadata: {},
          startedAt: 1,
          updatedAt: 1,
          completedAt: 1,
          errorCode: null,
          errorMessage: "Check 1 warning",
          approvalId: null,
        },
      ],
    });

    expect(deriveRunWarnings(task, "Routing warning")).toEqual([
      "Transport dropped",
      "Run was interrupted and can resume from a checkpoint.",
      "Routing warning",
      "Check 1 warning",
    ]);
    expect(deriveRunCompletionReason(task)).toBe("Transport dropped");
  });

  it("builds assumptions, reproduction guidance, rollback guidance, and backend audit", () => {
    expect(buildReviewPackAssumptions(baseRun, "incomplete_evidence")).toEqual([
      "Objective carried into review: Investigate regression.",
      'Review assumes the "Autonomous Delegate" execution profile guardrails were enforced during execution.',
      "Acceptance should be treated as provisional until missing evidence is re-collected or reviewed elsewhere.",
    ]);

    expect(
      buildReviewPackReproductionGuidance(
        [
          {
            id: "validation-1",
            label: "Check 1",
            outcome: "passed",
            summary: "pnpm validate:fast passed",
            startedAt: 1,
            finishedAt: 2,
          },
        ],
        [],
        [{ id: "artifact-1", label: "Diagnostics 1", kind: "validation", uri: "file:///tmp/log" }]
      )
    ).toEqual([
      "Re-run Check 1: pnpm validate:fast passed",
      "Inspect Diagnostics 1 at file:///tmp/log.",
    ]);

    expect(
      buildReviewPackRollbackGuidance({ ...baseRun, taskId: "thread-1" }, [
        { id: "diff-1", label: "Unified diff", kind: "diff" },
      ])
    ).toEqual([
      "Use Unified diff as the rollback reference before reverting affected files.",
      "Open the mission thread to retry, narrow scope, or reroute instead of making an untracked follow-up edit.",
    ]);

    expect(buildReviewPackBackendAudit(baseRun)).toEqual({
      summary: "OpenAI / codex",
      details: [
        "Provider: OpenAI",
        "Pool: codex",
        "Routing health: ready",
        "Ready accounts: 1/1",
        "Enabled pools: 1",
        "Workspace route is ready.",
      ],
      missingReason: null,
    });
  });

  it("derives changed paths and evidence refs from runtime-owned task data", () => {
    const task = createTask({
      traceId: "trace-1",
      checkpointId: "checkpoint-1",
      steps: [
        {
          index: 0,
          kind: "edit",
          role: "coder",
          status: "completed",
          message: "edit review surface",
          runId: null,
          output: null,
          metadata: {
            safety: {
              path: "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
            },
          },
          startedAt: 1,
          updatedAt: 2,
          completedAt: 3,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
        {
          index: 1,
          kind: "write",
          role: "coder",
          status: "completed",
          message: "write contract update",
          runId: null,
          output: null,
          metadata: {
            approval: {
              scopeKind: "file-target",
              scopeTarget: "packages/code-runtime-host-contract/src/hugeCodeMissionControl.ts",
            },
          },
          startedAt: 3,
          updatedAt: 4,
          completedAt: 5,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
        {
          index: 2,
          kind: "diagnostics",
          role: "verifier",
          status: "completed",
          message: "pnpm validate:fast",
          runId: null,
          output: null,
          metadata: {},
          startedAt: 5,
          updatedAt: 6,
          completedAt: 7,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
        {
          index: 3,
          kind: "bash",
          role: "verifier",
          status: "completed",
          message: "pnpm validate",
          runId: null,
          output: "ok",
          metadata: {},
          startedAt: 7,
          updatedAt: 8,
          completedAt: 9,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
      ],
    });

    expect(deriveRunChangedPaths(task)).toEqual([
      "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
      "packages/code-runtime-host-contract/src/hugeCodeMissionControl.ts",
    ]);
    expect(buildReviewPackFileChanges(deriveRunChangedPaths(task))).toMatchObject({
      totalCount: 2,
      summary: "2 runtime-recorded file changes",
      missingReason: null,
    });
    expect(
      buildReviewPackEvidenceRefs({
        ledger: {
          traceId: "trace-1",
          checkpointId: "checkpoint-1",
          recovered: false,
          stepCount: 3,
          completedStepCount: 3,
          warningCount: 0,
          validationCount: 1,
          artifactCount: 3,
          evidenceState: "confirmed",
          backendId: null,
          routeLabel: null,
          completionReason: "Run completed.",
          lastProgressAt: 7,
        },
        artifacts: deriveRunArtifacts(task),
      })
    ).toEqual({
      traceId: "trace-1",
      checkpointId: "checkpoint-1",
      diffArtifactIds: ["diff:task-1"],
      validationArtifactIds: ["task-1:artifact:2"],
      logArtifactIds: ["trace:trace-1"],
      commandArtifactIds: ["task-1:command:3"],
    });
  });

  it("publishes command artifacts from runtime-owned execution steps", () => {
    const task = createTask({
      steps: [
        {
          index: 0,
          kind: "bash",
          role: "verifier",
          status: "completed",
          message: "pnpm validate",
          runId: null,
          output: "ok",
          metadata: {},
          startedAt: 1,
          updatedAt: 2,
          completedAt: 3,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
      ],
    });

    expect(deriveRunArtifacts(task)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-1:command:0",
          label: "Command 1",
          kind: "command",
          uri: "command://task-1/0",
        }),
      ])
    );
  });
});
