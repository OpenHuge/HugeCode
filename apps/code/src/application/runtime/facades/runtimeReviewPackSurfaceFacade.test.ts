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

  it("surfaces research sources and decision rationale for research_route_decide runs", () => {
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
          title: "Research route",
          objective: "Research route",
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
          title: "Research route",
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
              title: "Plan the migration route",
              desiredEndState: ["Route selected"],
            },
            scenarioProfile: {
              authorityScope: "workspace_graph",
              authoritySources: ["repo_authority", "chatgpt_web"],
              scenarioKeys: ["research_route_decide"],
              safeBackground: true,
            },
            decisionTrace: {
              summary: "Select the incremental route and cite official docs.",
              selectionTags: ["chatgpt_research_route_lab_auto"],
            },
            researchTrace: {
              status: "selected",
              summary: "Research route selected from official sources.",
            },
            researchSession: {
              phase: "selected",
              summary:
                "Research route selected from trusted sources across react.dev and vite.dev.",
              blockingReason: null,
              trustedSourceCount: 2,
              totalSourceCount: 2,
              sourceDomains: ["react.dev", "vite.dev"],
              coverageGaps: ["Confirm deprecated test helpers before upgrading."],
              recommendedCandidateId: "incremental-react-19",
            },
            researchSources: [
              {
                label: "React 19 upgrade guide",
                url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                domain: "react.dev",
              },
              {
                label: "Vite migration guide",
                url: "https://vite.dev/guide/migration",
                domain: "vite.dev",
              },
            ],
            lastChatgptResearchRouteLab: {
              phase: "selected",
              recommendedRoute: "incremental-react-19",
              alternativeRoutes: ["full-refresh"],
              decisionMemo:
                "Prefer the incremental path because it preserves the current runtime shell and aligns with official migration guidance.",
              recommendedRouteRationale:
                "The incremental route is the only path fully backed by the official React and Vite guidance.",
              sourceAssessment: {
                status: "trusted",
                trustedSourceCount: 2,
                totalSourceCount: 2,
                domains: ["react.dev", "vite.dev"],
              },
              confidence: "high",
              openQuestions: ["Confirm deprecated test helpers before upgrading."],
              coverageGaps: ["Confirm deprecated test helpers before upgrading."],
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
          summary: "Research route review pack.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the route memo and sources.",
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
    expect(detail.researchSources).toEqual([
      "react.dev - React 19 upgrade guide - https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
      "vite.dev - Vite migration guide - https://vite.dev/guide/migration",
    ]);
    expect(detail.researchSourceQuality).toBe("2 trusted sources · react.dev, vite.dev");
    expect(detail.researchCoverageGaps).toEqual([
      "Confirm deprecated test helpers before upgrading.",
    ]);
    expect(detail.decisionRationale).toContain(
      "The incremental route is the only path fully backed by the official React and Vite guidance."
    );
  });

  it("formats mixed research source quality without overstating trusted-only evidence", () => {
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
          title: "Plan the migration route",
          objective: "Plan the migration route",
          origin: {
            kind: "thread" as const,
            threadId: "thread-1",
            runId: "run-1",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          summary: "Select the safest migration route.",
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 1,
          currentRunId: "run-1",
          latestRunId: "run-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          workspaceId: "workspace-1",
          taskId: "task-1",
          title: "Research route",
          summary: "Research route run.",
          state: "review_ready",
          status: "completed",
          startedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          completedAt: 1,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:1",
          autoDrive: {
            enabled: true,
            destination: {
              title: "Plan the migration route",
              desiredEndState: ["Route selected"],
            },
            scenarioProfile: {
              authorityScope: "workspace_graph",
              authoritySources: ["repo_authority", "chatgpt_web"],
              scenarioKeys: ["research_route_decide"],
              safeBackground: true,
            },
            researchTrace: {
              status: "gap",
              summary: "Research gap remains: mixed evidence still needs operator review.",
            },
            researchSession: {
              phase: "gap",
              summary: "Research gap remains: mixed evidence still needs operator review.",
              blockingReason:
                "ChatGPT mixed trusted and untrusted evidence for the recommended route.",
              trustedSourceCount: 1,
              totalSourceCount: 2,
              sourceDomains: ["react.dev", "example.com"],
              coverageGaps: ["Confirm the Vitest compatibility note."],
              recommendedCandidateId: "incremental-react-19",
            },
            researchSources: [
              {
                label: "React 19 upgrade guide",
                url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                domain: "react.dev",
              },
              {
                label: "Community summary",
                url: "https://example.com/react-summary",
                domain: "example.com",
              },
            ],
            lastChatgptResearchRouteLab: {
              phase: "gap",
              recommendedRoute: "incremental-react-19",
              alternativeRoutes: [],
              decisionMemo:
                "The route is plausible, but the evidence mixes official guidance with an untrusted summary.",
              recommendedRouteRationale: null,
              sourceAssessment: {
                status: "mixed",
                trustedSourceCount: 1,
                totalSourceCount: 2,
                domains: ["react.dev", "example.com"],
              },
              confidence: "medium",
              openQuestions: [],
              coverageGaps: ["Confirm the Vitest compatibility note."],
              blockedReason: "missing_trusted_sources",
            },
            stop: {
              reason: "validation_failed",
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
          summary: "Research route review pack.",
          reviewStatus: "incomplete_evidence" as const,
          evidenceState: "incomplete" as const,
          validationOutcome: "unknown" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the route memo and sources.",
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
    expect(detail.researchSourceQuality).toBe("1 trusted of 2 sources · react.dev, example.com");
  });
});
