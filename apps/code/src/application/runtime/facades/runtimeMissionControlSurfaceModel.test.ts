import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  buildLatestMissionRunsFromProjection,
  buildMissionReviewEntriesFromProjection,
  summarizeMissionControlSignals,
} from "./runtimeMissionControlSurfaceModel";

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
        reviewPackId: "review-pack:run-1",
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
    expect(reviewEntries[0]?.recommendedNextAction).toBe("Open Review Pack");
    expect(reviewEntries[0]?.operatorActionLabel).toBe("Open review");
    expect(reviewEntries[0]?.continuePathLabel).toBe("Review Pack");
    expect(reviewEntries[0]?.contextSummary).toBe("GitHub issue · triage");
    expect(reviewEntries[0]?.provenanceSummary).toBe(
      "Repo guidance: AGENTS.md, .github/copilot-instructions.md | Source evidence: GitHub issue #42"
    );
    expect(reviewEntries[0]?.triageSummary).toContain("Owner unassigned");
    expect(reviewEntries[0]?.delegationSummary).toBe("Open Review Pack");
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

    expect(reviewEntries[0]?.recommendedNextAction).toBe("Open Review Pack");
    expect(reviewEntries[0]?.continuePathLabel).toBe("Review Pack");
  });

  it("keeps latest mission run labels aligned with review triage presentation", () => {
    const projection = createProjection();
    const reviewPack = projection.reviewPacks[0];
    if (!reviewPack) {
      throw new Error("Expected seeded review pack");
    }

    reviewPack.validationOutcome = "failed";

    const [latestRun] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 1,
    });

    expect(latestRun).toMatchObject({
      statusLabel: "Validation failed",
      statusKind: "attention",
    });
  });
});
