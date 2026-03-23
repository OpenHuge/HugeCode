import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  buildReviewPackDetailModel,
  resolveReviewPackSelection,
} from "./runtimeReviewPackSurfaceFacade";

function asProjection(value: unknown): HugeCodeMissionControlSnapshot {
  return value as HugeCodeMissionControlSnapshot;
}

describe("runtimeReviewPackSurfaceFacade", () => {
  it("prefers takeoverBundle review truth when building continuity state", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 10,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Review continuation",
          objective: "Review continuation",
          origin: {
            kind: "thread" as const,
            threadId: "thread-1",
            runId: "run-1",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review continuation",
          summary: "Ready for review.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:1",
          takeoverBundle: {
            pathKind: "review",
            primaryAction: "open_review_pack",
            state: "ready",
            summary: "Continue from Review Pack.",
            recommendedAction: "Open Review Pack",
            reviewPackId: "review-pack:1",
          },
          publishHandoff: {
            summary: "Legacy publish handoff",
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Ready for review.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Legacy follow-up",
          createdAt: 10,
        },
      ],
    });

    const detail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          reviewPackId: "review-pack:1",
          source: "review_surface",
        },
      }),
    });

    expect(detail?.kind).toBe("review_pack");
    if (!detail || detail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(detail.continuity).toMatchObject({
      summary: "Continue from Review Pack.",
      recommendedAction: "Open Review Pack",
    });
    expect(detail.recommendedNextAction).toBe("Open Review Pack");
  });

  it("prefers runtime review truth over projection review pack detail", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 10,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Review continuation",
          objective: "Review continuation",
          origin: {
            kind: "thread" as const,
            threadId: "thread-1",
            runId: "run-1",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review continuation",
          summary: "Ready for review.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:1",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Projection review summary.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Projection follow-up",
          createdAt: 10,
        },
      ],
    });

    const detail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          runId: "run-1",
          source: "review_surface",
        },
      }),
      runtimeReviewPack: {
        ...(projection.reviewPacks[0] ?? {}),
        id: "review-pack:1",
        runId: "run-1",
        taskId: "task-1",
        workspaceId: "workspace-1",
        summary: "Runtime review summary.",
        recommendedNextAction: "Runtime follow-up",
      },
    });

    expect(detail?.kind).toBe("review_pack");
    if (!detail || detail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(detail.summary).toBe("Runtime review summary.");
    expect(detail.recommendedNextAction).toBe("Runtime follow-up");
  });

  it("surfaces browser evidence when a review pack includes browser artifacts", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 10,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Browser fix loop",
          objective: "Browser fix loop",
          origin: {
            kind: "thread" as const,
            threadId: "thread-1",
            runId: "run-1",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Browser fix loop",
          summary: "Ready for review.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:1",
          autoDrive: {
            enabled: true,
            destination: {
              title: "Fix the browser path",
              desiredEndState: ["Browser verification passed"],
            },
            scenarioProfile: {
              authorityScope: "workspace_graph",
              authoritySources: ["repo_authority", "browser_runtime"],
              scenarioKeys: ["browser_repro_fix_verify"],
              safeBackground: false,
            },
            stop: {
              reason: "completed",
            },
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Browser fix review pack.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [
            {
              id: "artifact-browser-1",
              label: "Browser screenshot after fix",
              kind: "evidence" as const,
              uri: "https://example.com/fixed-path",
            },
          ],
          checksPerformed: [],
          recommendedNextAction: "Review the browser evidence and accept or retry.",
          createdAt: 10,
        },
      ],
    });

    const detail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          reviewPackId: "review-pack:1",
          source: "review_surface",
        },
      }),
    });

    expect(detail?.kind).toBe("review_pack");
    if (!detail || detail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(detail.browserEvidence).toEqual({
      status: "passed",
      targetUrl: "https://example.com/fixed-path",
      summary:
        "Runtime attached browser evidence for the target repro and final verification path.",
      artifacts: ["Browser screenshot after fix"],
      blockingReason: null,
    });
  });
});
