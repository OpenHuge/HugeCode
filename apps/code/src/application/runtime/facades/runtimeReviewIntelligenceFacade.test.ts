import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RuntimeAgentTaskInterventionResult,
  RuntimeAgentTaskSummary,
} from "../types/webMcpBridge";
import * as runtimeSkillsPort from "../ports/tauriRuntimeSkills";
import * as workspaceFilesPort from "../ports/tauriWorkspaceFiles";
import { parseRepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import {
  applyReviewAutofix,
  readWorkspaceSkillCatalog,
  resolveReviewIntelligenceSummary,
  resolveReviewProfileDefaults,
  runReviewAgent,
} from "./runtimeReviewIntelligenceFacade";

function createContract() {
  return parseRepositoryExecutionContract(
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
          executionProfileId: "autonomous-delegate",
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
  );
}

describe("runtimeReviewIntelligenceFacade", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads workspace skill manifests and resolves runtime availability", async () => {
    vi.spyOn(workspaceFilesPort, "listWorkspaceFileEntries").mockResolvedValue([
      {
        id: ".hugecode/skills/review-agent/manifest.json",
        path: ".hugecode/skills/review-agent/manifest.json",
        summary: "review-agent manifest",
      },
      {
        id: ".hugecode/skills/repo-policy-check/manifest.json",
        path: ".hugecode/skills/repo-policy-check/manifest.json",
        summary: "repo-policy-check manifest",
      },
    ] as never);
    vi.spyOn(workspaceFilesPort, "readWorkspaceFile").mockImplementation(
      async (_workspaceId: string, fileId: string) =>
        ({
          id: fileId,
          path: fileId,
          summary: fileId,
          content:
            fileId === ".hugecode/skills/review-agent/manifest.json"
              ? JSON.stringify({
                  schema_version: "skills_source_manifest.v1",
                  id: "review-agent",
                  name: "Review Agent",
                  version: "1.0.0",
                  kind: "skill",
                  publisher: { name: "HugeCode" },
                  trust_level: "local",
                  signature: "unsigned-local-manifest",
                  entrypoint: "review-agent",
                  permissions: ["workspace:read", "runtime:review"],
                  compatibility: {
                    min_runtime: "1.0.0",
                    min_app: "1.0.0",
                  },
                })
              : JSON.stringify({
                  schema_version: "skills_source_manifest.v1",
                  id: "repo-policy-check",
                  name: "Repository Policy Check",
                  version: "1.0.0",
                  kind: "skill",
                  publisher: { name: "HugeCode" },
                  trust_level: "local",
                  signature: "unsigned-local-manifest",
                  entrypoint: "repo-policy-check",
                  permissions: ["workspace:read", "policy:review"],
                  compatibility: {
                    min_runtime: "1.0.0",
                    min_app: "1.0.0",
                  },
                }),
        }) as never
    );
    vi.spyOn(runtimeSkillsPort, "listRuntimeLiveSkills").mockResolvedValue([
      {
        id: "review-agent",
        name: "Review Agent",
        description: "Structured review",
        kind: "research_orchestration",
        source: "workspace",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["review"],
      },
    ] as never);

    const catalog = await readWorkspaceSkillCatalog("ws-1", createContract());

    expect(catalog).toHaveLength(2);
    expect(catalog[0]).toMatchObject({
      id: "repo-policy-check",
      availableInRuntime: false,
      enabledInRuntime: false,
      recommendedFor: ["review", "delegate"],
    });
    expect(catalog[0]?.issues).toContain("Runtime live skill is unavailable for this workspace.");
    expect(catalog[1]).toMatchObject({
      id: "review-agent",
      availableInRuntime: true,
      enabledInRuntime: true,
      runtimeSkillId: "review-agent",
    });
  });

  it("resolves review profile defaults with explicit overrides ahead of runtime and repo defaults", () => {
    const resolved = resolveReviewProfileDefaults({
      contract: createContract(),
      taskSource: { kind: "github_issue", title: "Issue review" },
      explicitReviewProfileId: "default-review",
      runtimeReviewProfileId: "issue-review",
      explicitValidationPresetId: "standard",
      runtimeValidationPresetId: "review-first",
    });

    expect(resolved).toMatchObject({
      reviewProfileId: "default-review",
      validationPresetId: "standard",
      reviewProfileFieldOrigin: "explicit_override",
      validationPresetFieldOrigin: "explicit_override",
    });
  });

  it("builds a canonical review intelligence summary from repo policy and runtime review fields", () => {
    const summary = resolveReviewIntelligenceSummary({
      contract: createContract(),
      taskSource: { kind: "github_issue", title: "Issue review" },
      run: {
        reviewProfileId: "issue-review",
        executionProfile: {
          validationPresetId: "review-first",
        },
        reviewGate: {
          state: "warn",
          summary: "Review found follow-up work before acceptance.",
          highestSeverity: "warning",
          findingCount: 1,
        },
        reviewFindings: [
          {
            id: "finding-1",
            title: "Tighten repo policy validation",
            severity: "warning",
            category: "repo_policy_mismatch",
            summary: "The delegated run skipped a repository policy check.",
            confidence: "high",
          },
        ],
        reviewRunId: "review-run-1",
        skillUsage: [
          {
            skillId: "review-agent",
            name: "Review Agent",
            status: "used",
            recommendedFor: ["review"],
            summary: "Structured review completed.",
          },
        ],
        autofixCandidate: {
          id: "autofix-1",
          summary: "Restore the repository policy check and rerun validation.",
          status: "available",
        },
      } as never,
      recommendedNextAction: "Inspect the review evidence before accepting the result.",
    });

    expect(summary).toMatchObject({
      reviewProfileId: "issue-review",
      reviewProfileLabel: "Issue Review",
      validationPresetId: "review-first",
      validationPresetLabel: "Review first",
      allowedSkillIds: ["review-agent", "repo-policy-check"],
      autofixPolicy: "manual",
      reviewRunId: "review-run-1",
      blockedReason: null,
      nextRecommendedAction: "Apply the bounded autofix or relaunch with the recorded findings.",
    });
    expect(summary?.skillUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: "review-agent",
          status: "used",
        }),
        expect.objectContaining({
          skillId: "repo-policy-check",
          status: "suggested",
        }),
      ])
    );
  });

  it("starts a review agent task with repo-derived review defaults", async () => {
    const startTask = vi.fn(
      async (): Promise<RuntimeAgentTaskSummary> => ({
        taskId: "review-task-1",
        workspaceId: "ws-1",
        threadId: null,
        title: "Review: Fix review defaults",
        status: "queued",
        accessMode: "read-only",
        distributedStatus: null,
        currentStep: null,
        createdAt: 1,
        updatedAt: 1,
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        checkpointId: null,
        traceId: null,
        recovered: null,
      })
    );

    await runReviewAgent({
      runtimeControl: { startTask },
      workspaceId: "ws-1",
      repositoryExecutionContract: createContract(),
      taskSource: {
        kind: "github_issue",
        title: "Issue review",
        sourceTaskId: "runtime-task:42",
        sourceRunId: "run-42",
      },
      run: {
        id: "run-42",
        taskId: "runtime-task:42",
        workspaceId: "ws-1",
        state: "review_ready",
        title: "Fix review defaults",
        summary: "Delegated run is ready for review.",
        startedAt: 1,
        finishedAt: 2,
        updatedAt: 3,
        currentStepIndex: 0,
        warnings: ["Validation evidence is partial."],
        validations: [],
        artifacts: [],
        changedPaths: ["apps/code/src/example.ts"],
        reviewProfileId: null,
      } as never,
    });

    expect(startTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        reviewProfileId: "issue-review",
        validationPresetId: "review-first",
        accessMode: "read-only",
        instruction: expect.stringContaining("Produce structured review findings"),
      })
    );
  });

  it("routes bounded autofix through task intervention", async () => {
    const interveneTask = vi.fn(
      async (): Promise<RuntimeAgentTaskInterventionResult> => ({
        accepted: true,
        action: "retry" as const,
        taskId: "runtime-task:42",
        status: "running" as const,
        outcome: "submitted" as const,
        spawnedTaskId: null,
        checkpointId: null,
      })
    );

    await applyReviewAutofix({
      runtimeControl: { interveneTask },
      taskId: "runtime-task:42",
      autofixCandidate: {
        id: "autofix-1",
        summary: "Tighten the validation command and rerun the review pass.",
        status: "available",
      },
    });

    expect(interveneTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "runtime-task:42",
        action: "retry",
        instructionPatch: expect.stringContaining("bounded autofix candidate"),
      })
    );
  });
});
