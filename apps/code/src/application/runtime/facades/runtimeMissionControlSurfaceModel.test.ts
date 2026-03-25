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
    expect(reviewEntries[0]?.recommendedNextAction).toBe("Open Review Pack");
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
});
