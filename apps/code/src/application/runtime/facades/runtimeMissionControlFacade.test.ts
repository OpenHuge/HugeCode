import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import {
  buildMissionControlProjection,
  projectAgentTaskSummaryToRunSummary,
  projectAgentTaskStatusToRunState,
  projectCompletedRunToReviewPackSummary,
  projectRuntimeTaskToTaskSummary,
  resolveMissionControlSnapshot,
  resolveMissionTaskId,
  projectThreadSummaryToTaskSummary,
  projectWorkspaceSummaryToMissionWorkspace,
} from "./runtimeMissionControlFacade";

describe("runtimeMissionControlFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects workspace summaries into mission-control workspaces", () => {
    const workspace = {
      id: "ws-1",
      name: "Repo",
      rootPath: "C:/repo",
      connected: true,
      defaultProfileId: "gpt-5.3-codex",
    };

    expect(projectWorkspaceSummaryToMissionWorkspace(workspace)).toEqual({
      id: "ws-1",
      name: "Repo",
      rootPath: "C:/repo",
      connected: true,
      defaultProfileId: "gpt-5.3-codex",
    });
  });

  it("maps runtime task status into PRD run states", () => {
    expect(projectAgentTaskStatusToRunState("queued")).toBe("queued");
    expect(projectAgentTaskStatusToRunState("awaiting_approval")).toBe("needs_input");
    expect(projectAgentTaskStatusToRunState("completed")).toBe("review_ready");
    expect(projectAgentTaskStatusToRunState("interrupted")).toBe("cancelled");
  });
  it("preserves operator-review execution profiles as local interactive runs", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "run-profile-1",
      workspaceId: "ws-1",
      threadId: null,
      requestId: null,
      title: "Inspect runtime profile projection",
      status: "completed",
      accessMode: "read-only",
      executionMode: "single",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: null,
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 5,
      startedAt: 2,
      completedAt: 6,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
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
        validationPresetId: null,
      },
      steps: [],
    } satisfies AgentTaskSummary);

    expect(run.executionProfile?.executionMode).toBe("local_interactive");
    expect(run.executionProfile?.id).toBe("operator-review");
    expect(run.executionProfile?.autonomy).toBe("operator_review");
  });

  it("projects thread summaries into task summaries", () => {
    const thread = {
      id: "thread-1",
      workspaceId: "ws-1",
      title: "Fix flaky test",
      updatedAt: 2,
      latestRunState: "running" as const,
    };

    expect(projectThreadSummaryToTaskSummary(thread)).toEqual({
      id: "thread-1",
      workspaceId: "ws-1",
      title: "Fix flaky test",
      objective: "Fix flaky test",
      taskSource: {
        kind: "manual_thread",
        label: "Manual thread",
        title: "Fix flaky test",
        externalId: null,
        canonicalUrl: null,
        threadId: "thread-1",
        requestId: null,
        sourceTaskId: null,
        sourceRunId: null,
      },
      origin: {
        kind: "thread",
        threadId: "thread-1",
        runId: null,
        requestId: null,
      },
      mode: null,
      modeSource: "missing",
      status: "running",
      createdAt: 2,
      updatedAt: 2,
      currentRunId: null,
      latestRunId: null,
      latestRunState: "running",
      nextAction: null,
      lineage: {
        objective: "Fix flaky test",
        desiredEndState: [],
        hardBoundaries: [],
        doneDefinition: null,
        riskPolicy: null,
        taskMode: null,
        executionProfileId: null,
        taskSource: {
          kind: "manual_thread",
          label: "Manual thread",
          title: "Fix flaky test",
          externalId: null,
          canonicalUrl: null,
          threadId: "thread-1",
          requestId: null,
          sourceTaskId: null,
          sourceRunId: null,
          githubSource: null,
        },
        threadId: "thread-1",
        requestId: null,
        rootTaskId: null,
        parentTaskId: null,
        childTaskIds: [],
        reviewDecisionState: null,
        reviewDecisionSummary: null,
      },
    });
  });

  it("preserves canonical task source while keeping origin as a compatibility projection", () => {
    const task = {
      taskId: "runtime-task-42",
      workspaceId: "ws-1",
      threadId: "thread-42",
      requestId: "request-42",
      title: "Project task source into mission control",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 6,
      startedAt: 2,
      completedAt: 6,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      taskSource: {
        kind: "github_issue" as const,
        label: "GitHub issue #42",
        title: "Project task source into mission control",
        externalId: "openai/hugecode#42",
        canonicalUrl: "https://github.com/openai/hugecode/issues/42",
        threadId: "thread-42",
        requestId: "request-42",
        sourceTaskId: "source-task-42",
        sourceRunId: "source-run-42",
        githubSource: null,
      },
      steps: [],
    } satisfies AgentTaskSummary;

    const run = projectAgentTaskSummaryToRunSummary(task);
    const projectedTask = projectRuntimeTaskToTaskSummary(task);
    const reviewPack = projectCompletedRunToReviewPackSummary(run);

    expect(run.taskSource).toEqual(task.taskSource);
    expect(projectedTask.taskSource).toEqual(task.taskSource);
    expect(projectedTask.origin).toEqual({
      kind: "run",
      threadId: "thread-42",
      runId: "runtime-task-42",
      requestId: "request-42",
    });
    expect(projectedTask.lineage?.taskSource).toEqual(task.taskSource);
    expect(reviewPack?.taskSource).toEqual(task.taskSource);
    expect(reviewPack?.lineage?.taskSource).toEqual(task.taskSource);
  });

  it("projects runtime execution graph into run and task summaries", () => {
    const task = {
      taskId: "runtime-task-graph-1",
      workspaceId: "ws-1",
      threadId: "thread-graph-1",
      requestId: "request-graph-1",
      title: "Project execution graph",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 6,
      startedAt: 2,
      completedAt: 6,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      executionGraph: {
        graphId: "graph-runtime-task-graph-1",
        nodes: [
          {
            id: "graph-runtime-task-graph-1:root",
            kind: "plan",
            status: "completed",
            executorKind: "sub_agent",
            executorSessionId: "session-1",
            preferredBackendIds: ["backend-primary"],
            resolvedBackendId: "backend-primary",
            placementLifecycleState: "confirmed",
            placementResolutionSource: "explicit_preference",
            checkpoint: {
              state: "completed",
              lifecycleState: "completed",
              checkpointId: "checkpoint-graph-1",
              traceId: "trace-graph-1",
              recovered: false,
              updatedAt: 6,
              resumeReady: false,
              summary: "Checkpoint captured in execution graph.",
            },
            reviewActionability: {
              state: "ready",
              summary: "Review is ready from execution graph truth.",
              degradedReasons: [],
              actions: [],
            },
          },
        ],
        edges: [],
      },
      steps: [],
    } satisfies AgentTaskSummary;

    const run = projectAgentTaskSummaryToRunSummary(task);
    const projectedTask = projectRuntimeTaskToTaskSummary(task);

    expect(run.executionGraph?.graphId).toBe("graph-runtime-task-graph-1");
    expect(run.executionGraph?.nodes[0]).toMatchObject({
      id: "graph-runtime-task-graph-1:root",
      executorKind: "sub_agent",
      executorSessionId: "session-1",
      resolvedBackendId: "backend-primary",
    });
    expect(run.executionGraph?.nodes[0]?.checkpoint).toMatchObject({
      checkpointId: "checkpoint-graph-1",
      traceId: "trace-graph-1",
    });
    expect(projectedTask.executionGraph).toEqual(run.executionGraph);
  });

  it("degrades unknown task source kinds to external_runtime in app projections", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "runtime-task-unknown-source",
      workspaceId: "ws-1",
      threadId: null,
      requestId: null,
      title: "Handle future task source kinds",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 6,
      startedAt: 2,
      completedAt: 6,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      taskSource: {
        kind: "future_adapter",
        label: "Future Adapter",
        sourceTaskId: "future-task-1",
      } as never,
      steps: [],
    } satisfies AgentTaskSummary);

    expect(run.taskSource).toMatchObject({
      kind: "external_runtime",
      label: "Future Adapter",
      sourceTaskId: "future-task-1",
    });
  });

  it("creates review-pack summaries only for review-ready runs", () => {
    expect(
      projectCompletedRunToReviewPackSummary({
        id: "run-1",
        taskId: "task-1",
        workspaceId: "ws-1",
        state: "running",
        title: "Task in progress",
        summary: null,
        startedAt: 1,
        finishedAt: null,
        updatedAt: 2,
        currentStepIndex: 0,
      })
    ).toBeNull();
  });

  it("projects operator snapshot, workspace evidence, and accountability lifecycle from runtime truth", () => {
    const task = {
      taskId: "run-operator-1",
      workspaceId: "ws-1",
      threadId: "thread-operator-1",
      requestId: null,
      title: "Inspect operator snapshot",
      status: "completed",
      accessMode: "full-access",
      executionMode: "distributed",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      reasonEffort: "high",
      currentStep: 2,
      createdAt: 10,
      updatedAt: 40,
      startedAt: 12,
      completedAt: 42,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      backendId: "backend-review-a",
      missionBrief: {
        objective: "Inspect operator snapshot",
        doneDefinition: ["Publish runtime-owned operator view"],
      },
      autoDrive: {
        enabled: true,
        destination: {
          title: "Inspect operator snapshot",
          desiredEndState: ["Operator view ready"],
        },
        navigation: {
          activeWaypoint: "Publish operator view",
          completedWaypoints: ["Collect runtime evidence"],
          pendingWaypoints: ["Publish operator view"],
          lastProgressAt: 39,
        },
      },
      steps: [
        {
          index: 0,
          kind: "read",
          role: "planner",
          status: "completed",
          message: "Collect runtime evidence",
          runId: null,
          output: null,
          metadata: {},
          startedAt: 12,
          updatedAt: 15,
          completedAt: 16,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
        {
          index: 1,
          kind: "edit",
          role: "coder",
          status: "completed",
          message: "Patch review surface",
          runId: null,
          output: null,
          metadata: {
            safety: {
              path: "apps/code/src/features/review/components/ReviewPackSurface.tsx",
            },
          },
          startedAt: 20,
          updatedAt: 28,
          completedAt: 29,
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
          output: "passed",
          metadata: {},
          startedAt: 30,
          updatedAt: 39,
          completedAt: 40,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
      ],
    } satisfies AgentTaskSummary;
    const run = projectAgentTaskSummaryToRunSummary(task);

    expect(run).toMatchObject({
      operatorSnapshot: {
        modelId: "gpt-5.3-codex",
        reasoningEffort: "high",
        backendId: "backend-review-a",
        currentActivity: "pnpm validate:fast",
      },
      workspaceEvidence: {
        buckets: expect.arrayContaining([
          expect.objectContaining({
            kind: "changedFiles",
            items: [
              expect.objectContaining({
                label: "apps/code/src/features/review/components/ReviewPackSurface.tsx",
              }),
            ],
          }),
          expect.objectContaining({
            kind: "memoryOrNotes",
          }),
        ]),
      },
    });

    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Repo",
          rootPath: "/tmp/repo",
          connected: true,
          defaultProfileId: null,
        },
      ],
      threads: [
        {
          id: "thread-operator-1",
          workspaceId: "ws-1",
          title: "Inspect operator snapshot",
          updatedAt: 42,
        },
      ],
      runtimeTasks: [task],
    });

    expect(projection.tasks[0]).toMatchObject({
      accountability: {
        lifecycle: "in_review",
        claimedBy: "local-operator",
      },
    });

    expect(projectCompletedRunToReviewPackSummary(run)).toMatchObject({
      workspaceEvidence: {
        buckets: expect.arrayContaining([
          expect.objectContaining({ kind: "changedFiles" }),
          expect.objectContaining({ kind: "diffs" }),
          expect.objectContaining({ kind: "memoryOrNotes" }),
        ]),
      },
    });
  });

  it("projects auto-drive publish handoff into local fallback runs and review packs", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "run-publish-1",
      workspaceId: "ws-1",
      threadId: null,
      requestId: null,
      title: "Ship publish handoff",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 12,
      startedAt: 2,
      completedAt: 12,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      reviewPackId: "review-pack:run-publish-1",
      publishHandoff: {
        jsonPath: ".hugecode/runs/run-publish-1/publish/handoff.json",
        markdownPath: ".hugecode/runs/run-publish-1/publish/handoff.md",
        reason: "completed",
        summary: "AutoDrive prepared publish handoff.",
        at: 12,
        branchName: "autodrive/ship-flow-202603151010-run123",
        reviewTitle: "Ship AutoDrive publish flow",
      } as never,
      autoDrive: {
        enabled: true,
        destination: {
          title: "Ship publish handoff",
          desiredEndState: ["Prepare review branch"],
        },
        stop: {
          reason: "completed",
          summary: "AutoDrive prepared publish handoff.",
          at: 12,
        },
      },
      steps: [],
    } satisfies AgentTaskSummary);

    expect(run.publishHandoff).toEqual({
      jsonPath: ".hugecode/runs/run-publish-1/publish/handoff.json",
      markdownPath: ".hugecode/runs/run-publish-1/publish/handoff.md",
      reason: "completed",
      summary: "AutoDrive prepared publish handoff.",
      at: 12,
      branchName: "autodrive/ship-flow-202603151010-run123",
      reviewTitle: "Ship AutoDrive publish flow",
    });
    expect(run.reviewPackId).toBe("review-pack:run-publish-1");
    expect(projectCompletedRunToReviewPackSummary(run)?.publishHandoff).toEqual(run.publishHandoff);
  });

  it("projects mission linkage and review actionability into runs and review packs", () => {
    const task = {
      taskId: "run-linkage-1",
      workspaceId: "ws-1",
      threadId: "thread-linkage-1",
      requestId: "request-linkage-1",
      title: "Project runtime continuity truth",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 5,
      startedAt: 2,
      completedAt: 6,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      reviewPackId: "review-pack:run-linkage-1",
      missionLinkage: {
        workspaceId: "ws-1",
        taskId: "run-linkage-1",
        runId: "run-linkage-1",
        reviewPackId: "review-pack:run-linkage-1",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        threadId: "thread-linkage-1",
        requestId: "request-linkage-1",
        missionTaskId: "runtime-task:run-linkage-1",
        taskEntityKind: "thread",
        recoveryPath: "thread",
        navigationTarget: {
          kind: "thread",
          workspaceId: "ws-1",
          threadId: "thread-linkage-1",
        },
        summary: "Resume from thread-linkage-1 on another control device.",
      },
      reviewActionability: {
        state: "degraded",
        summary: "Review can continue, but runtime evidence is incomplete.",
        degradedReasons: ["runtime_evidence_incomplete"],
        actions: [
          {
            action: "retry",
            enabled: true,
            supported: true,
            reason: null,
          },
        ],
      },
      steps: [],
    } satisfies AgentTaskSummary;

    const run = projectAgentTaskSummaryToRunSummary(task);
    const reviewPack = projectCompletedRunToReviewPackSummary(run);

    expect(run.missionLinkage?.recoveryPath).toBe("thread");
    expect(run.missionLinkage?.navigationTarget.kind).toBe("thread");
    expect(run.actionability?.state).toBe("degraded");
    expect(run.actionability?.summary).toContain("runtime evidence");
    expect(reviewPack?.missionLinkage).toEqual(run.missionLinkage);
    expect(reviewPack?.actionability).toEqual(run.actionability);
  });

  it("marks review-pack evidence as explicit-but-unvalidated when runtime has no validation result", () => {
    expect(
      projectCompletedRunToReviewPackSummary(
        projectAgentTaskSummaryToRunSummary({
          taskId: "run-1",
          workspaceId: "ws-1",
          threadId: null,
          requestId: null,
          title: "Draft fix",
          status: "completed",
          accessMode: "full-access",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          routedProvider: "openai",
          routedModelId: "gpt-5.3-codex",
          routedPool: "codex",
          routedSource: "workspace-default",
          currentStep: 1,
          createdAt: 1,
          updatedAt: 20,
          startedAt: 2,
          completedAt: 30,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [
            {
              index: 0,
              kind: "read",
              role: "planner",
              status: "completed",
              message: "Collected runtime evidence",
              runId: null,
              output: null,
              metadata: {},
              startedAt: 2,
              updatedAt: 20,
              completedAt: 30,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
        })
      )
    ).toMatchObject({
      taskId: resolveMissionTaskId("run-1", null),
      validationOutcome: "unknown",
      recommendedNextAction: "The run finished and is ready for operator review.",
    });
  });

  it("includes changed file and evidence references in projected review packs", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "run-1",
      workspaceId: "ws-1",
      threadId: "thread-1",
      requestId: null,
      title: "Stabilize runtime-owned review pack",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 2,
      createdAt: 1,
      updatedAt: 10,
      startedAt: 2,
      completedAt: 10,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
      steps: [
        {
          index: 0,
          kind: "edit",
          role: "coder",
          status: "completed",
          message: "Patch runtime review pack projection",
          runId: null,
          output: null,
          metadata: {
            safety: {
              path: "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
            },
          },
          startedAt: 2,
          updatedAt: 3,
          completedAt: 4,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
        {
          index: 1,
          kind: "write",
          role: "coder",
          status: "completed",
          message: "Add runtime contract coverage",
          runId: null,
          output: null,
          metadata: {
            approval: {
              scopeKind: "file-target",
              scopeTarget: "packages/code-runtime-host-contract/src/hugeCodeMissionControl.ts",
            },
          },
          startedAt: 4,
          updatedAt: 5,
          completedAt: 6,
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
          output: "passed",
          metadata: {},
          startedAt: 6,
          updatedAt: 9,
          completedAt: 10,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
      ],
    } satisfies AgentTaskSummary);

    const reviewPack = projectCompletedRunToReviewPackSummary(run) as Record<string, unknown>;

    expect(reviewPack).toMatchObject({
      fileChanges: {
        totalCount: 2,
        summary: "2 runtime-recorded file changes",
        paths: [
          "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
          "packages/code-runtime-host-contract/src/hugeCodeMissionControl.ts",
        ],
      },
      evidenceRefs: {
        traceId: "trace-1",
        checkpointId: "checkpoint-1",
        diffArtifactIds: ["diff:run-1"],
        validationArtifactIds: ["run-1:artifact:2"],
        logArtifactIds: ["trace:trace-1"],
      },
    });
  });

  it("respects runtime-owned evidence state when review evidence is still incomplete", () => {
    const reviewPack = projectCompletedRunToReviewPackSummary({
      id: "run-1",
      taskId: "task-1",
      workspaceId: "ws-1",
      state: "review_ready",
      title: "Review runtime evidence",
      summary: "Waiting on more runtime-owned evidence.",
      startedAt: 1,
      finishedAt: 2,
      updatedAt: 3,
      currentStepIndex: 0,
      warnings: [],
      validations: [
        {
          id: "validation-1",
          label: "Check 1",
          outcome: "passed",
          summary: "Validation passed.",
        },
      ],
      artifacts: [
        {
          id: "diff:run-1",
          label: "Workspace diff",
          kind: "diff",
          uri: "mission-control://runs/run-1/diff",
        },
      ],
      changedPaths: ["apps/code/src/application/runtime/facades/runtimeMissionControlFacade.ts"],
      reviewPackId: "review-pack:run-1",
      ledger: {
        traceId: "trace-1",
        checkpointId: null,
        recovered: false,
        stepCount: 1,
        completedStepCount: 1,
        warningCount: 0,
        validationCount: 1,
        artifactCount: 1,
        evidenceState: "incomplete",
        backendId: null,
        routeLabel: null,
        completionReason: "More evidence is still being collected.",
        lastProgressAt: 3,
      },
    });

    expect(reviewPack?.evidenceState).toBe("incomplete");
    expect(reviewPack?.reviewStatus).toBe("incomplete_evidence");
  });

  it("does not synthesize backend linkage when runtime routing summary omits backendId", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "run-routing-1",
      workspaceId: "ws-1",
      threadId: "thread-routing-1",
      requestId: null,
      title: "Validate remote backend linkage",
      status: "completed",
      accessMode: "full-access",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 20,
      startedAt: 2,
      completedAt: 10,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      backendId: "backend-remote-a",
      routing: {
        provider: "openai",
        providerLabel: "OpenAI",
        pool: "codex",
        routeLabel: "OpenAI / codex",
        routeHint: "Workspace route is ready.",
        health: "ready",
        enabledAccountCount: 2,
        readyAccountCount: 2,
        enabledPoolCount: 1,
      },
      steps: [],
    });

    expect(run.routing).toMatchObject({
      backendId: null,
      routeLabel: "OpenAI / codex",
      provider: "openai",
    });
  });

  it("projects terminal review decisions into review-pack summaries and follow-up guidance", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "run-2",
      workspaceId: "ws-1",
      threadId: "thread-2",
      requestId: null,
      title: "Tighten review action handling",
      status: "completed",
      accessMode: "on-request",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 1,
      createdAt: 1,
      updatedAt: 40,
      startedAt: 2,
      completedAt: 35,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      reviewDecision: {
        status: "rejected",
        reviewPackId: "review-pack:run-2",
        label: "Rejected in review",
        summary: "Validation warnings still need a narrower rerun.",
        decidedAt: 40,
      },
      steps: [
        {
          index: 0,
          kind: "read",
          role: "planner",
          status: "completed",
          message: "Collected evidence",
          runId: null,
          output: null,
          metadata: {},
          startedAt: 2,
          updatedAt: 20,
          completedAt: 25,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
      ],
    });

    expect(run.reviewDecision).toMatchObject({
      status: "rejected",
      reviewPackId: "review-pack:run-2",
      summary: "Validation warnings still need a narrower rerun.",
    });
    expect(run.nextAction).toMatchObject({
      label: "Review rejected",
      action: "review",
      detail: "Validation warnings still need a narrower rerun.",
    });

    expect(projectCompletedRunToReviewPackSummary(run)).toMatchObject({
      id: "review-pack:run-2",
      reviewStatus: "action_required",
      reviewDecision: {
        status: "rejected",
        reviewPackId: "review-pack:run-2",
      },
      recommendedNextAction: "Validation warnings still need a narrower rerun.",
    });
  });

  it("builds a unified mission-control projection", () => {
    const workspaces = [
      {
        id: "ws-1",
        name: "Repo",
        rootPath: "C:/repo",
        connected: true,
        defaultProfileId: "gpt-5.3-codex",
      },
    ];
    const threads = [
      {
        id: "thread-1",
        workspaceId: "ws-1",
        title: "Investigate regression",
        updatedAt: 10,
      },
    ];
    const runtimeTasks: AgentTaskSummary[] = [
      {
        taskId: "run-1",
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: null,
        title: "Investigate regression",
        status: "completed",
        accessMode: "full-access",
        provider: "openai",
        modelId: "gpt-5.3-codex",
        routedProvider: "openai",
        routedModelId: "gpt-5.3-codex",
        routedPool: "codex",
        routedSource: "workspace-default",
        currentStep: 1,
        createdAt: 1,
        updatedAt: 20,
        startedAt: 2,
        completedAt: 30,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        steps: [
          {
            index: 0,
            kind: "read",
            role: "planner",
            status: "completed",
            message: "Collected evidence",
            runId: null,
            output: null,
            metadata: {},
            startedAt: 2,
            updatedAt: 20,
            completedAt: 30,
            errorCode: null,
            errorMessage: null,
            approvalId: null,
          },
        ],
      },
    ];

    const projection = buildMissionControlProjection({
      workspaces,
      threads,
      runtimeTasks,
    });

    expect(projection.source).toBe("runtime_snapshot_v1");
    expect(projection.tasks).toEqual([
      {
        id: "thread-1",
        workspaceId: "ws-1",
        title: "Investigate regression",
        objective: "Investigate regression",
        origin: {
          kind: "thread",
          threadId: "thread-1",
          runId: "run-1",
          requestId: null,
        },
        taskSource: {
          kind: "manual_thread",
          label: "Manual thread",
          title: "Investigate regression",
          externalId: null,
          canonicalUrl: null,
          threadId: "thread-1",
          requestId: null,
          sourceTaskId: null,
          sourceRunId: null,
        },
        mode: "delegate",
        modeSource: "execution_profile",
        status: "review_ready",
        createdAt: 10,
        updatedAt: 20,
        currentRunId: null,
        latestRunId: "run-1",
        latestRunState: "review_ready",
        nextAction: {
          action: "review",
          detail: "The run finished and is ready for operator review.",
          label: "Review the result",
        },
        lineage: {
          objective: "Investigate regression",
          desiredEndState: [],
          hardBoundaries: [],
          doneDefinition: null,
          riskPolicy: null,
          taskMode: "delegate",
          executionProfileId: "autonomous-delegate",
          taskSource: {
            kind: "manual_thread",
            label: "Manual thread",
            title: "Investigate regression",
            externalId: null,
            canonicalUrl: null,
            threadId: "thread-1",
            requestId: null,
            sourceTaskId: null,
            sourceRunId: null,
            githubSource: null,
          },
          threadId: "thread-1",
          requestId: null,
          rootTaskId: null,
          parentTaskId: null,
          childTaskIds: [],
          reviewDecisionState: "pending",
          reviewDecisionSummary: "Accept or reject this result from the review surface.",
        },
        accountability: {
          lifecycle: "in_review",
          claimedBy: "local-operator",
          claimedAt: 10,
          lifecycleUpdatedAt: 30,
        },
      },
    ]);
    expect(projection.runs[0]?.state).toBe("review_ready");
    expect(projection.runs[0]?.executionProfile?.id).toBe("autonomous-delegate");
    expect(projection.runs[0]?.routing?.routeLabel).toBe("openai");
    expect(projection.runs[0]?.routing?.backendId).toBeNull();
    expect(projection.runs[0]?.approval?.status).toBe("not_required");
    expect(projection.runs[0]?.nextAction?.action).toBe("review");
    expect(projection.runs[0]?.governance).toMatchObject({
      state: "awaiting_review",
      blocking: true,
      suggestedAction: "review_result",
    });
    expect(projection.runs[0]?.lineage).toMatchObject({
      objective: "Investigate regression",
      threadId: "thread-1",
      requestId: null,
      executionProfileId: "autonomous-delegate",
      taskMode: "delegate",
      reviewDecisionState: "pending",
    });
    expect(projection.runs[0]?.ledger).toMatchObject({
      traceId: null,
      checkpointId: null,
      recovered: false,
      stepCount: 1,
      completedStepCount: 1,
      warningCount: 1,
      validationCount: 0,
      artifactCount: 1,
      evidenceState: "confirmed",
      backendId: null,
      routeLabel: "openai",
      completionReason: "Run completed.",
    });
    expect(projection.reviewPacks[0]?.runId).toBe("run-1");
    expect(projection.reviewPacks[0]?.validationOutcome).toBe("unknown");
    expect(projection.reviewPacks[0]?.warnings).toEqual([
      "Runtime routed provider openai is not present in the current provider catalog.",
    ]);
    expect(projection.reviewPacks[0]?.lineage).toMatchObject({
      objective: "Investigate regression",
      threadId: "thread-1",
      executionProfileId: "autonomous-delegate",
      reviewDecisionState: "pending",
    });
    expect(projection.reviewPacks[0]?.governance).toMatchObject({
      state: "awaiting_review",
      blocking: true,
      suggestedAction: "review_result",
    });
    expect(projection.reviewPacks[0]?.ledger).toMatchObject({
      stepCount: 1,
      completedStepCount: 1,
      warningCount: 1,
      validationCount: 0,
      artifactCount: 1,
      evidenceState: "confirmed",
      routeLabel: "openai",
    });
    expect(projection.reviewPacks[0]?.assumptions).toEqual([
      "Objective carried into review: Investigate regression.",
      'Review assumes the "Autonomous Delegate" execution profile guardrails were enforced during execution.',
    ]);
    expect(projection.reviewPacks[0]?.backendAudit).toEqual({
      summary: "openai",
      details: [
        "Provider: openai",
        "Pool: codex",
        "Routing health: attention",
        "Ready accounts: 0/0",
        "Enabled pools: 0",
        "Runtime routed provider openai is not present in the current provider catalog.",
      ],
      missingReason: null,
    });
  });

  it("projects native review-pack context and backend linkage from runtime task data", () => {
    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Repo",
          rootPath: "C:/repo",
          connected: true,
          defaultProfileId: "balanced-delegate",
        },
      ],
      threads: [
        {
          id: "thread-1",
          workspaceId: "ws-1",
          title: "Retry review task",
          updatedAt: 10,
        },
      ],
      runtimeTasks: [
        {
          taskId: "run-2",
          workspaceId: "ws-1",
          threadId: "thread-1",
          requestId: null,
          title: "Retry review task",
          status: "completed",
          accessMode: "on-request",
          executionMode: "single",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          routedProvider: "openai",
          routedModelId: "gpt-5.3-codex",
          routedPool: "pool-review",
          routedSource: "workspace-default",
          currentStep: 0,
          createdAt: 1,
          updatedAt: 30,
          startedAt: 2,
          completedAt: 25,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          backendId: "backend-review-a",
          steps: [
            {
              index: 0,
              kind: "diagnostics",
              role: "verifier",
              status: "completed",
              message: "pnpm validate:fast",
              runId: null,
              output: "pnpm validate:fast passed",
              metadata: {},
              startedAt: 2,
              updatedAt: 20,
              completedAt: 25,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
        },
      ],
      routingContext: {
        backends: [
          {
            backendId: "backend-review-a",
            state: "enabled",
            status: "active",
            healthy: true,
            queueDepth: 0,
            capacity: 4,
            inFlight: 1,
            placementFailuresTotal: 0,
            tcpOverlay: null,
            contract: {
              kind: "native",
              origin: "runtime-native",
              transport: null,
              capabilityCount: 3,
              health: "active",
              rolloutState: "current",
            },
          },
        ],
      },
    });

    expect(projection.runs[0]?.routing).toMatchObject({
      backendId: null,
      routeLabel: "openai",
    });
    expect(projection.runs[0]?.ledger).toMatchObject({
      stepCount: 1,
      completedStepCount: 1,
      validationCount: 1,
      artifactCount: 2,
      evidenceState: "confirmed",
      backendId: "backend-review-a",
      routeLabel: "openai",
    });
    expect(projection.runs[0]?.lineage).toMatchObject({
      objective: "Retry review task",
      threadId: "thread-1",
      executionProfileId: "balanced-delegate",
      taskMode: "pair",
      reviewDecisionState: "pending",
    });
    expect(projection.runs[0]?.governance).toMatchObject({
      state: "awaiting_review",
      blocking: true,
    });
    expect(projection.runs[0]?.placement).toBeNull();
    expect(projection.reviewPacks[0]).toMatchObject({
      governance: {
        state: "awaiting_review",
        blocking: true,
      },
      placement: null,
      lineage: {
        objective: "Retry review task",
        threadId: "thread-1",
        executionProfileId: "balanced-delegate",
        reviewDecisionState: "pending",
      },
      ledger: {
        validationCount: 1,
        artifactCount: 2,
        backendId: "backend-review-a",
        routeLabel: "openai",
      },
      assumptions: expect.arrayContaining(["Objective carried into review: Retry review task."]),
      reproductionGuidance: expect.arrayContaining([
        "Re-run Check 1: pnpm validate:fast passed",
        "Inspect Trace run-2 at trace://run-2.",
        "Inspect Diagnostics 1 at validation://run-2/0.",
      ]),
      rollbackGuidance: [
        "Open the mission thread to retry, narrow scope, or reroute instead of making an untracked follow-up edit.",
      ],
      backendAudit: {
        summary: "openai",
        details: expect.arrayContaining([
          "Provider: openai",
          "Pool: pool-review",
          "Routing health: attention",
        ]),
        missingReason: null,
      },
    });
  });

  it("does not synthesize placement evidence from fallback-shaped task fields", () => {
    const run = projectAgentTaskSummaryToRunSummary(
      {
        taskId: "run-placement-1",
        workspaceId: "ws-1",
        threadId: "thread-placement-1",
        requestId: null,
        title: "Verify backend fallback evidence",
        status: "completed",
        accessMode: "full-access",
        executionMode: "distributed",
        provider: "openai",
        modelId: "gpt-5.3-codex",
        routedProvider: "openai",
        routedModelId: "gpt-5.3-codex",
        routedPool: "codex",
        routedSource: "workspace-default",
        currentStep: 0,
        createdAt: 1,
        updatedAt: 20,
        startedAt: 2,
        completedAt: 15,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        backendId: "backend-review-b",
        preferredBackendIds: ["backend-review-a"],
        steps: [],
      },
      {
        taskId: "thread-placement-1",
        routingContext: {
          backends: [
            {
              backendId: "backend-review-b",
              state: "enabled",
              status: "active",
              healthy: true,
              queueDepth: 0,
              capacity: 6,
              inFlight: 1,
              placementFailuresTotal: 0,
              tcpOverlay: null,
              contract: {
                kind: "acp",
                origin: "acp-projection",
                transport: "http",
                capabilityCount: 6,
                health: "active",
                rolloutState: "current",
              },
            },
          ],
        },
      }
    );

    expect(run.placement).toBeNull();
  });

  it("does not synthesize placement evidence from backend health snapshots", () => {
    const run = projectAgentTaskSummaryToRunSummary(
      {
        taskId: "run-placement-2",
        workspaceId: "ws-1",
        threadId: "thread-placement-2",
        requestId: null,
        title: "Verify backend pressure evidence",
        status: "running",
        accessMode: "full-access",
        executionMode: "distributed",
        provider: "openai",
        modelId: "gpt-5.3-codex",
        routedProvider: "openai",
        routedModelId: "gpt-5.3-codex",
        routedPool: "codex",
        routedSource: "workspace-default",
        currentStep: 0,
        createdAt: 1,
        updatedAt: 20,
        startedAt: 2,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        backendId: "backend-review-c",
        preferredBackendIds: [],
        steps: [],
      },
      {
        taskId: "thread-placement-2",
        routingContext: {
          backends: [
            {
              backendId: "backend-review-c",
              state: "degraded",
              healthy: false,
              queueDepth: 4,
              capacity: 2,
              inFlight: 2,
              placementFailuresTotal: 3,
              tcpOverlay: "netbird",
              contract: {
                kind: "acp",
                origin: "acp-projection",
                transport: "http",
                capabilityCount: 6,
                health: "draining",
                rolloutState: "draining",
              },
            },
          ],
        },
      }
    );

    expect(run.placement).toBeNull();
  });

  it("passes through runtime-published placement evidence without frontend synthesis", () => {
    const run = projectAgentTaskSummaryToRunSummary({
      taskId: "run-placement-runtime-1",
      workspaceId: "ws-1",
      threadId: "thread-placement-runtime-1",
      requestId: null,
      title: "Use runtime placement truth",
      status: "running",
      accessMode: "full-access",
      executionMode: "distributed",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "workspace-default",
      currentStep: 0,
      createdAt: 1,
      updatedAt: 20,
      startedAt: 2,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      backendId: "backend-task-level",
      preferredBackendIds: ["backend-request-a"],
      runSummary: {
        id: "run-placement-runtime-1",
        taskId: "runtime:run-placement-runtime-1",
        workspaceId: "ws-1",
        state: "running",
        title: "Use runtime placement truth",
        summary: "Runtime is executing.",
        startedAt: 2,
        finishedAt: null,
        updatedAt: 20,
        currentStepIndex: 0,
        placement: {
          resolvedBackendId: "backend-runtime-confirmed",
          requestedBackendIds: ["backend-request-runtime"],
          resolutionSource: "runtime_fallback",
          lifecycleState: "fallback",
          readiness: "attention",
          healthSummary: "placement_attention",
          attentionReasons: ["backend_failures_detected"],
          summary: "Runtime confirmed fallback placement on backend-runtime-confirmed.",
          rationale: "Runtime moved execution after backend-review pressure.",
          backendContract: {
            kind: "acp",
            origin: "acp-projection",
            transport: "http",
            capabilityCount: 6,
            health: "draining",
            rolloutState: "current",
          },
        },
      } as AgentTaskSummary["runSummary"],
      steps: [],
    });

    expect(run.placement).toMatchObject({
      resolvedBackendId: "backend-runtime-confirmed",
      requestedBackendIds: ["backend-request-runtime"],
      resolutionSource: "runtime_fallback",
      lifecycleState: "fallback",
      readiness: "attention",
      healthSummary: "placement_attention",
      attentionReasons: ["backend_failures_detected"],
      summary: "Runtime confirmed fallback placement on backend-runtime-confirmed.",
      rationale: "Runtime moved execution after backend-review pressure.",
      backendContract: {
        kind: "acp",
        origin: "acp-projection",
        transport: "http",
        health: "draining",
      },
    });
  });

  it("surfaces runtime-managed tasks without thread ids as first-class mission entities", () => {
    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Repo",
          rootPath: "C:/repo",
          connected: true,
          defaultProfileId: "gpt-5.3-codex",
        },
      ],
      threads: [],
      runtimeTasks: [
        {
          taskId: "runtime-7",
          workspaceId: "ws-1",
          threadId: null,
          requestId: null,
          title: "Prepare release notes",
          status: "completed",
          accessMode: "full-access",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          routedProvider: "openai",
          routedModelId: "gpt-5.3-codex",
          routedPool: "codex",
          routedSource: "workspace-default",
          currentStep: 0,
          createdAt: 5,
          updatedAt: 10,
          startedAt: 6,
          completedAt: 12,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [
            {
              index: 0,
              kind: "read",
              role: "planner",
              status: "completed",
              message: "Review pack is ready",
              runId: null,
              output: null,
              metadata: {},
              startedAt: 6,
              updatedAt: 10,
              completedAt: 12,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
        },
      ],
    });

    expect(projection.source).toBe("runtime_snapshot_v1");
    expect(projection.tasks).toEqual([
      {
        id: "runtime-task:runtime-7",
        workspaceId: "ws-1",
        title: "Prepare release notes",
        objective: "Prepare release notes",
        origin: {
          kind: "run",
          threadId: null,
          runId: "runtime-7",
          requestId: null,
        },
        taskSource: {
          kind: "external_runtime",
          label: "External runtime",
          title: "Prepare release notes",
          externalId: null,
          canonicalUrl: null,
          threadId: null,
          requestId: null,
          sourceTaskId: "runtime-7",
          sourceRunId: "runtime-7",
          githubSource: null,
        },
        mode: "delegate",
        modeSource: "execution_profile",
        status: "review_ready",
        createdAt: 5,
        updatedAt: 10,
        currentRunId: null,
        latestRunId: "runtime-7",
        latestRunState: "review_ready",
        executionGraph: null,
        nextAction: {
          action: "review",
          detail: "The run finished and is ready for operator review.",
          label: "Review the result",
        },
        lineage: {
          objective: "Prepare release notes",
          desiredEndState: [],
          hardBoundaries: [],
          doneDefinition: null,
          riskPolicy: null,
          taskMode: "delegate",
          executionProfileId: "autonomous-delegate",
          taskSource: {
            kind: "external_runtime",
            label: "External runtime",
            title: "Prepare release notes",
            externalId: null,
            canonicalUrl: null,
            threadId: null,
            requestId: null,
            sourceTaskId: "runtime-7",
            sourceRunId: "runtime-7",
            githubSource: null,
          },
          threadId: null,
          requestId: null,
          rootTaskId: null,
          parentTaskId: null,
          childTaskIds: [],
          reviewDecisionState: "pending",
          reviewDecisionSummary: "Accept or reject this result from the review surface.",
        },
        accountability: {
          lifecycle: "in_review",
          claimedBy: "local-operator",
          claimedAt: 5,
          lifecycleUpdatedAt: 12,
        },
      },
    ]);
    expect(projection.reviewPacks[0]).toMatchObject({
      taskId: "runtime-task:runtime-7",
      validationOutcome: "unknown",
      governance: {
        state: "awaiting_review",
        blocking: true,
      },
      lineage: {
        objective: "Prepare release notes",
        threadId: null,
        requestId: null,
        reviewDecisionState: "pending",
      },
      ledger: {
        stepCount: 1,
        completedStepCount: 1,
        warningCount: 1,
        validationCount: 0,
        artifactCount: 1,
      },
    });
  });

  it("prefers runtime-published run and review-pack summaries over compatibility projections", () => {
    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Repo",
          rootPath: "C:/repo",
          connected: true,
          defaultProfileId: "balanced-delegate",
        },
      ],
      threads: [],
      runtimeTasks: [
        {
          taskId: "run-native-1",
          workspaceId: "ws-1",
          threadId: null,
          requestId: null,
          title: "Compatibility projection should not win",
          status: "completed",
          accessMode: "full-access",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          routedProvider: "openai",
          routedModelId: "gpt-5.3-codex",
          routedPool: "codex",
          routedSource: "workspace-default",
          currentStep: 0,
          createdAt: 10,
          updatedAt: 40,
          startedAt: 11,
          completedAt: 39,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [
            {
              index: 0,
              kind: "diagnostics",
              role: "verifier",
              status: "completed",
              message: "pnpm validate:fast",
              runId: null,
              output: "compat projection detail",
              metadata: {},
              startedAt: 11,
              updatedAt: 30,
              completedAt: 39,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
          runSummary: {
            id: "run-native-1",
            taskId: "runtime-task:run-native-1",
            workspaceId: "ws-1",
            taskSource: {
              kind: "github_issue",
              label: "GitHub issue #91",
              title: "Runtime truth wins",
              externalId: "openai/hugecode#91",
              canonicalUrl: "https://github.com/openai/hugecode/issues/91",
              threadId: null,
              requestId: null,
              sourceTaskId: "source-task-91",
              sourceRunId: "source-run-91",
            },
            state: "review_ready",
            title: "Runtime-native run",
            summary: "Runtime published the canonical run summary.",
            startedAt: 11,
            finishedAt: 39,
            updatedAt: 40,
            currentStepIndex: 0,
            pendingIntervention: null,
            executionProfile: {
              id: "balanced-delegate",
              name: "Balanced Delegate",
              description: "Runtime-owned execution profile.",
              executionMode: "remote_sandbox",
              autonomy: "bounded_delegate",
              supervisionLabel: "Review before merge",
              accessMode: "on-request",
              networkPolicy: "restricted",
              routingStrategy: "provider_route",
              toolPosture: "workspace_safe",
              approvalSensitivity: "standard",
              validationPresetId: "validate-runtime",
              identitySource: "repo_execution_contract",
            },
            reviewProfileId: "review-runtime",
            profileReadiness: {
              ready: true,
              health: "ready",
              summary: "Runtime resolved execution profile defaults before launch.",
              issues: [],
            },
            routing: {
              backendId: "backend-runtime",
              provider: "openai",
              routeLabel: "backend-runtime",
              providerLabel: "openai",
              pool: "codex",
              routeHint: "Runtime confirmed backend placement.",
              health: "ready",
              enabledAccountCount: 1,
              readyAccountCount: 1,
              enabledPoolCount: 1,
            },
            approval: {
              status: "not_required",
              approvalId: null,
              label: "No approval required",
              summary: "Runtime recorded no approval wait.",
            },
            reviewDecision: {
              status: "pending",
              reviewPackId: "review-pack:run-native-1",
              label: "Decision pending",
              summary: "Review the native artifact.",
              decidedAt: null,
            },
            intervention: {
              primaryAction: null,
              actions: [],
            },
            operatorState: {
              health: "healthy",
              headline: "Ready for review",
              detail: "Runtime already published final review context.",
            },
            nextAction: {
              action: "review",
              label: "Review runtime result",
              detail: "Use the runtime-native review pack.",
            },
            warnings: ["Runtime warning"],
            validations: [],
            artifacts: [],
            changedPaths: ["packages/code-runtime-service-rs/src/lib.rs"],
            autoDrive: null,
            completionReason: "Runtime completed and published review truth.",
            reviewPackId: "review-pack:run-native-1",
            lineage: {
              objective: "Runtime truth wins",
              desiredEndState: [],
              hardBoundaries: [],
              doneDefinition: {
                arrivalCriteria: ["Use runtime-published review truth."],
              },
              riskPolicy: null,
              taskMode: "pair",
              executionProfileId: "balanced-delegate",
              taskSource: {
                kind: "github_issue",
                label: "GitHub issue #91",
                title: "Runtime truth wins",
                externalId: "openai/hugecode#91",
                canonicalUrl: "https://github.com/openai/hugecode/issues/91",
                threadId: null,
                requestId: null,
                sourceTaskId: "source-task-91",
                sourceRunId: "source-run-91",
              },
              threadId: null,
              requestId: null,
              rootTaskId: null,
              parentTaskId: null,
              childTaskIds: [],
              reviewDecisionState: "pending",
              reviewDecisionSummary: "Review the native artifact.",
            },
            ledger: {
              traceId: "trace-native-1",
              checkpointId: "checkpoint-native-1",
              recovered: false,
              stepCount: 4,
              completedStepCount: 4,
              warningCount: 1,
              validationCount: 0,
              artifactCount: 0,
              evidenceState: "confirmed",
              backendId: "backend-runtime",
              routeLabel: "backend-runtime",
              completionReason: "Runtime completed and published review truth.",
              lastProgressAt: 40,
            },
            checkpoint: {
              state: "completed",
              lifecycleState: "completed",
              summary: "Checkpoint preserved.",
              checkpointId: "checkpoint-native-1",
              traceId: "trace-native-1",
              recovered: false,
              updatedAt: 40,
              resumeReady: false,
            },
            missionLinkage: null,
            actionability: {
              state: "ready",
              summary: "Runtime published the next review step.",
              actions: [],
              degradedReasons: [],
            },
            reviewGate: null,
            reviewFindings: [],
            reviewRunId: "review-run-native-1",
            skillUsage: [],
            autofixCandidate: null,
            governance: {
              state: "awaiting_review",
              label: "Awaiting review",
              summary: "Awaiting review on runtime truth.",
              blocking: true,
              suggestedAction: "review_result",
              availableActions: ["accept_result", "reject_result"],
            },
            placement: {
              requestedBackendIds: ["backend-runtime"],
              resolvedBackendId: "backend-runtime",
              resolutionSource: "explicit_preference",
              readiness: "ready",
              healthSummary: "placement_ready",
              attentionReasons: [],
              summary: "Runtime resolved backend placement before execution.",
              rationale: "Runtime resolved backend placement before execution.",
              lifecycleState: "confirmed",
            },
            operatorSnapshot: null,
            workspaceEvidence: {
              summary: "Runtime already published workspace evidence.",
              buckets: [],
            },
            missionBrief: {
              objective: "Runtime truth wins",
              doneDefinition: ["Review pack is native."],
              constraints: [],
              riskLevel: "medium",
              requiredCapabilities: ["review"],
              maxSubtasks: 1,
              preferredBackendIds: ["backend-runtime"],
              permissionSummary: null,
            },
            relaunchContext: null,
            subAgents: [],
            publishHandoff: null,
            takeoverBundle: null,
            executionGraph: null,
          },
          reviewPackSummary: {
            id: "review-pack:run-native-1",
            runId: "run-native-1",
            taskId: "runtime-task:run-native-1",
            workspaceId: "ws-1",
            taskSource: {
              kind: "github_issue",
              label: "GitHub issue #91",
              title: "Runtime truth wins",
              externalId: "openai/hugecode#91",
              canonicalUrl: "https://github.com/openai/hugecode/issues/91",
              threadId: null,
              requestId: null,
              sourceTaskId: "source-task-91",
              sourceRunId: "source-run-91",
            },
            summary: "Runtime published the canonical review pack.",
            reviewStatus: "ready",
            evidenceState: "confirmed",
            validationOutcome: "passed",
            warningCount: 1,
            warnings: ["Runtime warning"],
            validations: [],
            artifacts: [],
            checksPerformed: ["validate-runtime"],
            recommendedNextAction: "Accept the runtime-native review pack.",
            fileChanges: {
              paths: ["packages/code-runtime-service-rs/src/lib.rs"],
              totalCount: 1,
              summary: "1 runtime-recorded file change",
              missingReason: null,
            },
            evidenceRefs: {
              traceId: "trace-native-1",
              checkpointId: "checkpoint-native-1",
              diffArtifactIds: [],
              validationArtifactIds: [],
              logArtifactIds: [],
              commandArtifactIds: [],
            },
            assumptions: ["Runtime-native review truth was preserved."],
            reproductionGuidance: ["Inspect runtime summary."],
            rollbackGuidance: ["Use runtime evidence before reverting."],
            backendAudit: {
              summary: "backend-runtime",
              details: ["Provider: openai"],
              missingReason: null,
            },
            reviewDecision: {
              status: "pending",
              reviewPackId: "review-pack:run-native-1",
              label: "Decision pending",
              summary: "Review the native artifact.",
              decidedAt: null,
            },
            createdAt: 40,
            lineage: {
              objective: "Runtime truth wins",
              desiredEndState: [],
              hardBoundaries: [],
              doneDefinition: {
                arrivalCriteria: ["Use runtime-published review truth."],
              },
              riskPolicy: null,
              taskMode: "pair",
              executionProfileId: "balanced-delegate",
              taskSource: {
                kind: "github_issue",
                label: "GitHub issue #91",
                title: "Runtime truth wins",
                externalId: "openai/hugecode#91",
                canonicalUrl: "https://github.com/openai/hugecode/issues/91",
                threadId: null,
                requestId: null,
                sourceTaskId: "source-task-91",
                sourceRunId: "source-run-91",
              },
              threadId: null,
              requestId: null,
              rootTaskId: null,
              parentTaskId: null,
              childTaskIds: [],
              reviewDecisionState: "pending",
              reviewDecisionSummary: "Review the native artifact.",
            },
            ledger: {
              traceId: "trace-native-1",
              checkpointId: "checkpoint-native-1",
              recovered: false,
              stepCount: 4,
              completedStepCount: 4,
              warningCount: 1,
              validationCount: 0,
              artifactCount: 0,
              evidenceState: "confirmed",
              backendId: "backend-runtime",
              routeLabel: "backend-runtime",
              completionReason: "Runtime completed and published review truth.",
              lastProgressAt: 40,
            },
            checkpoint: {
              state: "completed",
              lifecycleState: "completed",
              summary: "Checkpoint preserved.",
              checkpointId: "checkpoint-native-1",
              traceId: "trace-native-1",
              recovered: false,
              updatedAt: 40,
              resumeReady: false,
            },
            missionLinkage: null,
            actionability: {
              state: "ready",
              summary: "Runtime published the next review step.",
              actions: [],
              degradedReasons: [],
            },
            reviewProfileId: "review-runtime",
            reviewGate: null,
            reviewFindings: [],
            reviewRunId: "review-run-native-1",
            skillUsage: [],
            autofixCandidate: null,
            governance: {
              state: "awaiting_review",
              label: "Awaiting review",
              summary: "Awaiting review on runtime truth.",
              blocking: true,
              suggestedAction: "review_result",
              availableActions: ["accept_result", "reject_result"],
            },
            placement: {
              requestedBackendIds: ["backend-runtime"],
              resolvedBackendId: "backend-runtime",
              resolutionSource: "explicit_preference",
              readiness: "ready",
              healthSummary: "placement_ready",
              attentionReasons: [],
              summary: "Runtime resolved backend placement before execution.",
              rationale: "Runtime resolved backend placement before execution.",
              lifecycleState: "confirmed",
            },
            workspaceEvidence: {
              summary: "Runtime already published workspace evidence.",
              buckets: [],
            },
            failureClass: null,
            relaunchOptions: null,
            subAgentSummary: [],
            publishHandoff: null,
            takeoverBundle: null,
          },
        } satisfies AgentTaskSummary,
      ],
    });

    expect(projection.runs[0]).toMatchObject({
      summary: "Runtime published the canonical run summary.",
      governance: {
        state: "awaiting_review",
      },
      placement: {
        resolvedBackendId: "backend-runtime",
        resolutionSource: "explicit_preference",
      },
      missionBrief: {
        objective: "Runtime truth wins",
      },
    });
    expect(projection.reviewPacks[0]).toMatchObject({
      summary: "Runtime published the canonical review pack.",
      recommendedNextAction: "Accept the runtime-native review pack.",
      reviewProfileId: "review-runtime",
      fileChanges: {
        totalCount: 1,
      },
      governance: {
        state: "awaiting_review",
      },
    });
  });

  it("supplements runtime-published summaries with sub-agent and workspace evidence overlays", () => {
    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Repo",
          rootPath: "C:/repo",
          connected: true,
          defaultProfileId: "balanced-delegate",
        },
      ],
      threads: [],
      runtimeTasks: [
        {
          taskId: "run-overlay-1",
          workspaceId: "ws-1",
          threadId: null,
          requestId: null,
          title: "Overlay runtime-published review data",
          status: "completed",
          accessMode: "full-access",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          routedProvider: "openai",
          routedModelId: "gpt-5.3-codex",
          routedPool: "codex",
          routedSource: "workspace-default",
          currentStep: 0,
          createdAt: 1,
          updatedAt: 12,
          startedAt: 2,
          completedAt: 11,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          runSummary: {
            id: "run-overlay-1",
            taskId: "runtime-task:run-overlay-1",
            workspaceId: "ws-1",
            taskSource: null,
            state: "review_ready",
            title: "Overlay runtime-published review data",
            summary: "Runtime summary without UI-only overlays.",
            startedAt: 2,
            finishedAt: 11,
            updatedAt: 12,
            currentStepIndex: 0,
            pendingIntervention: null,
            executionProfile: null,
            reviewProfileId: null,
            profileReadiness: null,
            routing: null,
            approval: null,
            reviewDecision: null,
            intervention: null,
            operatorState: null,
            nextAction: null,
            warnings: [],
            validations: [],
            artifacts: [],
            changedPaths: [
              "apps/code/src/application/runtime/facades/runtimeMissionControlFacade.ts",
            ],
            autoDrive: null,
            completionReason: "Overlay summary",
            reviewPackId: "review-pack:run-overlay-1",
            lineage: null,
            ledger: null,
            checkpoint: null,
            missionLinkage: null,
            actionability: null,
            reviewGate: null,
            reviewFindings: [],
            reviewRunId: null,
            skillUsage: [],
            autofixCandidate: null,
            governance: null,
            placement: null,
            operatorSnapshot: null,
            workspaceEvidence: null,
            missionBrief: {
              objective: "Overlay runtime-published review data",
              doneDefinition: ["Preserve runtime truth."],
              constraints: [],
              riskLevel: "low",
              requiredCapabilities: [],
              maxSubtasks: 1,
              preferredBackendIds: null,
              permissionSummary: null,
            },
            relaunchContext: null,
            subAgents: [],
            publishHandoff: null,
            takeoverBundle: null,
            executionGraph: null,
          },
          reviewPackSummary: {
            id: "review-pack:run-overlay-1",
            runId: "run-overlay-1",
            taskId: "runtime-task:run-overlay-1",
            workspaceId: "ws-1",
            taskSource: null,
            summary: "Runtime review pack without UI overlays.",
            reviewStatus: "ready",
            evidenceState: "confirmed",
            validationOutcome: "unknown",
            warningCount: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            checksPerformed: [],
            recommendedNextAction: "Inspect overlays.",
            fileChanges: {
              paths: [],
              totalCount: 0,
              summary: "Runtime file changes unavailable",
              missingReason: "Runtime omitted explicit file changes.",
            },
            evidenceRefs: {
              traceId: null,
              checkpointId: null,
              diffArtifactIds: [],
              validationArtifactIds: [],
              logArtifactIds: [],
              commandArtifactIds: [],
            },
            assumptions: [],
            reproductionGuidance: [],
            rollbackGuidance: [],
            backendAudit: {
              summary: "Routing unavailable",
              details: [],
              missingReason: "Runtime omitted backend audit.",
            },
            reviewDecision: null,
            createdAt: 12,
            lineage: null,
            ledger: null,
            checkpoint: null,
            missionLinkage: null,
            actionability: null,
            reviewProfileId: null,
            reviewGate: null,
            reviewFindings: [],
            reviewRunId: null,
            skillUsage: [],
            autofixCandidate: null,
            governance: null,
            placement: null,
            workspaceEvidence: null,
            failureClass: null,
            relaunchOptions: null,
            subAgentSummary: [],
            publishHandoff: null,
            takeoverBundle: null,
          },
          steps: [],
        } satisfies AgentTaskSummary,
      ],
      subAgentSessions: [
        {
          sessionId: "sub-agent-overlay-1",
          parentRunId: "run-overlay-1",
          scopeProfile: "review",
          status: "completed",
          approvalState: null,
          checkpointState: null,
          summary: "Sub-agent overlay detail.",
          timedOutReason: null,
          interruptedReason: null,
        },
      ],
    });

    expect(projection.runs[0]?.subAgents).toEqual([
      expect.objectContaining({
        sessionId: "sub-agent-overlay-1",
        parentRunId: "run-overlay-1",
      }),
    ]);
    expect(projection.runs[0]?.workspaceEvidence?.summary).toBe(
      "Runtime published inspectable workspace evidence for this run."
    );
    expect(projection.reviewPacks[0]?.subAgentSummary).toEqual([
      expect.objectContaining({
        sessionId: "sub-agent-overlay-1",
      }),
    ]);
    expect(projection.reviewPacks[0]?.workspaceEvidence?.summary).toBe(
      "Runtime published inspectable workspace evidence for this run."
    );
  });

  it("projects mission brief, relaunch context, and sub-agent supervision into runs and review packs", () => {
    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Repo",
          rootPath: "C:/repo",
          connected: true,
          defaultProfileId: "balanced-delegate",
        },
      ],
      threads: [],
      runtimeTasks: [
        {
          taskId: "run-supervised-1",
          workspaceId: "ws-1",
          threadId: null,
          requestId: null,
          title: "Ship supervised retry flow",
          status: "failed",
          accessMode: "on-request",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          routedProvider: "openai",
          routedModelId: "gpt-5.3-codex",
          routedPool: "codex",
          routedSource: "workspace-default",
          currentStep: 1,
          createdAt: 1,
          updatedAt: 20,
          startedAt: 2,
          completedAt: 18,
          errorCode: "TASK_FAILED",
          errorMessage: "Delegated review failed.",
          pendingApprovalId: null,
          missionBrief: {
            objective: "Ship supervised retry flow",
            doneDefinition: ["Review surface shows next-action kit."],
            constraints: ["Do not change unrelated review behavior."],
            riskLevel: "medium",
            requiredCapabilities: ["review", "runtime"],
            maxSubtasks: 2,
            preferredBackendIds: ["backend-review-a"],
            permissionSummary: {
              accessMode: "on-request",
              allowNetwork: false,
              writableRoots: ["apps/code/src/features/review"],
              toolNames: ["rg", "vitest"],
            },
          },
          relaunchContext: {
            sourceTaskId: "runtime-task:run-supervised-1",
            sourceRunId: "run-supervised-1",
            sourceReviewPackId: "review-pack:run-supervised-1",
            summary: "Retry after delegated review failure.",
            failureClass: "runtime_failed",
            recommendedActions: ["retry", "switch_profile_and_retry"],
          },
          steps: [
            {
              index: 0,
              kind: "read",
              role: "planner",
              status: "completed",
              message: "Delegated review failed.",
              runId: null,
              output: null,
              metadata: {},
              startedAt: 2,
              updatedAt: 20,
              completedAt: 18,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
        },
      ],
      subAgentSessions: [
        {
          sessionId: "sub-agent-1",
          parentRunId: "run-supervised-1",
          scopeProfile: "review",
          status: "failed",
          approvalState: {
            status: "approved",
          },
          checkpointState: {
            state: "persisted",
            lifecycleState: "task_status_sync",
            checkpointId: "checkpoint-sub-agent-1",
            traceId: "trace-sub-agent-1",
            recovered: false,
            updatedAt: 18,
          },
          summary: "Delegated review failed after timeout recovery.",
          timedOutReason: "Sub-agent exceeded max task window.",
          interruptedReason: null,
        },
      ],
    });

    expect(projection.runs[0]).toMatchObject({
      missionBrief: {
        objective: "Ship supervised retry flow",
        maxSubtasks: 2,
      },
      relaunchContext: {
        sourceRunId: "run-supervised-1",
        failureClass: "runtime_failed",
      },
      subAgents: [
        expect.objectContaining({
          sessionId: "sub-agent-1",
          status: "failed",
          timedOutReason: "Sub-agent exceeded max task window.",
        }),
      ],
      governance: {
        state: "action_required",
        blocking: true,
      },
    });
    expect(projection.reviewPacks[0]).toMatchObject({
      failureClass: "runtime_failed",
      relaunchOptions: {
        sourceRunId: "run-supervised-1",
        recommendedActions: expect.arrayContaining(["retry", "switch_profile_and_retry"]),
        primaryAction: "retry",
        availableActions: expect.arrayContaining([
          expect.objectContaining({
            action: "retry",
            enabled: true,
            supported: true,
          }),
          expect.objectContaining({
            action: "continue_with_clarification",
            enabled: true,
            supported: true,
          }),
          expect.objectContaining({
            action: "switch_profile_and_retry",
            enabled: true,
            supported: true,
          }),
          expect.objectContaining({
            action: "escalate_to_pair_mode",
            enabled: true,
            supported: true,
          }),
        ]),
      },
      subAgentSummary: [
        expect.objectContaining({
          sessionId: "sub-agent-1",
          status: "failed",
        }),
      ],
    });
  });

  it("returns canonical mission control snapshot when runtime snapshot is available", async () => {
    const snapshot = {
      source: "runtime_snapshot_v1" as const,
      generatedAt: 7,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [],
    };
    await expect(
      resolveMissionControlSnapshot({
        runtimeGateway: {
          readMissionControlSnapshot: vi.fn().mockResolvedValue(snapshot),
        },
        workspaces: [],
        threads: [],
      })
    ).resolves.toEqual(snapshot);
  });

  it("rethrows unsupported mission control snapshot errors instead of falling back", async () => {
    const snapshotError = new Error("unsupported");
    await expect(
      resolveMissionControlSnapshot({
        runtimeGateway: {
          readMissionControlSnapshot: vi.fn().mockRejectedValue(snapshotError),
        },
        workspaces: [],
        threads: [],
      })
    ).rejects.toBe(snapshotError);
  });

  it("rethrows non-unsupported mission control snapshot errors without fallback", async () => {
    const snapshotError = new Error("runtime unavailable");
    await expect(
      resolveMissionControlSnapshot({
        runtimeGateway: {
          readMissionControlSnapshot: vi.fn().mockRejectedValue(snapshotError),
        },
        workspaces: [],
        threads: [],
      })
    ).rejects.toBe(snapshotError);
  });
});
