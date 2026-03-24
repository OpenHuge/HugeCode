import { describe, expect, it } from "vitest";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { buildSharedMissionControlSummary } from "./sharedMissionControlSummary";

function createSnapshot(
  overrides: Partial<HugeCodeMissionControlSnapshot> = {}
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [
      {
        id: "workspace-1",
        name: "Alpha",
        rootPath: "/alpha",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [],
    runs: [],
    reviewPacks: [],
    ...overrides,
  };
}

describe("buildSharedMissionControlSummary", () => {
  it("treats ready takeover bundles as the primary continuity truth", () => {
    const summary = buildSharedMissionControlSummary(
      createSnapshot({
        tasks: [
          {
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Task",
            objective: null,
            origin: { kind: "run", runId: "run-1", threadId: null, requestId: null },
            taskSource: null,
            mode: null,
            modeSource: "missing",
            status: "review_ready",
            createdAt: 0,
            updatedAt: 0,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "review_ready",
          },
        ],
        runs: [
          {
            id: "run-1",
            workspaceId: "workspace-1",
            taskId: "task-1",
            state: "review_ready",
            title: "Task",
            summary: null,
            taskSource: null,
            startedAt: 0,
            finishedAt: null,
            updatedAt: 0,
            currentStepIndex: null,
            takeoverBundle: {
              state: "ready",
              pathKind: "review",
              primaryAction: "open_review_pack",
              summary: "Review pack is ready.",
              recommendedAction: "Open the review pack.",
              reviewPackId: "review-1",
            },
            actionability: {
              state: "blocked",
              summary: "Blocked stale actionability should not win.",
              degradedReasons: [],
              actions: [],
            },
          },
        ],
      }),
      "workspace-1"
    );

    expect(summary.continuityReadiness.tone).toBe("ready");
    expect(summary.continuityReadiness.detail).toContain("1 review path ready");
  });

  it("keeps review packs as supporting evidence instead of primary continuity truth", () => {
    const summary = buildSharedMissionControlSummary(
      createSnapshot({
        tasks: [
          {
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Task",
            objective: null,
            origin: { kind: "run", runId: "run-1", threadId: null, requestId: null },
            taskSource: null,
            mode: null,
            modeSource: "missing",
            status: "review_ready",
            createdAt: 0,
            updatedAt: 0,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "review_ready",
          },
        ],
        runs: [
          {
            id: "run-1",
            workspaceId: "workspace-1",
            taskId: "task-1",
            state: "review_ready",
            title: "Task",
            summary: null,
            taskSource: null,
            startedAt: 0,
            finishedAt: null,
            updatedAt: 0,
            currentStepIndex: null,
            reviewPackId: "review-1",
          },
        ],
        reviewPacks: [
          {
            id: "review-1",
            runId: "run-1",
            taskId: "task-1",
            workspaceId: "workspace-1",
            summary: "Review ready",
            reviewStatus: "ready",
            evidenceState: "confirmed",
            validationOutcome: "passed",
            warningCount: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            checksPerformed: [],
            recommendedNextAction: null,
            createdAt: 0,
          },
        ],
      }),
      "workspace-1"
    );

    expect(summary.continuityReadiness.tone).toBe("attention");
    expect(summary.continuityReadiness.detail).toContain(
      "1 run only expose review-pack references"
    );
    expect(summary.continuityReadiness.detail).toContain("1 review pack available");
  });

  it("surfaces blocked placement and disconnected workspaces through centralized summaries", () => {
    const summary = buildSharedMissionControlSummary(
      createSnapshot({
        workspaces: [
          {
            id: "workspace-1",
            name: "Alpha",
            rootPath: "/alpha",
            connected: false,
            defaultProfileId: null,
          },
        ],
      }),
      "workspace-1"
    );

    expect(summary.launchReadiness.tone).toBe("blocked");
    expect(summary.continuityReadiness.tone).toBe("blocked");
    expect(summary.continuityReadiness.detail).toContain("must connect before checkpoint");
  });

  it("prefers runtime next-action and takeover guidance in mission and review summaries", () => {
    const summary = buildSharedMissionControlSummary(
      createSnapshot({
        tasks: [
          {
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Stabilize launch flow",
            objective: null,
            origin: { kind: "run", runId: "run-1", threadId: null, requestId: null },
            taskSource: null,
            mode: null,
            modeSource: "missing",
            status: "review_ready",
            createdAt: 0,
            updatedAt: 0,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "review_ready",
          },
        ],
        runs: [
          {
            id: "run-1",
            workspaceId: "workspace-1",
            taskId: "task-1",
            state: "review_ready",
            title: "Stabilize launch flow",
            summary: "Validation passed.",
            taskSource: null,
            startedAt: 0,
            finishedAt: null,
            updatedAt: 0,
            currentStepIndex: null,
            nextAction: {
              label: "Open review pack",
              action: "review",
              detail: "Inspect the review pack and accept or retry.",
            },
            takeoverBundle: {
              state: "ready",
              pathKind: "review",
              primaryAction: "open_review_pack",
              summary: "Review pack is ready.",
              recommendedAction: "Open the published review pack.",
              reviewPackId: "review-1",
            },
          },
        ],
        reviewPacks: [
          {
            id: "review-1",
            runId: "run-1",
            taskId: "task-1",
            workspaceId: "workspace-1",
            summary: "Review ready",
            reviewStatus: "ready",
            evidenceState: "confirmed",
            validationOutcome: "passed",
            warningCount: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            checksPerformed: [],
            recommendedNextAction: null,
            takeoverBundle: {
              state: "ready",
              pathKind: "review",
              primaryAction: "open_review_pack",
              summary: "Review pack is ready.",
              recommendedAction: "Open the published review pack.",
              reviewPackId: "review-1",
            },
            createdAt: 0,
          },
        ],
      }),
      "workspace-1"
    );

    expect(summary.missionItems[0]?.detail).toBe("Inspect the review pack and accept or retry.");
    expect(summary.missionItems[0]?.highlights).toContain("Next: Open review pack");
    expect(summary.reviewItems[0]?.summary).toBe("Open the published review pack.");
  });
});
