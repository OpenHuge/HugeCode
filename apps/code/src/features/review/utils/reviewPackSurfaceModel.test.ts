import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import { parseRepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import { buildReviewPackDetailModel, resolveReviewPackSelection } from "./reviewPackSurfaceModel";

function requireReviewPackDetail(detail: ReturnType<typeof buildReviewPackDetailModel>) {
  expect(detail?.kind).toBe("review_pack");
  if (!detail || detail.kind !== "review_pack") {
    throw new Error("Expected review pack detail");
  }
  return detail;
}

function asMissionControlSnapshot(value: unknown): HugeCodeMissionControlSnapshot {
  return value as HugeCodeMissionControlSnapshot;
}

describe("reviewPackSurfaceModel", () => {
  it("projects canonical review intelligence from repo policy and runtime review fields", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:runtime-88",
          workspaceId: "workspace-1",
          title: "Review intelligence projection",
          objective: "Review intelligence projection",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "runtime-88",
            requestId: null,
          },
          taskSource: {
            kind: "github_issue" as const,
            title: "Review intelligence projection",
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "runtime-88",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "runtime-88",
          taskId: "runtime-task:runtime-88",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review intelligence projection",
          summary: "Review pack ready.",
          taskSource: {
            kind: "github_issue" as const,
            title: "Review intelligence projection",
          },
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:runtime-88",
          reviewProfileId: "issue-review",
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
            description: "Balanced",
            executionMode: "remote_sandbox",
            autonomy: "bounded_delegate",
            supervisionLabel: "Operator review",
            accessMode: "on-request",
            networkPolicy: "default",
            routingStrategy: "provider_route",
            toolPosture: "default",
            approvalSensitivity: "standard",
            identitySource: null,
            validationPresetId: "review-first",
          },
          reviewGate: {
            state: "warn",
            summary: "Runtime review found one follow-up.",
            highestSeverity: "warning",
            findingCount: 1,
          },
          reviewFindings: [
            {
              id: "finding-1",
              title: "Check repo policy",
              severity: "warning",
              category: "repo_policy_mismatch",
              summary: "Repository policy validation should run before accept.",
              confidence: "high",
            },
          ],
          skillUsage: [
            {
              skillId: "review-agent",
              name: "Review Agent",
              status: "used",
              recommendedFor: ["review"],
            },
          ],
          autofixCandidate: {
            id: "autofix-1",
            summary: "Restore the missing repo policy validation.",
            status: "available",
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:runtime-88",
          runId: "runtime-88",
          taskId: "runtime-task:runtime-88",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the evidence and accept or retry.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:runtime-88",
            source: "review_surface",
          },
        }),
        repositoryExecutionContract: parseRepositoryExecutionContract(
          JSON.stringify({
            version: 1,
            defaults: {
              executionProfileId: "balanced-delegate",
              reviewProfileId: "default-review",
              validationPresetId: "standard",
            },
            defaultReviewProfileId: "default-review",
            sourceMappings: {
              github_issue: {
                reviewProfileId: "issue-review",
                validationPresetId: "review-first",
              },
            },
            validationPresets: [
              { id: "standard", label: "Standard", commands: ["pnpm validate"] },
              { id: "review-first", label: "Review first", commands: ["pnpm validate:fast"] },
            ],
            reviewProfiles: [
              {
                id: "default-review",
                label: "Default Review",
                allowedSkillIds: ["review-agent"],
                validationPresetId: "standard",
                autofixPolicy: "bounded",
                githubMirrorPolicy: "summary",
              },
              {
                id: "issue-review",
                label: "Issue Review",
                allowedSkillIds: ["review-agent", "repo-policy-check"],
                validationPresetId: "review-first",
                autofixPolicy: "manual",
                githubMirrorPolicy: "check_output",
              },
            ],
          })
        ),
      })
    );

    expect(detail.reviewIntelligence).toMatchObject({
      reviewProfileId: "issue-review",
      reviewProfileLabel: "Issue Review",
      validationPresetId: "review-first",
      validationPresetLabel: "Review first",
      allowedSkillIds: ["review-agent", "repo-policy-check"],
      autofixPolicy: "manual",
    });
    expect(detail.skillUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skillId: "review-agent", status: "used" }),
        expect.objectContaining({ skillId: "repo-policy-check", status: "suggested" }),
      ])
    );
  });

  it("falls back to the newest review pack in the active workspace when the requested pack is missing", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:runtime-7",
          workspaceId: "workspace-1",
          title: "Prepare release notes",
          objective: "Prepare release notes",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "runtime-7",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "runtime-7",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "runtime-7",
          taskId: "runtime-task:runtime-7",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Prepare release notes",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:runtime-7",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:runtime-7",
          runId: "runtime-7",
          taskId: "runtime-task:runtime-7",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept the result.",
          createdAt: 10,
        },
      ],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:missing",
        source: "home",
      },
    });

    expect(selection.status).toBe("fallback");
    expect(selection.detailKind).toBe("review_pack");
    expect(selection.selectedReviewPackId).toBe("review-pack:runtime-7");
    expect(selection.fallbackReason).toBe("requested_review_pack_missing");

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection,
      })
    );

    expect(detail).toMatchObject({
      kind: "review_pack",
      id: "review-pack:runtime-7",
      source: "runtime_snapshot_v1",
      sourceLabel: "Runtime snapshot",
      navigationTarget: {
        kind: "review",
        reviewPackId: "review-pack:runtime-7",
      },
    });
  });

  it("includes task source lineage details in the review pack surface", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:runtime-42",
          workspaceId: "workspace-1",
          title: "Fix task-source lineage",
          objective: "Fix task-source lineage",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "runtime-42",
            requestId: null,
          },
          taskSource: {
            kind: "github_issue" as const,
            label: "GitHub issue #42 · ku0/hugecode",
            shortLabel: "Issue #42",
            title: "Fix task-source lineage",
            reference: "#42",
            url: "https://github.com/ku0/hugecode/issues/42",
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "runtime-42",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "runtime-42",
          taskId: "runtime-task:runtime-42",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          taskSource: {
            kind: "github_issue" as const,
            label: "GitHub issue #42 · ku0/hugecode",
            shortLabel: "Issue #42",
            title: "Fix task-source lineage",
            reference: "#42",
            url: "https://github.com/ku0/hugecode/issues/42",
          },
          title: "Fix task-source lineage",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:runtime-42",
          selectedOpportunityId: "opportunity-primary",
          sourceCitations: [
            {
              id: "citation-1",
              label: "AGENTS.md",
              sourceKind: "repo_doc" as const,
              trustLevel: "primary" as const,
              claimSummary: "Repo instructions remain authoritative for unattended execution.",
            },
          ],
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:runtime-42",
          runId: "runtime-42",
          taskId: "runtime-task:runtime-42",
          workspaceId: "workspace-1",
          taskSource: {
            kind: "github_issue" as const,
            label: "GitHub issue #42 · ku0/hugecode",
            shortLabel: "Issue #42",
            title: "Fix task-source lineage",
            reference: "#42",
            url: "https://github.com/ku0/hugecode/issues/42",
          },
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept the result.",
          createdAt: 10,
          wakeReason: "review_pack_ready",
          wakeState: "ready" as const,
          nextEligibleAction: "approve" as const,
          queuePosition: 1,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:runtime-42",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.secondaryLabel).toBe("Runtime-managed mission | Issue #42");
    expect(detail.lineage?.details).toContain("Task source: GitHub issue #42 · ku0/hugecode");
    expect(detail.lineage?.details).toContain(
      "Source link: https://github.com/ku0/hugecode/issues/42"
    );
    expect(detail.lineage?.details).toContain("Selected opportunity: opportunity-primary");
    expect(detail.lineage?.details).toContain(
      "AGENTS.md: Repo instructions remain authoritative for unattended execution. (primary)"
    );
    expect(detail.relaunchContext?.details).toContain("Wake reason: review_pack_ready");
    expect(detail.relaunchContext?.details).toContain("Next eligible action: approve");
  });

  it("surfaces the runtime validation preset in execution context details", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:runtime-43",
          workspaceId: "workspace-1",
          title: "Preserve validation preset",
          objective: "Preserve validation preset",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "runtime-43",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "runtime-43",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "runtime-43",
          taskId: "runtime-task:runtime-43",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Preserve validation preset",
          summary: "Review pack ready.",
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
            description: "Workspace-safe execution.",
            executionMode: "local_background" as const,
            autonomy: "bounded_delegate" as const,
            supervisionLabel: "Approve writes, observe progress, intervene when blocked",
            accessMode: "on-request" as const,
            networkPolicy: "default" as const,
            routingStrategy: "workspace_default" as const,
            toolPosture: "workspace_safe" as const,
            approvalSensitivity: "standard" as const,
            identitySource: "workspace-routing",
            validationPresetId: "standard",
          },
          routing: {
            backendId: "backend-review-a",
            provider: null,
            providerLabel: null,
            pool: null,
            routeLabel: "backend-review-a",
            routeHint: "Runtime confirmed backend placement.",
            health: "ready" as const,
            enabledAccountCount: 0,
            readyAccountCount: 0,
            enabledPoolCount: 0,
          },
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:runtime-43",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:runtime-43",
          runId: "runtime-43",
          taskId: "runtime-task:runtime-43",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept the result.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:runtime-43",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.executionContext?.details).toContain("Execution profile: Balanced Delegate");
    expect(detail.executionContext?.details).toContain("Validation preset: standard");
  });

  it("shows repo source mapping origins when review continuation falls back to repository defaults", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:runtime-44",
          workspaceId: "workspace-1",
          title: "Review repo mapping fallback",
          objective: "Review repo mapping fallback",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "runtime-44",
            requestId: null,
          },
          taskSource: {
            kind: "github_issue" as const,
            label: "GitHub issue #44 · ku0/hugecode",
            shortLabel: "Issue #44",
            title: "Review repo mapping fallback",
            reference: "#44",
            url: "https://github.com/ku0/hugecode/issues/44",
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "runtime-44",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "runtime-44",
          taskId: "runtime-task:runtime-44",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review repo mapping fallback",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:runtime-44",
          routing: {
            backendId: "backend-review-a",
            provider: null,
            providerLabel: null,
            pool: null,
            routeLabel: "backend-review-a",
            routeHint: "Runtime confirmed backend placement.",
            health: "ready" as const,
            enabledAccountCount: 0,
            readyAccountCount: 0,
            enabledPoolCount: 0,
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:runtime-44",
          runId: "runtime-44",
          taskId: "runtime-task:runtime-44",
          workspaceId: "workspace-1",
          taskSource: {
            kind: "github_issue" as const,
            label: "GitHub issue #44 · ku0/hugecode",
            shortLabel: "Issue #44",
            title: "Review repo mapping fallback",
            reference: "#44",
            url: "https://github.com/ku0/hugecode/issues/44",
          },
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept the result.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:runtime-44",
            source: "review_surface",
          },
        }),
        repositoryExecutionContract: parseRepositoryExecutionContract(
          JSON.stringify({
            version: 1,
            defaults: {
              executionProfileId: "balanced-delegate",
              validationPresetId: "standard",
              preferredBackendIds: ["backend-default"],
            },
            sourceMappings: {
              github_issue: {
                executionProfileId: "operator-review",
                validationPresetId: "review-first",
                preferredBackendIds: ["backend-policy-a"],
                accessMode: "read-only",
              },
            },
            validationPresets: [
              {
                id: "standard",
                commands: ["pnpm validate"],
              },
              {
                id: "review-first",
                commands: ["pnpm test:component"],
              },
            ],
          })
        ),
      })
    );

    expect(detail.executionContext?.details).toContain("Repo source mapping: github_issue");
    expect(detail.executionContext?.details).toContain("Validation preset: review-first");
    expect(detail.executionContext?.details).toContain("Access mode: read-only");
    expect(detail.executionContext?.details).toContain("Profile source: repo source mapping.");
    expect(detail.executionContext?.details).toContain("Validation source: repo source mapping.");
  });

  it("keeps a thread-backed review pack linked to its mission thread in detail actions", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Refactor review routing",
          objective: "Refactor review routing",
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
          title: "Refactor review routing",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the result.",
          createdAt: 10,
        },
      ],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:run-1",
        source: "missions",
      },
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection,
      })
    );

    expect(detail).toMatchObject({
      id: "review-pack:run-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      reviewDecision: {
        status: "pending",
      },
      limitations: [],
    });
  });

  it("exposes runtime-backed accept and reject actions while review decision is pending", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Refactor review routing",
          objective: "Refactor review routing",
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
          title: "Refactor review routing",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
          reviewDecision: {
            status: "pending" as const,
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept or reject the result.",
          createdAt: 10,
          reviewDecision: {
            status: "pending" as const,
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.reviewDecision).toMatchObject({
      status: "pending",
      reviewPackId: "review-pack:run-1",
    });
    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "accept",
          enabled: true,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-1",
            status: "approved",
          },
        }),
        expect.objectContaining({
          id: "reject",
          enabled: true,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-1",
            status: "rejected",
          },
        }),
      ])
    );
  });

  it("derives decision-ready review context from run routing and intervention state", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Refactor review routing",
          objective: "Refactor review routing without changing operator flows",
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
          nextAction: {
            label: "Retry with narrower scope",
            action: "retry" as const,
            detail: "Warnings indicate the review surface still needs a narrower pass.",
          },
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Refactor review routing",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 2,
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
            description: "Balanced supervision profile",
            executionMode: "remote_sandbox" as const,
            autonomy: "bounded_delegate" as const,
            supervisionLabel: "Operator review",
            accessMode: "on-request" as const,
            networkPolicy: "restricted" as const,
            routingStrategy: "provider_route" as const,
            toolPosture: "workspace_safe" as const,
            approvalSensitivity: "standard" as const,
            identitySource: "pool-a",
            validationPresetId: "standard",
          },
          profileReadiness: {
            ready: true,
            health: "ready" as const,
            summary: "Routing profile is healthy.",
            issues: [],
          },
          routing: {
            provider: "openai",
            providerLabel: "OpenAI",
            pool: "pool-a",
            routeLabel: "Workspace default backend",
            routeHint: "Resolved from workspace default backend.",
            health: "ready" as const,
            enabledAccountCount: 2,
            readyAccountCount: 2,
            enabledPoolCount: 1,
          },
          approval: {
            status: "unavailable" as const,
            approvalId: null,
            label: "No inline approval",
            summary: "Acceptance is not wired to the review surface yet.",
          },
          intervention: {
            primaryAction: "retry" as const,
            actions: [
              {
                action: "retry" as const,
                label: "Retry",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "switch_profile_and_retry" as const,
                label: "Switch profile and retry",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "escalate_to_pair_mode" as const,
                label: "Continue in pair",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
          },
          operatorState: {
            health: "attention" as const,
            headline: "Warnings need operator review",
            detail: "Inspect warnings before shipping.",
          },
          nextAction: {
            label: "Retry with narrower scope",
            action: "retry" as const,
            detail: "Warnings indicate the review surface still needs a narrower pass.",
          },
          warnings: ["Warnings remain after the latest validation pass."],
          validations: [
            {
              id: "validation-1",
              label: "pnpm validate:fast",
              outcome: "warning" as const,
              summary: "One warning remains in the review surface.",
            },
          ],
          artifacts: [
            {
              id: "diff:run-1",
              label: "Diff preview",
              kind: "diff" as const,
              uri: "artifact://diff/run-1",
            },
            {
              id: "log:run-1",
              label: "Runtime log",
              kind: "log" as const,
              uri: "artifact://log/run-1",
            },
          ],
          completionReason: "Review ready with warnings.",
          reviewPackId: "review-pack:run-1",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "action_required" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "warning" as const,
          warningCount: 1,
          warnings: ["Warnings remain after the latest validation pass."],
          validations: [
            {
              id: "validation-1",
              label: "pnpm validate:fast",
              outcome: "warning" as const,
              summary: "One warning remains in the review surface.",
            },
          ],
          artifacts: [
            {
              id: "diff:run-1",
              label: "Diff preview",
              kind: "diff" as const,
              uri: "artifact://diff/run-1",
            },
          ],
          checksPerformed: ["pnpm validate:fast"],
          recommendedNextAction: "Retry with narrower scope.",
          createdAt: 10,
        },
      ],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:run-1",
        source: "review_surface",
      },
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection,
      })
    );

    expect(detail).toHaveProperty("assumptions");
    expect(detail).toHaveProperty("reproductionGuidance");
    expect(detail).toHaveProperty("rollbackGuidance");
    expect(detail).toHaveProperty("backendAudit");
    expect(detail).toHaveProperty("decisionActions");
    expect(detail).toMatchObject({
      backendAudit: {
        summary: "Runtime backend audit unavailable",
        missingReason: "The runtime did not publish backend audit details for this review pack.",
      },
    });
    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "accept",
          enabled: true,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-1",
            status: "approved",
          },
        }),
        expect.objectContaining({
          id: "retry",
          enabled: true,
        }),
        expect.objectContaining({
          id: "clarify",
          enabled: false,
          disabledReason: "Clarify is not currently available for this run.",
        }),
        expect.objectContaining({
          id: "switch_profile_and_retry",
          enabled: true,
          interventionDraft: expect.objectContaining({
            intent: "switch_profile",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "continue_in_pair",
          enabled: true,
          interventionDraft: expect.objectContaining({
            intent: "pair_mode",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
      ])
    );
    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "retry",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
        }),
        expect.objectContaining({
          id: "clarify",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
        }),
        expect.objectContaining({
          id: "switch_profile_and_retry",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
        }),
        expect.objectContaining({
          id: "continue_in_pair",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
        }),
      ])
    );
  });

  it("marks review packs with unconfirmed placement as read-only fallback", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:runtime-7",
          workspaceId: "workspace-1",
          title: "Prepare release notes",
          objective: "Prepare release notes",
          origin: {
            kind: "thread" as const,
            threadId: "thread-7",
            runId: "runtime-7",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "runtime-7",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "runtime-7",
          taskId: "runtime-task:runtime-7",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Prepare release notes",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:runtime-7",
          placement: {
            resolvedBackendId: "backend-a",
            requestedBackendIds: ["backend-a"],
            resolutionSource: "explicit_preference" as const,
            lifecycleState: "resolved" as const,
            readiness: "degraded" as const,
            summary: "Routing still being confirmed.",
            rationale: "Runtime has not confirmed the route yet.",
            backendContract: null,
          },
          intervention: {
            primaryAction: "retry" as const,
            actions: [
              {
                action: "retry" as const,
                label: "Retry",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:runtime-7",
          runId: "runtime-7",
          taskId: "runtime-task:runtime-7",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: null,
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: null,
          createdAt: 10,
          lineage: null,
          ledger: null,
          governance: null,
          placement: {
            resolvedBackendId: "backend-a",
            requestedBackendIds: ["backend-a"],
            resolutionSource: "explicit_preference" as const,
            lifecycleState: "resolved" as const,
            readiness: "degraded" as const,
            summary: "Routing still being confirmed.",
            rationale: "Runtime has not confirmed the route yet.",
            backendContract: null,
          },
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:runtime-7",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.limitations).toContain(
      "Placement is not runtime-confirmed yet. Accept, reject, and follow-up actions stay read-only until routing reaches a confirmed ready state."
    );
    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "accept",
          enabled: false,
          disabledReason:
            "Placement is not runtime-confirmed yet. Accept, reject, and follow-up actions stay read-only until routing reaches a confirmed ready state.",
        }),
        expect.objectContaining({
          id: "retry",
          enabled: false,
          disabledReason:
            "Placement is not runtime-confirmed yet. Accept, reject, and follow-up actions stay read-only until routing reaches a confirmed ready state.",
        }),
      ])
    );
  });

  it("prefers native review-pack context fields and builds intervention drafts with backend preference", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Refactor review routing",
          objective: "Refactor review routing without changing operator flows",
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
          title: "Refactor review routing",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
          },
          routing: {
            backendId: "backend-review-a",
            provider: "openai",
            providerLabel: "OpenAI",
            pool: "pool-review",
            routeLabel: "Workspace default backend",
            routeHint: "Resolved through backend-review-a.",
            health: "ready" as const,
            enabledAccountCount: 1,
            readyAccountCount: 1,
            enabledPoolCount: 1,
          },
          intervention: {
            actions: [
              {
                action: "retry" as const,
                label: "Retry",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "switch_profile_and_retry" as const,
                label: "Switch profile",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "escalate_to_pair_mode" as const,
                label: "Continue in pair",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
            primaryAction: "retry" as const,
          },
          governance: {
            state: "awaiting_review" as const,
            label: "Awaiting review decision",
            summary: "Accept or reject this result from the review surface.",
            blocking: true,
            suggestedAction: "review_result" as const,
            availableActions: ["retry", "switch_profile_and_retry", "escalate_to_pair_mode"],
          },
          lineage: {
            objective: "Refactor review routing without changing operator flows",
            hardBoundaries: ["Keep operator flows unchanged."],
            executionProfileId: "balanced-delegate",
            taskSource: {
              kind: "github_issue" as const,
              label: "GitHub issue #42",
              title: "Refactor review routing",
              externalId: "openai/hugecode#42",
              canonicalUrl: "https://github.com/openai/hugecode/issues/42",
              sourceTaskId: "issue-42",
              sourceRunId: "run-1",
            },
            reviewDecisionState: "pending" as const,
          },
          ledger: {
            traceId: "trace-run-1",
            checkpointId: null,
            recovered: false,
            stepCount: 1,
            completedStepCount: 1,
            warningCount: 0,
            validationCount: 0,
            artifactCount: 0,
            evidenceState: "confirmed" as const,
            backendId: "backend-review-a",
            routeLabel: "Workspace default backend",
            completionReason: "Run completed.",
            lastProgressAt: 10,
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Retry with narrower scope.",
          createdAt: 10,
          assumptions: ["Native assumption from runtime review pack."],
          reproductionGuidance: ["Native reproduction from runtime review pack."],
          rollbackGuidance: ["Native rollback from runtime review pack."],
          backendAudit: {
            summary: "Native backend audit",
            details: ["Native backend detail"],
            missingReason: null,
          },
          reviewDecision: {
            status: "pending" as const,
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          governance: {
            state: "awaiting_review" as const,
            label: "Awaiting review decision",
            summary: "Accept or reject this result from the review surface.",
            blocking: true,
            suggestedAction: "review_result" as const,
            availableActions: ["retry", "switch_profile_and_retry", "escalate_to_pair_mode"],
          },
          lineage: {
            objective: "Refactor review routing without changing operator flows",
            hardBoundaries: ["Keep operator flows unchanged."],
            executionProfileId: "balanced-delegate",
            taskSource: {
              kind: "github_issue" as const,
              label: "GitHub issue #42",
              title: "Refactor review routing",
              externalId: "openai/hugecode#42",
              canonicalUrl: "https://github.com/openai/hugecode/issues/42",
              sourceTaskId: "issue-42",
              sourceRunId: "run-1",
            },
            reviewDecisionState: "pending" as const,
          },
          ledger: {
            traceId: "trace-run-1",
            checkpointId: null,
            recovered: false,
            stepCount: 1,
            completedStepCount: 1,
            warningCount: 0,
            validationCount: 0,
            artifactCount: 0,
            evidenceState: "confirmed" as const,
            backendId: "backend-review-a",
            routeLabel: "Workspace default backend",
            completionReason: "Run completed.",
            lastProgressAt: 10,
          },
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail).toMatchObject({
      assumptions: ["Native assumption from runtime review pack."],
      reproductionGuidance: ["Native reproduction from runtime review pack."],
      rollbackGuidance: ["Native rollback from runtime review pack."],
      backendAudit: {
        summary: "Native backend audit",
        details: ["Native backend detail"],
        missingReason: null,
      },
      governance: {
        summary: "Awaiting review decision: Accept or reject this result from the review surface.",
        details: expect.arrayContaining([
          "Governance state: awaiting_review",
          "Suggested action: review_result",
        ]),
      },
      lineage: {
        summary:
          "Objective, guardrails, and review outcome stayed attached to this runtime-managed mission.",
        details: expect.arrayContaining([
          "Objective: Refactor review routing without changing operator flows",
          "Task source: GitHub issue #42",
          "Source ID: openai/hugecode#42",
          "Source URL: https://github.com/openai/hugecode/issues/42",
          "Review decision: pending",
        ]),
      },
      ledger: {
        summary:
          "Trace, checkpoint, and routing facts were recorded for control-device handoff and review.",
        details: expect.arrayContaining(["Warnings recorded: 0", "Artifacts recorded: 0"]),
      },
      executionContext: {
        summary: "Balanced Delegate via backend-review-a",
        details: expect.arrayContaining([
          "Follow-up relaunches inherit the recorded execution profile and backend route until changed by a control device in Mission Control.",
        ]),
      },
    });
    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "retry",
          enabled: true,
          interventionDraft: expect.objectContaining({
            intent: "retry",
            instruction: "Review pack ready.",
            title: "Refactor review routing",
            profileId: "balanced-delegate",
            preferredBackendIds: ["backend-review-a"],
            sourceTaskId: "task-1",
            sourceRunId: "run-1",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "clarify",
          enabled: false,
          disabledReason: "Clarify is not currently available for this run.",
          interventionDraft: expect.objectContaining({
            intent: "clarify",
            preferredBackendIds: ["backend-review-a"],
            sourceTaskId: "task-1",
            sourceRunId: "run-1",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "switch_profile_and_retry",
          enabled: true,
          interventionDraft: expect.objectContaining({
            intent: "switch_profile",
            preferredBackendIds: ["backend-review-a"],
            sourceTaskId: "task-1",
            sourceRunId: "run-1",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "continue_in_pair",
          enabled: true,
          interventionDraft: expect.objectContaining({
            intent: "pair_mode",
            preferredBackendIds: ["backend-review-a"],
            sourceTaskId: "task-1",
            sourceRunId: "run-1",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
      ])
    );
  });

  it("keeps follow-up interventions available for runtime snapshots", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Refactor review routing",
          objective: "Refactor review routing without changing operator flows",
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
          title: "Refactor review routing",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
          },
          routing: {
            backendId: "backend-review-a",
            provider: "openai",
            providerLabel: "OpenAI",
            pool: "pool-review",
            routeLabel: "Workspace default backend",
            routeHint: "Resolved through backend-review-a.",
            health: "ready" as const,
            enabledAccountCount: 1,
            readyAccountCount: 1,
            enabledPoolCount: 1,
          },
          intervention: {
            actions: [
              {
                action: "retry" as const,
                label: "Retry",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "switch_profile_and_retry" as const,
                label: "Switch profile",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "escalate_to_pair_mode" as const,
                label: "Continue in pair",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
            primaryAction: "retry" as const,
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Retry with narrower scope.",
          createdAt: 10,
          placement: {
            resolvedBackendId: "backend-review-a",
            requestedBackendIds: ["backend-review-a"],
            resolutionSource: "explicit_preference" as const,
            lifecycleState: "confirmed" as const,
            readiness: "ready" as const,
            summary: "Runtime confirmed the requested backend backend-review-a.",
            rationale:
              "Mission Control requested backend-review-a and runtime confirmed that placement.",
            backendContract: {
              kind: "native" as const,
              origin: "runtime-native" as const,
              transport: null,
              capabilityCount: 3,
              health: "active" as const,
              rolloutState: "current" as const,
            },
          },
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.source).toBe("runtime_snapshot_v1");
    expect(detail.placement).toEqual({
      summary: "Runtime confirmed the requested backend backend-review-a.",
      details: [
        "Placement lifecycle: confirmed",
        "Placement source: explicit_preference",
        "Requested backends: backend-review-a",
        "Resolved backend: backend-review-a",
        "Routing readiness: ready",
        "Placement rationale: Mission Control requested backend-review-a and runtime confirmed that placement.",
        "Backend contract: native via runtime-native",
        "Backend health: active",
      ],
    });
    expect(detail.limitations).toEqual([]);
    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "retry",
          enabled: true,
        }),
      ])
    );
  });

  it("inherits requested backend ids from confirmed placement evidence when follow-up drafts are generated", () => {
    const projection = asMissionControlSnapshot({
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
          id: "task-placement-1",
          workspaceId: "workspace-1",
          title: "Preserve requested backend set",
          objective: "Retry from placement evidence instead of the resolved fallback only",
          origin: {
            kind: "thread" as const,
            threadId: "thread-placement-1",
            runId: "run-placement-1",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-placement-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-placement-1",
          taskId: "task-placement-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Preserve requested backend set",
          summary: "Retry should preserve the operator-requested backend preference.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-placement-1",
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
          },
          routing: {
            backendId: "backend-fallback-b",
            provider: "openai",
            providerLabel: "OpenAI",
            pool: "pool-review",
            routeLabel: "Fallback backend",
            routeHint: "Runtime rerouted away from backend-request-a.",
            health: "ready" as const,
            enabledAccountCount: 1,
            readyAccountCount: 1,
            enabledPoolCount: 1,
          },
          placement: {
            resolvedBackendId: "backend-request-a",
            requestedBackendIds: ["backend-request-a", "backend-request-b"],
            resolutionSource: "explicit_preference" as const,
            lifecycleState: "confirmed" as const,
            readiness: "ready" as const,
            summary: "Runtime confirmed placement on backend backend-request-a.",
            rationale:
              "Runtime honored the requested backend set and confirmed the selected backend.",
            backendContract: {
              kind: "acp" as const,
              origin: "acp-projection" as const,
              transport: "http" as const,
              capabilityCount: 6,
              health: "active" as const,
              rolloutState: "current" as const,
            },
          },
          intervention: {
            actions: [
              {
                action: "retry" as const,
                label: "Retry",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "switch_profile_and_retry" as const,
                label: "Switch profile",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
            primaryAction: "retry" as const,
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-placement-1",
          runId: "run-placement-1",
          taskId: "task-placement-1",
          workspaceId: "workspace-1",
          summary: "Retry should preserve the operator-requested backend preference.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Retry with the original backend preference set.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-placement-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "retry",
          interventionDraft: expect.objectContaining({
            preferredBackendIds: ["backend-request-a", "backend-request-b"],
          }),
        }),
        expect.objectContaining({
          id: "clarify",
          interventionDraft: expect.objectContaining({
            preferredBackendIds: ["backend-request-a", "backend-request-b"],
          }),
        }),
      ])
    );
  });

  it("surfaces placement fallback reasons and score breakdown details", () => {
    const projection = asMissionControlSnapshot({
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
      tasks: [],
      runs: [
        {
          id: "run-1",
          taskId: "runtime-task:run-1",
          workspaceId: "workspace-1",
          state: "running" as const,
          title: "Placement fallback run",
          summary: "Placement fallback needs review.",
          startedAt: 2,
          finishedAt: null,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
          placement: {
            resolvedBackendId: "backend-fallback",
            requestedBackendIds: ["backend-preferred"],
            resolutionSource: "runtime_fallback" as const,
            lifecycleState: "fallback" as const,
            readiness: "attention" as const,
            healthSummary: "placement_attention" as const,
            attentionReasons: ["fallback_backend_selected"] as const,
            summary: "Runtime confirmed fallback placement on backend backend-fallback.",
            rationale:
              "Preferred placement could not be resumed, so runtime selected a healthy fallback backend.",
            fallbackReasonCode: "resume_backend_unavailable",
            resumeBackendId: "backend-resume",
            scoreBreakdown: [
              {
                backendId: "backend-fallback",
                totalScore: 1510,
                explicitPreferenceScore: 0,
                resumeAffinityScore: 0,
                readinessScore: 180,
                latencyScore: 60,
                capacityScore: 100,
                queuePenalty: -15,
                failurePenalty: 0,
                healthScore: 85,
                reasons: ["placement_ready", "latency:interactive", "slots_available"],
              },
              {
                backendId: "backend-preferred",
                totalScore: 1180,
                explicitPreferenceScore: 1000,
                resumeAffinityScore: 0,
                readinessScore: 60,
                latencyScore: 35,
                capacityScore: 25,
                queuePenalty: -30,
                failurePenalty: -20,
                healthScore: 110,
                reasons: ["explicit_preference", "placement_attention"],
              },
            ],
            backendContract: {
              kind: "native" as const,
              origin: "runtime-native" as const,
              transport: "stdio" as const,
              capabilityCount: 3,
              health: "active" as const,
              rolloutState: "current" as const,
            },
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "runtime-task:run-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Retry on the preferred backend later.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.placement?.details).toEqual(
      expect.arrayContaining([
        "Placement fallback reason: resume_backend_unavailable",
        "Resume backend affinity: backend-resume",
        "Placement score breakdown: backend-fallback=1510, backend-preferred=1180",
      ])
    );
  });

  it("opens mission detail when a runtime run exists without a review pack", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:active-1",
          workspaceId: "workspace-1",
          title: "Stabilize mission detail routing",
          objective: "Expose a single mission detail surface before review",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "run-active-1",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "running" as const,
          createdAt: 1,
          updatedAt: 20,
          currentRunId: "run-active-1",
          latestRunId: "run-active-1",
          latestRunState: "running" as const,
          nextAction: {
            label: "Inspect mission detail",
            action: "review" as const,
            detail: "Track route state before review evidence is ready.",
          },
        },
      ],
      runs: [
        {
          id: "run-active-1",
          taskId: "runtime-task:active-1",
          workspaceId: "workspace-1",
          state: "running" as const,
          title: "Stabilize mission detail routing",
          summary: "Runtime is still executing the mission route.",
          startedAt: 2,
          finishedAt: null,
          updatedAt: 20,
          currentStepIndex: 1,
          warnings: ["Validation has not run yet."],
          validations: [],
          artifacts: [],
          routing: {
            backendId: "backend-a",
            provider: "openai",
            providerLabel: "OpenAI",
            pool: "pool-a",
            routeLabel: "Workspace default backend",
            routeHint: "Resolved through backend-a.",
            health: "ready" as const,
            enabledAccountCount: 1,
            readyAccountCount: 1,
            enabledPoolCount: 1,
          },
          operatorState: {
            health: "attention" as const,
            headline: "Run is controllable",
            detail: "Monitor the active waypoint until validation starts.",
          },
          nextAction: {
            label: "Inspect active route",
            action: "review" as const,
            detail: "Mission detail now carries the runtime-only observe path.",
          },
          governance: {
            state: "in_progress" as const,
            label: "Runtime-governed execution",
            summary: "Mission detail now carries the runtime-only observe path.",
            blocking: false,
            suggestedAction: "review_result" as const,
            availableActions: ["cancel"],
          },
          placement: {
            resolvedBackendId: "backend-a",
            requestedBackendIds: [],
            resolutionSource: "workspace_default" as const,
            lifecycleState: "confirmed" as const,
            readiness: "ready" as const,
            summary: "Runtime confirmed workspace-default placement on backend backend-a.",
            rationale:
              "No explicit backend preference was recorded, so runtime used the default workspace backend.",
            backendContract: {
              kind: "native" as const,
              origin: "runtime-native" as const,
              transport: null,
              capabilityCount: 4,
              health: "active" as const,
              rolloutState: "current" as const,
            },
          },
          autoDrive: {
            enabled: true,
            destination: {
              title: "Close the observe loop",
              desiredEndState: ["Single mission detail", "Runtime route visible"],
              routePreference: "balanced" as const,
            },
            navigation: {
              activeWaypoint: "Route mission targets into review detail",
              completedWaypoints: ["Unify navigation targets"],
              pendingWaypoints: ["Render runtime-only detail"],
            },
          },
          lineage: {
            objective: "Expose a single mission detail surface before review",
            desiredEndState: ["Single mission detail", "Runtime route visible"],
            executionProfileId: "balanced-delegate",
            reviewDecisionState: "pending" as const,
          },
          ledger: {
            traceId: "trace-active-1",
            checkpointId: "checkpoint-active-1",
            recovered: false,
            stepCount: 2,
            completedStepCount: 1,
            warningCount: 1,
            validationCount: 0,
            artifactCount: 0,
            evidenceState: "confirmed" as const,
            backendId: "backend-a",
            routeLabel: "Workspace default backend",
            completionReason: null,
            lastProgressAt: 20,
          },
          reviewPackId: null,
        },
      ],
      reviewPacks: [],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        taskId: "runtime-task:active-1",
        runId: "run-active-1",
        source: "missions",
      },
    });

    expect(selection).toMatchObject({
      status: "selected",
      detailKind: "mission_run",
      selectedTaskId: "runtime-task:active-1",
      selectedRunId: "run-active-1",
      selectedReviewPackId: null,
    });

    const detail = buildReviewPackDetailModel({
      projection,
      selection,
    });

    expect(detail).toMatchObject({
      kind: "mission_run",
      taskId: "runtime-task:active-1",
      runId: "run-active-1",
      runState: "running",
      routeSummary: "Workspace default backend",
      sourceLabel: "Runtime snapshot",
      governance: {
        summary:
          "Runtime-governed execution: Mission detail now carries the runtime-only observe path.",
      },
      placement: {
        summary: "Runtime confirmed workspace-default placement on backend backend-a.",
        details: expect.arrayContaining([
          "Placement lifecycle: confirmed",
          "Placement source: workspace_default",
          "Resolved backend: backend-a",
          "Routing readiness: ready",
          "Backend contract: native via runtime-native",
        ]),
      },
      lineage: {
        summary:
          "Objective, guardrails, and review outcome stayed attached to this runtime-managed mission.",
      },
      ledger: {
        summary:
          "Trace, checkpoint, and routing facts were recorded for control-device handoff and review.",
      },
      autoDriveSummary: expect.arrayContaining([
        "Destination: Close the observe loop",
        "Active waypoint: Route mission targets into review detail",
      ]),
    });
  });

  it("disables accept and reject when runtime evidence is incomplete", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Audit runtime review evidence",
          objective: "Audit runtime review evidence",
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
          title: "Audit runtime review evidence",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
          reviewDecision: {
            status: "pending" as const,
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "incomplete_evidence" as const,
          evidenceState: "incomplete" as const,
          validationOutcome: "unknown" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Collect the missing runtime evidence before deciding.",
          createdAt: 10,
          reviewDecision: {
            status: "pending" as const,
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "accept",
          enabled: false,
          disabledReason:
            "Runtime evidence is incomplete. Collect the missing review pack evidence before accepting or rejecting this result.",
          actionTarget: null,
        }),
        expect.objectContaining({
          id: "reject",
          enabled: false,
          disabledReason:
            "Runtime evidence is incomplete. Collect the missing review pack evidence before accepting or rejecting this result.",
          actionTarget: null,
        }),
      ])
    );
  });

  it("keeps review sections empty when runtime does not publish review-pack context", () => {
    const projection = asMissionControlSnapshot({
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
          title: "Review runtime-only evidence",
          objective: "Review runtime-only evidence",
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
          title: "Review runtime-only evidence",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
          },
          routing: {
            backendId: "backend-review-a",
            provider: "openai",
            providerLabel: "OpenAI",
            pool: "pool-review",
            routeLabel: "Workspace default backend",
            routeHint: "Resolved through backend-review-a.",
            health: "ready" as const,
            enabledAccountCount: 1,
            readyAccountCount: 1,
            enabledPoolCount: 1,
          },
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept or reject the result.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail).toMatchObject({
      assumptions: [],
      reproductionGuidance: [],
      rollbackGuidance: [],
      backendAudit: {
        summary: "Runtime backend audit unavailable",
        details: [],
        missingReason: "The runtime did not publish backend audit details for this review pack.",
      },
    });
  });

  it("keeps follow-up intervention actions available for a runtime-managed review pack in review detail", () => {
    const projection = asMissionControlSnapshot({
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
          id: "runtime-task:run-1",
          workspaceId: "workspace-1",
          title: "Runtime-owned review pack",
          objective: "Review runtime-owned evidence",
          origin: {
            kind: "run" as const,
            threadId: null,
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
          taskId: "runtime-task:run-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Runtime-owned review pack",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          executionProfile: {
            id: "balanced-delegate",
            name: "Balanced Delegate",
          },
          routing: {
            backendId: "backend-review-a",
          },
          intervention: {
            primaryAction: "retry" as const,
            actions: [
              {
                action: "retry" as const,
                label: "Retry",
                enabled: true,
                supported: true,
                reason: null,
              },
              {
                action: "continue_with_clarification" as const,
                label: "Clarify",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
          },
          reviewPackId: "review-pack:run-1",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "runtime-task:run-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review the result.",
          createdAt: 10,
        },
      ],
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection: resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
        }),
      })
    );

    expect(detail.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "retry",
          enabled: true,
          disabledReason: null,
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "runtime-task:run-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            limitation: "thread_unavailable",
          },
          interventionDraft: expect.objectContaining({
            intent: "retry",
            profileId: "balanced-delegate",
            preferredBackendIds: ["backend-review-a"],
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "clarify",
          enabled: true,
          disabledReason: null,
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "runtime-task:run-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            limitation: "thread_unavailable",
          },
          interventionDraft: expect.objectContaining({
            intent: "clarify",
            profileId: "balanced-delegate",
            preferredBackendIds: ["backend-review-a"],
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
      ])
    );
  });

  it("exposes failure class, relaunch options, publish handoff, and sub-agent summary from a review pack", () => {
    const projection = asMissionControlSnapshot({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 100,
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
          title: "Stabilize UI preview",
          objective: "Stabilize UI preview",
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
          title: "Stabilize UI preview",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-1",
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "action_required" as const,
          evidenceState: "incomplete" as const,
          validationOutcome: "failed" as const,
          warningCount: 1,
          warnings: ["Runtime warning"],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Review and retry.",
          createdAt: 10,
          failureClass: "runtime_failed",
          relaunchOptions: {
            sourceRunId: "run-1",
            summary: "Retry with updated context.",
            primaryAction: "continue_with_clarification",
            recommendedActions: ["continue_with_clarification"],
            availableActions: [
              {
                action: "continue_with_clarification",
                label: "Clarify",
                enabled: false,
                supported: true,
                reason: "Waiting for operator notes.",
              },
              {
                action: "escalate_to_pair_mode",
                label: "Continue in pair",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
          },
          subAgentSummary: [
            {
              sessionId: "agent-1",
              parentRunId: "run-1",
              scopeProfile: "review",
              status: "blocked",
              approvalState: "pending",
              checkpointState: "awaiting",
              summary: "Sub-agent blocked by approval.",
              timedOutReason: null,
              interruptedReason: null,
            },
          ],
          publishHandoff: {
            summary: "Publish handoff ready",
            details: ["detail"],
            handoff: {
              publish: {
                branchName: "main",
              },
              reviewDraft: {
                title: "Publish",
                body: "Draft body",
                checklist: ["Confirm validations", "Inspect diff"],
              },
              operatorCommands: ["gh pr create --draft", "gh pr view --web"],
            },
          },
        },
      ],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:run-1",
        source: "home",
      },
    });
    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection,
      })
    );

    expect(detail.failureClass).toBe("runtime_failed");
    expect(detail.failureClassLabel).toBe("Runtime failure");
    expect(detail.failureClassSummary).toBe(
      "The runtime experienced an unexpected error while executing the mission."
    );
    expect(detail.relaunchOptions).toEqual([
      {
        id: "clarify",
        label: "Clarify",
        detail: "Retry with updated context.",
        enabled: false,
        disabledReason: "Waiting for operator notes.",
      },
      {
        id: "continue_in_pair",
        label: "Continue in pair",
        detail: "Retry with updated context.",
        enabled: true,
        disabledReason: null,
      },
    ]);
    expect(detail.publishHandoff?.branchName).toBe("main");
    expect(detail.publishHandoff?.reviewTitle).toBe("Publish");
    expect(detail.publishHandoff?.reviewBody).toBe("Draft body");
    expect(detail.publishHandoff?.reviewChecklist).toEqual(["Confirm validations", "Inspect diff"]);
    expect(detail.publishHandoff?.operatorCommands).toEqual([
      "gh pr create --draft",
      "gh pr view --web",
    ]);
    expect(detail.subAgentSummary[0].status).toBe("blocked");
  });

  it("includes run-level sub-agent summaries when no review pack is selected", () => {
    const projection = asMissionControlSnapshot({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 100,
      workspaces: [
        {
          id: "workspace-2",
          name: "Workspace Two",
          rootPath: "/tmp/workspace-two",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-2",
          workspaceId: "workspace-2",
          title: "Audit runtime",
          objective: "Audit runtime",
          origin: {
            kind: "run" as const,
            threadId: null,
            runId: "run-2",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "failed" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-2",
          latestRunState: "failed" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-2",
          taskId: "task-2",
          workspaceId: "workspace-2",
          state: "failed" as const,
          title: "Audit runtime",
          summary: "Runtime failure recorded.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: null,
          subAgentSummary: [
            {
              sessionId: "agent-2",
              parentRunId: "run-2",
              scopeProfile: "review",
              status: "timed_out",
              approvalState: "pending",
              checkpointState: "awaiting",
              summary: "Sub-agent timed out",
              timedOutReason: "Too long",
              interruptedReason: null,
            },
          ],
        },
      ],
      reviewPacks: [],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-2",
      request: {
        workspaceId: "workspace-2",
        runId: "run-2",
        source: "home",
      },
    });
    const detail = buildReviewPackDetailModel({
      projection,
      selection,
    });

    expect(detail?.kind).toBe("mission_run");
    if (detail && detail.kind === "mission_run") {
      expect(detail.subAgentSummary[0].sessionId).toBe("agent-2");
      expect(detail.subAgentSummary[0].timedOutReason).toBe("Too long");
    }
  });

  it("prefers runtime mission linkage and actionability for review-pack continuity", () => {
    const projection = asMissionControlSnapshot({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 100,
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
          id: "runtime-task:run-9",
          workspaceId: "workspace-1",
          title: "Recover a blocked follow-up",
          objective: "Recover a blocked follow-up",
          origin: {
            kind: "thread" as const,
            threadId: "thread-legacy",
            runId: "run-9",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 100,
          currentRunId: null,
          latestRunId: "run-9",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-9",
          taskId: "runtime-task:run-9",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Recover a blocked follow-up",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 90,
          updatedAt: 100,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-9",
          missionLinkage: {
            workspaceId: "workspace-1",
            taskId: "runtime-task:run-9",
            runId: "run-9",
            reviewPackId: "review-pack:run-9",
            missionTaskId: "runtime-task:run-9",
            taskEntityKind: "run" as const,
            recoveryPath: "run" as const,
            navigationTarget: {
              kind: "run" as const,
              workspaceId: "workspace-1",
              taskId: "runtime-task:run-9",
              runId: "run-9",
              reviewPackId: "review-pack:run-9",
            },
            summary: "Resume from the runtime-published mission detail.",
          },
          actionability: {
            state: "blocked" as const,
            summary: "Runtime blocked follow-up until validation evidence is repaired.",
            degradedReasons: ["Validation evidence is missing."],
            actions: [],
          },
          publishHandoff: {
            jsonPath: ".hugecode/runs/run-9/publish/handoff.json",
            markdownPath: ".hugecode/runs/run-9/publish/handoff.md",
            summary: "Publish handoff is ready for another control device.",
            branchName: "main",
            reviewTitle: "Recover blocked follow-up",
            details: ["handoff detail"],
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-9",
          runId: "run-9",
          taskId: "runtime-task:run-9",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Local fallback next action.",
          createdAt: 100,
        },
      ],
    });

    const selection = resolveReviewPackSelection({
      projection,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:run-9",
        source: "home",
      },
    });

    const detail = requireReviewPackDetail(
      buildReviewPackDetailModel({
        projection,
        selection,
      })
    );

    expect(detail.navigationTarget).toEqual({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task:run-9",
      runId: "run-9",
      reviewPackId: "review-pack:run-9",
      threadId: "thread-legacy",
      limitation: null,
    });
    expect(detail.recommendedNextAction).toBe(
      "Open Review Pack and resolve the runtime-blocked follow-up before continuing."
    );
    expect(detail.continuity).toMatchObject({
      state: "blocked",
      summary: "Runtime blocked follow-up until validation evidence is repaired.",
      blockingReason: "Runtime blocked follow-up until validation evidence is repaired.",
    });
    expect(detail.continuity?.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Canonical continue path: /)])
    );
    expect(detail.continuity?.details).toContain(
      "Publish handoff is ready for another control device."
    );
  });
});
