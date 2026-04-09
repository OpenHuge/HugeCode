import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  buildLatestMissionRunsFromProjection,
  buildMissionReviewEntriesFromProjection,
  summarizeMissionControlSignals,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";

function createProjection(): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 3_000,
    workspaces: [
      {
        id: "ws-1",
        name: "Workspace One",
        rootPath: "/tmp/workspace-one",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [
      {
        id: "task-1",
        workspaceId: "ws-1",
        title: "Refactor review routing",
        objective: "Refactor review routing",
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue",
          title: "Refactor review routing",
          reference: "#42",
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
          },
          githubSource: {
            sourceRecordId: "source-42",
            repo: {
              owner: "ku0",
              name: "hugecode",
              fullName: "ku0/hugecode",
            },
            event: {
              deliveryId: "delivery-42",
              eventName: "issues",
              action: "assigned",
              receivedAt: 1_200,
            },
            ref: {
              label: "#42",
              issueNumber: 42,
              triggerMode: "assignment",
            },
            launchHandshake: {
              state: "started",
              summary: "Runtime started the GitHub-driven run.",
              disposition: "launched",
              preparedPlanVersion: "plan-v42",
              approvedPlanVersion: "plan-v42",
            },
          },
        },
        origin: {
          kind: "thread",
          threadId: "thread-1",
          runId: "run-1",
          requestId: null,
        },
        mode: "pair",
        modeSource: "execution_profile",
        status: "review_ready",
        createdAt: 1_000,
        updatedAt: 3_000,
        currentRunId: null,
        latestRunId: "run-1",
        latestRunState: "review_ready",
        nextAction: {
          label: "Review the evidence",
          action: "review",
          detail: null,
        },
      },
    ],
    runs: [
      {
        id: "run-1",
        taskId: "task-1",
        workspaceId: "ws-1",
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue",
          title: "Refactor review routing",
          reference: "#42",
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
          },
          githubSource: {
            sourceRecordId: "source-42",
            repo: {
              owner: "ku0",
              name: "hugecode",
              fullName: "ku0/hugecode",
            },
            event: {
              deliveryId: "delivery-42",
              eventName: "issues",
              action: "assigned",
              receivedAt: 1_200,
            },
            ref: {
              label: "#42",
              issueNumber: 42,
              triggerMode: "assignment",
            },
            launchHandshake: {
              state: "started",
              summary: "Runtime started the GitHub-driven run.",
              disposition: "launched",
              preparedPlanVersion: "plan-v42",
              approvedPlanVersion: "plan-v42",
            },
          },
        },
        state: "review_ready",
        title: "Refactor review routing",
        summary: "Runtime evidence is ready for review.",
        startedAt: 1_500,
        finishedAt: 3_000,
        updatedAt: 3_000,
        currentStepIndex: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        missionBrief: {
          objective: "Refactor review routing",
          doneDefinition: ["Keep runtime truth authoritative in review surfaces."],
          preferredBackendIds: ["backend-review-a"],
          planVersion: "plan-v3",
          planSummary: "Front-load runtime review evidence before deep detail sections.",
        },
        placement: {
          summary: "Runtime confirmed workspace-default placement on backend-review-a.",
          lifecycleState: "confirmed",
          resolutionSource: "workspace_default",
          requestedBackendIds: ["backend-review-a"],
          resolvedBackendId: "backend-review-a",
          readiness: "ready",
          healthSummary: "placement_ready",
          attentionReasons: [],
          rationale: "Runtime used the default review backend for this workspace.",
          backendContract: {
            kind: "native",
            origin: "runtime-native",
            transport: "http",
            capabilityCount: 3,
            health: "active",
            rolloutState: "current",
          },
        },
        reviewPackId: "review-pack:run-1",
        nextOperatorAction: {
          action: "review",
          label: "Review the evidence",
          detail: "Inspect the Review Pack and decide whether to continue.",
          source: "review_pack",
          sessionBoundary: {
            workspaceId: "workspace-review",
            taskId: "runtime-task:run-1",
            runId: "run-1",
            missionTaskId: "runtime-task:run-1",
            sessionKind: "thread",
            threadId: "thread-review",
            requestId: null,
            reviewPackId: "review-pack:run-1",
            checkpointId: null,
            traceId: null,
            navigationTarget: {
              kind: "thread",
              workspaceId: "workspace-review",
              threadId: "thread-review",
            },
          },
        },
        sourceCitations: [
          {
            id: "citation-1",
            label: "AGENTS.md",
            sourceKind: "repo_doc",
            trustLevel: "primary",
            claimSummary: "Repo instructions stay authoritative for execution.",
          },
          {
            id: "citation-2",
            label: ".github/copilot-instructions.md",
            sourceKind: "repo_doc",
            trustLevel: "primary",
            claimSummary: "Copilot instructions refine repository guidance.",
          },
          {
            id: "citation-3",
            label: "GitHub issue #42",
            sourceKind: "task_source",
            trustLevel: "derived",
            claimSummary: "Issue context scoped the requested change.",
          },
        ],
        takeoverBundle: {
          pathKind: "review",
          primaryAction: "open_review_pack",
          state: "ready",
          summary: "Open Review Pack on this device.",
          recommendedAction: "Open Review Pack",
          reviewPackId: "review-pack:run-1",
        },
      },
    ],
    reviewPacks: [
      {
        id: "review-pack:run-1",
        runId: "run-1",
        taskId: "task-1",
        workspaceId: "ws-1",
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue",
          title: "Refactor review routing",
          reference: "#42",
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
          },
          githubSource: {
            sourceRecordId: "source-42",
            repo: {
              owner: "ku0",
              name: "hugecode",
              fullName: "ku0/hugecode",
            },
            event: {
              deliveryId: "delivery-42",
              eventName: "issues",
              action: "assigned",
              receivedAt: 1_200,
            },
            ref: {
              label: "#42",
              issueNumber: 42,
              triggerMode: "assignment",
            },
            launchHandshake: {
              state: "started",
              summary: "Runtime started the GitHub-driven run.",
              disposition: "launched",
              preparedPlanVersion: "plan-v42",
              approvedPlanVersion: "plan-v42",
            },
          },
        },
        summary: "Runtime evidence is ready for review.",
        reviewStatus: "ready",
        evidenceState: "confirmed",
        validationOutcome: "passed",
        warningCount: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: "Open Review and inspect the pack.",
        createdAt: 3_000,
      },
    ],
  };
}

describe("runtimeMissionControlSurfaceModel", () => {
  it("uses shared runtime truth for home, missions, and review queues", () => {
    const projection = createProjection();
    const latestRuns = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 3,
    });
    const reviewEntries = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
    });
    const signals = summarizeMissionControlSignals(projection);

    expect(latestRuns[0]?.statusKind).toBe("review_ready");
    expect(latestRuns[0]?.operatorActionLabel).toBe("Open review");
    expect(reviewEntries[0]?.recommendedNextAction).toBe(
      "Inspect the Review Pack and decide whether to continue."
    );
    expect(reviewEntries[0]?.operatorActionLabel).toBe("Open review");
    expect(reviewEntries[0]?.continuePathLabel).toBeNull();
    expect(reviewEntries[0]?.contextSummary).toBe("GitHub issue · triage");
    expect(reviewEntries[0]?.provenanceSummary).toBe(
      "Launch source: ku0/hugecode | #42 | issues.assigned | record source-42 | handshake started | Repo guidance: AGENTS.md, .github/copilot-instructions.md | Source evidence: GitHub issue #42"
    );
    expect(reviewEntries[0]?.reviewGateLabel).toBeNull();
    expect(reviewEntries[0]?.routeDetail).toBe("Backend backend-review-a");
    expect(reviewEntries[0]?.compactEvidenceInput).toBeUndefined();
    expect(reviewEntries[0]?.triageSummary).toContain("Owner unassigned");
    expect(reviewEntries[0]?.delegationSummary).toBe(
      "Inspect the Review Pack and decide whether to continue."
    );
    expect(reviewEntries[0]?.continuationTruthSourceLabel).toBe("Runtime takeover bundle");
    expect(signals.reviewReadyCount).toBe(1);
  });

  it("publishes runtime triage tags for critical review, blocked follow-up, and autofix", () => {
    const projection = createProjection();
    const run = projection.runs[0];
    const reviewPack = projection.reviewPacks[0];
    if (!run || !reviewPack) {
      throw new Error("Expected seeded run and review pack");
    }

    run.takeoverBundle = undefined;
    run.continuation = {
      state: "blocked",
      pathKind: "review",
      source: "review_actionability",
      summary: "Review continuation is blocked.",
      detail: "Operator approval is required before the follow-up can continue.",
      recommendedAction: "Unblock the review follow-up.",
      target: {
        kind: "review_pack",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
      },
      reviewPackId: "review-pack:run-1",
      reviewActionability: {
        state: "blocked",
        summary: "Operator approval is required.",
        degradedReasons: [],
        actions: [],
      },
      sessionBoundary: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        missionTaskId: "task-1",
        sessionKind: "run",
        threadId: null,
        requestId: null,
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
        navigationTarget: {
          kind: "run",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: null,
        },
      },
    };
    reviewPack.reviewStatus = "action_required";
    reviewPack.reviewGate = {
      state: "blocked",
      summary: "Critical findings block acceptance.",
      highestSeverity: "critical",
      findingCount: 2,
    };
    reviewPack.reviewFindings = [
      {
        id: "finding-1",
        title: "Critical issue",
        severity: "critical",
        category: "repo_policy_mismatch",
        summary: "A critical review finding requires operator action.",
        confidence: "high",
      },
    ];
    reviewPack.autofixCandidate = {
      id: "autofix-1",
      summary: "Runtime prepared a bounded autofix.",
      status: "available",
    };

    const [entry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
    });

    expect(entry?.filterTags).toEqual(
      expect.arrayContaining([
        "needs_attention",
        "critical_review",
        "autofix_ready",
        "blocked_follow_up",
      ])
    );
    expect(entry?.reviewGateState).toBe("blocked");
    expect(entry?.highestReviewSeverity).toBe("critical");
    expect(entry?.autofixAvailable).toBe(true);
    expect(entry?.continuationState).toBe("blocked");
  });

  it("prefers runtime lifecycle and evidence summaries for review triage surfaces", () => {
    const projection = createProjection();
    const run = projection.runs[0];
    const reviewPack = projection.reviewPacks[0];
    if (!run || !reviewPack) {
      throw new Error("Expected seeded run and review pack");
    }

    run.lifecycleSummary = {
      stage: "rerouted",
      summary: "Runtime rerouted this run onto a fallback backend.",
      blocked: false,
      rerouted: true,
      validated: false,
      readyForReview: false,
      updatedAt: 3_000,
    };
    reviewPack.reviewStatus = "incomplete_evidence";
    reviewPack.evidenceSummary = {
      state: "incomplete",
      summary: "Validation evidence is incomplete and needs another pass.",
      validationCount: 0,
      artifactCount: 0,
      warningCount: 1,
      changedPathCount: 0,
      authoritativeTraceId: null,
      authoritativeCheckpointId: null,
      reviewStatus: "incomplete_evidence",
    };

    const [entry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
    });

    expect(entry?.summary).toBe("Validation evidence is incomplete and needs another pass.");
    expect(entry?.attentionSignals).toEqual(expect.arrayContaining(["Rerouted"]));
    expect(entry?.evidenceLabel).toBe("Evidence incomplete");
  });

  it("prefers canonical continuation and next operator action over stale review-pack text", () => {
    const projection = createProjection();
    const run = projection.runs[0];
    const reviewPack = projection.reviewPacks[0];
    if (!run || !reviewPack) {
      throw new Error("Expected seeded run and review pack");
    }

    run.takeoverBundle = undefined;
    run.continuation = {
      state: "ready",
      pathKind: "review",
      source: "review_actionability",
      summary: "Canonical review path is ready.",
      detail: "Open the canonical review pack path.",
      recommendedAction: "Open Review Pack",
      target: {
        kind: "review_pack",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
      },
      reviewPackId: "review-pack:run-1",
      reviewActionability: {
        state: "ready",
        summary: "Canonical review follow-up is ready.",
        degradedReasons: [],
        actions: [],
      },
      sessionBoundary: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        missionTaskId: "task-1",
        sessionKind: "run",
        threadId: null,
        requestId: null,
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
        navigationTarget: {
          kind: "run",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: null,
        },
      },
    };
    run.nextOperatorAction = {
      action: "open_review_pack",
      label: "Open Review Pack",
      detail: "Canonical operator next step for this run.",
      source: "continuation",
      target: {
        kind: "review_pack",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
      },
      sessionBoundary: run.continuation.sessionBoundary,
    };
    reviewPack.recommendedNextAction = "Stale projection follow-up";
    reviewPack.continuation = run.continuation;
    reviewPack.nextOperatorAction = run.nextOperatorAction;

    const reviewEntries = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
    });

    expect(reviewEntries[0]?.recommendedNextAction).toBe(
      "Canonical operator next step for this run."
    );
    expect(reviewEntries[0]?.continuePathLabel).toBeNull();
  });
});
