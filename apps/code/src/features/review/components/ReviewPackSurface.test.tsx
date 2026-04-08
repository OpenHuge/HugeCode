// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import { launchReviewInterventionDraft } from "../../app/hooks/reviewInterventionLauncher";
import { ReviewPackSurface } from "./ReviewPackSurface";

vi.mock("../../shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

function buildEmptyReviewMetadata() {
  return {
    reviewProfileId: null,
    reviewGate: null,
    reviewFindings: [],
    reviewRunId: null,
    skillUsage: [],
    autofixCandidate: null,
  };
}

const runtimeRecordedFieldOrigins = {
  executionProfileId: "explicit_override",
  preferredBackendIds: "explicit_override",
  accessMode: "runtime_recorded",
  reviewProfileId: "runtime_recorded",
  validationPresetId: "runtime_recorded",
} as const;

const missionReviewDefaults = {
  reviewProfileId: null,
  reviewGate: null,
  reviewFindings: [],
  reviewRunId: null,
  skillUsage: [],
  autofixCandidate: null,
};

const reviewPackDecisionActionabilityDefaults = {
  summary: "Runtime review decision actions use fixture defaults in this test.",
  details: ["Decision source: test fixture defaults."],
  sourceLabel: "Test fixture defaults",
  usesFallback: true,
};

function buildPlacementEvidence(input: { summary: string; rationale: string }) {
  return {
    summary: input.summary,
    lifecycleState: "confirmed" as const,
    resolutionSource: "workspace_default" as const,
    requestedBackendIds: ["backend-review-a"],
    resolvedBackendId: "backend-review-a",
    readiness: "ready" as const,
    healthSummary: "placement_ready" as const,
    attentionReasons: [],
    rationale: input.rationale,
  };
}

function buildInterventionDraft(input: {
  intent: "retry" | "clarify" | "switch_profile" | "pair_mode";
  title: string;
  instruction: string;
  profileId: string;
  preferredBackendIds: string[];
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId: string | null;
}) {
  return {
    ...input,
    reviewProfileId: null,
    validationPresetId: null,
    accessMode: null,
    taskSource: null,
    fieldOrigins: runtimeRecordedFieldOrigins,
  };
}

const blockedContinuityDefaults = {
  truthSourceLabel: "Runtime published continuity truth",
  continuePathLabel: "Mission run",
  canSafelyContinue: false,
  hasHandoffPath: true,
  reviewFollowUpActionable: false,
  checkpointDurabilityState: "blocked",
  continuityOverview:
    "Continuity readiness blocked. Safe continue path unavailable. Handoff path available. Review follow-up blocked. Checkpoint durability blocked.",
} as const;

describe("ReviewPackSurface", () => {
  it("renders structured review intelligence with a workspace skill catalog surface", () => {
    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "review-pack:skill-catalog",
            taskId: "task-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            title: "Review skill catalog",
            summary: "Inspect the operator-facing review truth.",
            createdAt: Date.now() - 30_000,
            state: "reviewReady",
            validationOutcome: "passed",
            warningCount: 0,
            recommendedNextAction: "Inspect the bounded autofix before approval.",
            navigationTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack:skill-catalog",
              limitation: null,
            },
            secondaryLabel: null,
            evidenceLabel: "Confirmed evidence",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:skill-catalog",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:skill-catalog",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          id: "review-pack:skill-catalog",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Review skill catalog",
          runId: "run-1",
          runTitle: "Review skill catalog",
          summary: "Inspect the operator-facing review truth.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "ready",
          reviewStatusLabel: "Ready",
          evidenceState: "confirmed",
          evidenceLabel: "Confirmed evidence",
          validationOutcome: "passed",
          validationLabel: "Passed",
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Inspect the bounded autofix before approval.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:skill-catalog",
            limitation: null,
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          continuity: null,
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:skill-catalog",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          reviewIntelligence: {
            summary: "Review profile is active and the bounded autofix is available for approval.",
            blockedReason: null,
            nextRecommendedAction: "Approve the bounded autofix or continue with manual follow-up.",
            reviewProfileId: "issue-review",
            reviewProfileLabel: "Issue Review",
            reviewProfileDescription: "Issue-driven review profile",
            sourceMappingKind: "github_issue",
            reviewProfileFieldOrigin: "repo_source_mapping",
            validationPresetId: "review-first",
            validationPresetLabel: "Review first",
            validationCommands: ["pnpm validate:fast"],
            validationPresetFieldOrigin: "repo_source_mapping",
            allowedSkillIds: ["review-agent"],
            autofixPolicy: "bounded",
            githubMirrorPolicy: "summary",
            reviewGate: {
              state: "warn",
              summary: "Review found one follow-up before acceptance.",
              highestSeverity: "warning",
              findingCount: 1,
            },
            reviewFindings: [],
            reviewRunId: "review-run-1",
            skillUsage: [],
            autofixCandidate: {
              id: "autofix-1",
              summary: "Restore the skipped validation command.",
              status: "available",
            },
          },
          reviewProfileId: "issue-review",
          reviewGate: {
            state: "warn",
            summary: "Review found one follow-up before acceptance.",
            highestSeverity: "warning",
            findingCount: 1,
          },
          reviewFindings: [],
          reviewRunId: "review-run-1",
          skillUsage: [],
          autofixCandidate: {
            id: "autofix-1",
            summary: "Restore the skipped validation command.",
            status: "available",
          },
          provenanceSummary: null,
          backendAudit: {
            summary: "Runtime backend audit unavailable.",
            details: [],
            missingReason: "No route evidence was published.",
          },
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          governance: undefined,
          operatorSnapshot: undefined,
          placement: undefined,
          workspaceEvidence: undefined,
          sourceProvenance: undefined,
          lineage: undefined,
          ledger: undefined,
          checkpoint: undefined,
          executionContext: undefined,
          missionBrief: undefined,
          relaunchContext: undefined,
          compactEvidenceInput: null,
          decisionActions: [],
          limitations: [],
          relaunchOptions: [],
          subAgentSummary: [],
          emptySectionLabels: {
            assumptions: "No assumptions recorded.",
            warnings: "No warnings recorded.",
            validations: "No validations recorded.",
            artifacts: "No artifacts recorded.",
            reproduction: "No reproduction guidance recorded.",
            rollback: "No rollback guidance recorded.",
          },
        }}
        workspaceSkillCatalogState={{
          status: "ready",
          error: null,
          entries: [
            {
              id: "review-agent",
              name: "Review Agent",
              version: "1.0.0",
              trustLevel: "local",
              kind: "skill",
              entrypoint: "review-agent",
              permissions: ["workspace:read", "runtime:review"],
              compatibility: {
                minRuntime: "1.0.0",
                maxRuntime: null,
                minApp: "1.0.0",
                maxApp: null,
              },
              recommendedFor: ["review", "delegate"],
              manifestPath: ".hugecode/skills/review-agent/manifest.json",
              availableInRuntime: false,
              enabledInRuntime: false,
              runtimeReadiness: "unavailable",
              runtimeReadinessReason: "Runtime live skill is unavailable for this workspace.",
              runtimeSkillId: null,
              reviewProfileIds: ["issue-review"],
              reviewProfileLabels: ["Issue Review"],
              issues: ["Runtime live skill is unavailable for this workspace."],
            },
          ],
        }}
        onApplyReviewAutofix={async () => undefined}
        onSelectReviewPack={() => undefined}
      />
    );

    expect(screen.getByText("Review intelligence")).toBeTruthy();
    expect(screen.getByText("Workspace skill catalog")).toBeTruthy();
    expect(screen.getByText(/Review profiles: Issue Review/)).toBeTruthy();
    expect(
      screen.getAllByText(/Runtime live skill is unavailable for this workspace/).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Operator approval required")).toBeTruthy();
  });

  it("shows a manual-ready bounded autofix preview and approval action inside Review Pack", async () => {
    const onApplyReviewAutofix = vi.fn(async () => undefined);

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:autofix-ready",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:autofix-ready",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          id: "review-pack:autofix-ready",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Review autofix readiness",
          runId: "run-1",
          runTitle: "Review autofix readiness",
          summary: "Runtime published a bounded autofix that still requires manual approval.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "action_required",
          reviewStatusLabel: "Action required",
          evidenceState: "confirmed",
          evidenceLabel: "Confirmed evidence",
          validationOutcome: "warning",
          validationLabel: "Validation warning",
          warningCount: 1,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Approve the bounded autofix from Review Pack.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:autofix-ready",
            limitation: null,
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          continuity: null,
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:autofix-ready",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          reviewIntelligence: {
            summary: "Runtime published a manual-ready bounded autofix.",
            blockedReason: null,
            nextRecommendedAction: "Approve the bounded autofix from Review Pack.",
            reviewProfileId: "issue-review",
            reviewProfileLabel: "Issue Review",
            reviewProfileDescription: null,
            sourceMappingKind: "github_issue",
            reviewProfileFieldOrigin: "repo_source_mapping",
            validationPresetId: "review-first",
            validationPresetLabel: "Review first",
            validationCommands: ["pnpm validate:fast"],
            validationPresetFieldOrigin: "repo_source_mapping",
            allowedSkillIds: ["review-agent"],
            autofixPolicy: "bounded",
            githubMirrorPolicy: "summary",
            reviewGate: {
              state: "warn",
              summary: "Review found one bounded follow-up before acceptance.",
              highestSeverity: "warning",
              findingCount: 1,
            },
            reviewFindings: [],
            reviewRunId: "review-run-1",
            skillUsage: [],
            autofixCandidate: {
              id: "autofix-1",
              summary: "Restore the skipped validation command.",
              status: "available",
            },
          },
          reviewProfileId: "issue-review",
          reviewGate: {
            state: "warn",
            summary: "Review found one bounded follow-up before acceptance.",
            highestSeverity: "warning",
            findingCount: 1,
          },
          reviewFindings: [],
          reviewRunId: "review-run-1",
          skillUsage: [],
          autofixCandidate: {
            id: "autofix-1",
            summary: "Restore the skipped validation command.",
            status: "available",
          },
          provenanceSummary: null,
          backendAudit: {
            summary: "Runtime backend audit unavailable.",
            details: [],
            missingReason: null,
          },
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          governance: undefined,
          operatorSnapshot: undefined,
          placement: undefined,
          workspaceEvidence: undefined,
          sourceProvenance: undefined,
          lineage: undefined,
          ledger: undefined,
          checkpoint: undefined,
          executionContext: undefined,
          missionBrief: undefined,
          relaunchContext: undefined,
          compactEvidenceInput: null,
          decisionActions: [],
          limitations: [],
          relaunchOptions: [],
          subAgentSummary: [],
          emptySectionLabels: {
            assumptions: "No assumptions recorded.",
            warnings: "No warnings recorded.",
            validations: "No validations recorded.",
            artifacts: "No artifacts recorded.",
            reproduction: "No reproduction guidance recorded.",
            rollback: "No rollback guidance recorded.",
          },
        }}
        workspaceSkillCatalogState={{
          status: "ready",
          error: null,
          entries: [],
        }}
        onApplyReviewAutofix={onApplyReviewAutofix}
        onSelectReviewPack={() => undefined}
      />
    );

    expect(screen.getByText("Manual proposal preview")).toBeTruthy();
    expect(screen.getByText("Next step: Approve bounded autofix from Review Pack.")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve bounded autofix" }));
    });

    expect(onApplyReviewAutofix).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:autofix-ready",
      autofixCandidate: {
        id: "autofix-1",
        summary: "Restore the skipped validation command.",
        status: "available",
      },
    });
  });

  it("opens the published follow-up path when bounded autofix is blocked", () => {
    const onOpenMissionTarget = vi.fn();

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:autofix-blocked",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:autofix-blocked",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          id: "review-pack:autofix-blocked",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Review autofix blocked",
          runId: "run-1",
          runTitle: "Review autofix blocked",
          summary: "Runtime blocked the bounded autofix until follow-up clears.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "action_required",
          reviewStatusLabel: "Action required",
          evidenceState: "confirmed",
          evidenceLabel: "Confirmed evidence",
          validationOutcome: "warning",
          validationLabel: "Validation warning",
          warningCount: 1,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Open the linked mission follow-up and clear the runtime blocker.",
          navigationTarget: {
            kind: "mission",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:autofix-blocked",
            threadId: "thread-1",
            limitation: null,
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          continuity: null,
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:autofix-blocked",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          reviewIntelligence: {
            summary: "Runtime blocked the bounded autofix until follow-up clears.",
            blockedReason: "Runtime must finish the previous retry first.",
            nextRecommendedAction:
              "Open the linked mission follow-up and clear the runtime blocker.",
            reviewProfileId: "issue-review",
            reviewProfileLabel: "Issue Review",
            reviewProfileDescription: null,
            sourceMappingKind: "github_issue",
            reviewProfileFieldOrigin: "repo_source_mapping",
            validationPresetId: "review-first",
            validationPresetLabel: "Review first",
            validationCommands: ["pnpm validate:fast"],
            validationPresetFieldOrigin: "repo_source_mapping",
            allowedSkillIds: ["review-agent"],
            autofixPolicy: "bounded",
            githubMirrorPolicy: "summary",
            reviewGate: {
              state: "warn",
              summary: "Review follow-up is blocked.",
              highestSeverity: "warning",
              findingCount: 1,
              blockingReason: "Runtime must finish the previous retry first.",
            },
            reviewFindings: [],
            reviewRunId: "review-run-1",
            skillUsage: [],
            autofixCandidate: {
              id: "autofix-1",
              summary: "Restore the skipped validation command.",
              status: "blocked",
              blockingReason: "Runtime must finish the previous retry first.",
            },
          },
          reviewProfileId: "issue-review",
          reviewGate: {
            state: "warn",
            summary: "Review follow-up is blocked.",
            highestSeverity: "warning",
            findingCount: 1,
            blockingReason: "Runtime must finish the previous retry first.",
          },
          reviewFindings: [],
          reviewRunId: "review-run-1",
          skillUsage: [],
          autofixCandidate: {
            id: "autofix-1",
            summary: "Restore the skipped validation command.",
            status: "blocked",
            blockingReason: "Runtime must finish the previous retry first.",
          },
          provenanceSummary: null,
          backendAudit: {
            summary: "Runtime backend audit unavailable.",
            details: [],
            missingReason: null,
          },
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          governance: undefined,
          operatorSnapshot: undefined,
          placement: undefined,
          workspaceEvidence: undefined,
          sourceProvenance: undefined,
          lineage: undefined,
          ledger: undefined,
          checkpoint: undefined,
          executionContext: undefined,
          missionBrief: undefined,
          relaunchContext: undefined,
          compactEvidenceInput: null,
          decisionActions: [],
          limitations: [],
          relaunchOptions: [],
          subAgentSummary: [],
          emptySectionLabels: {
            assumptions: "No assumptions recorded.",
            warnings: "No warnings recorded.",
            validations: "No validations recorded.",
            artifacts: "No artifacts recorded.",
            reproduction: "No reproduction guidance recorded.",
            rollback: "No rollback guidance recorded.",
          },
        }}
        workspaceSkillCatalogState={{
          status: "ready",
          error: null,
          entries: [],
        }}
        onSelectReviewPack={() => undefined}
        onOpenMissionTarget={onOpenMissionTarget}
      />
    );

    expect(
      screen.getAllByText("Blocked: Runtime must finish the previous retry first.").length
    ).toBeGreaterThan(0);
    const followUpButton = screen.getByRole("button", { name: "Open follow-up path" });
    fireEvent.click(followUpButton);

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:autofix-blocked",
      threadId: "thread-1",
      limitation: null,
    });
  });

  it("renders evidence-first detail content for a runtime-managed review pack", () => {
    const onSelectReviewPack = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const onSubmitDecisionAction = vi.fn();

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "review-pack:runtime-7",
            taskId: "runtime-task:runtime-7",
            runId: "runtime-7",
            workspaceId: "workspace-1",
            title: "Prepare release notes",
            summary: "Runtime produced a review-ready pack without a thread destination.",
            createdAt: Date.now() - 30_000,
            state: "reviewReady",
            validationOutcome: "unknown",
            warningCount: 1,
            recommendedNextAction: "Inspect the warnings before accepting the result.",
            navigationTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "runtime-task:runtime-7",
              runId: "runtime-7",
              reviewPackId: "review-pack:runtime-7",
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "runtime-task:runtime-7",
            runId: "runtime-7",
            reviewPackId: "review-pack:runtime-7",
            source: "home",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "runtime-task:runtime-7",
          selectedRunId: "runtime-7",
          selectedReviewPackId: "review-pack:runtime-7",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          id: "review-pack:runtime-7",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "runtime-task:runtime-7",
          taskTitle: "Prepare release notes",
          runId: "runtime-7",
          runTitle: "Prepare release notes",
          summary: "Runtime produced a review-ready pack without a thread destination.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "incomplete_evidence",
          reviewStatusLabel: "Evidence incomplete",
          evidenceState: "incomplete",
          evidenceLabel: "Evidence incomplete",
          validationOutcome: "unknown",
          validationLabel: "Validation unavailable",
          ...buildEmptyReviewMetadata(),
          warningCount: 1,
          warnings: ["Validation output was not recorded."],
          validations: [],
          artifacts: [
            {
              id: "trace:runtime-7",
              label: "Trace runtime-7",
              kind: "log",
            },
          ],
          checksPerformed: [],
          recommendedNextAction: "Inspect the warnings before accepting the result.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "runtime-task:runtime-7",
            runId: "runtime-7",
            reviewPackId: "review-pack:runtime-7",
            limitation: "thread_unavailable",
          },
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: "validation_failed",
          failureClassLabel: "Validation failure",
          failureClassSummary: "Validation output failed and requires operator investigation.",
          publishHandoff: {
            summary: "Publish ready for review",
            branchName: "main",
            reviewTitle: "Runtime publish",
            reviewBody: "## Summary\nShip the change.",
            reviewChecklist: ["Confirm validations", "Inspect publish diff"],
            operatorCommands: ["gh pr create --draft", "gh pr view --web"],
            details: ["JSON handoff: .hugecode/runs/runtime-7/publish/handoff.json"],
          },
          assumptions: [
            "No linked mission thread is available, so this review depends on runtime-generated evidence and summaries.",
          ],
          reproductionGuidance: ["Inspect Runtime log at artifact://log/runtime-7."],
          rollbackGuidance: [
            "Use Diff preview as the rollback reference before reverting affected files.",
          ],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:runtime-7",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          provenanceSummary: "Repo guidance: AGENTS.md | Source evidence: GitHub issue #42",
          backendAudit: {
            summary: "Remote provider route",
            details: ["Provider: OpenAI", "Routing health: ready"],
            missingReason: null,
          },
          decisionActionability: {
            summary:
              "Decision availability is using the controlled fallback until canonical runtime review actionability is published.",
            details: [
              "Decision source: Controlled legacy follow-up fallback.",
              "Canonical runtime review actionability has not been published for this run yet.",
            ],
            sourceLabel: "Controlled legacy follow-up fallback",
            usesFallback: true,
          },
          governance: {
            summary:
              "Awaiting review decision: Accept or reject this result from the review surface.",
            details: [
              "Governance state: awaiting_review",
              "Execution is blocked on an operator decision.",
              "Suggested action: review_result",
            ],
          },
          placement: {
            summary: "Runtime confirmed workspace-default placement on backend backend-review-a.",
            details: [
              "Placement lifecycle: confirmed",
              "Placement source: workspace_default",
              "Resolved backend: backend-review-a",
              "Routing readiness: ready",
              "Placement rationale: No explicit backend preference was recorded, so runtime used the default workspace backend.",
              "Backend contract: native via runtime-native",
              "Backend health: active",
            ],
          },
          operatorSnapshot: {
            summary: "OpenAI gpt-5.3-codex is review-ready on backend-review-a.",
            details: ["Runtime: remote sandbox", "Model: gpt-5.3-codex", "Reasoning effort: high"],
            currentActivity: "pnpm validate:fast",
            blocker: null,
            recentEvents: [
              {
                label: "Validation completed",
                detail: "pnpm validate:fast",
                at: Date.now() - 15_000,
              },
            ],
          },
          workspaceEvidence: {
            summary: "Runtime published inspectable workspace evidence for this review.",
            buckets: [
              {
                kind: "changedFiles",
                label: "Changed files",
                summary: "1 file recorded.",
                items: [
                  {
                    label: "apps/code/src/features/review/components/ReviewPackSurface.tsx",
                    detail: "Runtime-recorded changed path",
                    uri: null,
                  },
                ],
                missingReason: null,
              },
              {
                kind: "diffs",
                label: "Diffs",
                summary: "1 diff artifact linked.",
                items: [
                  {
                    label: "Workspace diff",
                    detail: "diff",
                    uri: "mission-control://runs/runtime-7/diff",
                  },
                ],
                missingReason: null,
              },
              {
                kind: "memoryOrNotes",
                label: "Memory and notes",
                summary: "1 runtime note attached.",
                items: [
                  {
                    label: "Mission brief",
                    detail: "Prepare release notes",
                    uri: null,
                  },
                ],
                missingReason: null,
              },
            ],
          },
          executionContext: {
            summary: "Balanced Delegate via backend-review-a",
            details: [
              "Follow-up relaunches inherit the recorded execution profile and backend route until changed by a control device in Mission Control.",
            ],
          },
          sourceProvenance: {
            summary: "PR follow-up started from issue_comment.created in OpenHuge/HugeCode.",
            details: [
              "Source repo: OpenHuge/HugeCode",
              "Source ref: PR #74",
              "GitHub event: issue_comment.created",
              "Source comment: #991 by reviewer",
              "Source record: source-74",
              "Launch handshake: Started",
              "Prepared plan version: plan-v74",
              "Approved plan version: plan-v74",
              "Runtime started the GitHub-driven run after approving the plan.",
              "Next operator action: Review the pack: Confirm the review pack and decide whether to continue.",
            ],
          },
          lineage: {
            summary:
              "Objective, guardrails, and review outcome stayed attached to this runtime-managed mission.",
            details: [
              "Objective: Prepare release notes",
              "Constraints: Do not expand scope beyond release artifacts.",
              "Review decision: pending",
            ],
          },
          ledger: {
            summary:
              "Trace, checkpoint, and routing facts were recorded for control-device handoff and review.",
            details: ["Trace ID: trace-runtime-7", "Warnings recorded: 1", "Artifacts recorded: 1"],
          },
          checkpoint: {
            summary: "Runtime recovered the run from a checkpoint. Resume to continue.",
            details: [
              "Checkpoint state: interrupted",
              "Lifecycle state: interrupted",
              "Checkpoint ID: checkpoint-runtime-7",
              "Trace ID: trace-runtime-7",
              "Runtime recovered this run from a checkpoint.",
              "Resume is ready from another control device.",
            ],
          },
          compactEvidenceInput: {
            source: {
              kind: "github_issue",
              label: "GitHub issue",
              title: "Prepare release notes",
              reference: "#42",
              repo: {
                owner: "ku0",
                name: "hugecode",
                fullName: "ku0/hugecode",
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
            placement: buildPlacementEvidence({
              summary: "Runtime confirmed workspace-default placement on backend-review-a.",
              rationale: "Runtime used the default review backend for this workspace.",
            }),
            missionBrief: {
              objective: "Prepare release notes",
              planVersion: "plan-v3",
              planSummary: "Tighten review evidence.",
            },
            validationOutcome: "unknown",
            evidenceLabel: "Evidence incomplete",
            recommendedNextAction: "Inspect the warnings before accepting the result.",
            nextActionLabel: "Inspect the warnings before accepting the result.",
            nextActionDetail: "Open Review Pack",
          },
          decisionActions: [
            {
              id: "accept",
              label: "Accept result",
              detail:
                "Mark the run as accepted after reviewing evidence, warnings, and rollback posture.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              interventionDraft: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:runtime-7",
                status: "approved",
              },
            },
            {
              id: "reject",
              label: "Reject result",
              detail:
                "Reject this result and send it back for another pass with explicit operator feedback.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              interventionDraft: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:runtime-7",
                status: "rejected",
              },
            },
            {
              id: "retry",
              label: "Retry run",
              detail: "Prepare a retry from the action center with the recorded review context.",
              enabled: true,
              disabledReason: null,
              navigationTarget: {
                kind: "review",
                workspaceId: "workspace-1",
                taskId: "runtime-task:runtime-7",
                runId: "runtime-7",
                reviewPackId: "review-pack:runtime-7",
                limitation: "thread_unavailable",
              },
              interventionDraft: buildInterventionDraft({
                intent: "retry",
                title: "Prepare release notes",
                instruction: "Retry the runtime-managed review task.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "runtime-task:runtime-7",
                sourceRunId: "runtime-7",
                sourceReviewPackId: "review-pack:runtime-7",
              }),
              actionTarget: null,
            },
          ],
          relaunchOptions: [
            {
              id: "retry",
              label: "Retry run",
              detail: "Rerun with additional operator review before re-submitting.",
              enabled: true,
              disabledReason: null,
            },
          ],
          subAgentSummary: [
            {
              sessionId: "session-1",
              parentRunId: "runtime-7",
              delegationScope: "read_safe:review",
              scopeProfile: "review",
              status: "running",
              toolAccessProfile: {
                mode: "read_only",
                summary: "Child tool access is runtime-clamped to read-safe inspection tools.",
                allowedTools: ["read_file", "search_workspace"],
                blockedTools: ["destructive_shell"],
              },
              budgetInheritance: {
                mode: "bounded_subset",
                summary:
                  "Runtime grants each child a bounded slice of the parent budget and blocks budget escalation.",
                inheritedBudgetRatio: 0.35,
                maxRuntimeMinutes: 15,
                maxAutoContinuations: 0,
              },
              knowledgeAccess: {
                mode: "runtime_scoped_read_only",
                summary:
                  "Child sessions receive runtime-scoped recall and projection hints but cannot write durable memory directly.",
                sources: ["runtime_context_projection", "runtime_context_truth"],
              },
              approvalState: "pending",
              checkpointState: "awaiting",
              contextBoundary: {
                boundaryId: "boundary-1",
                trigger: "spawn",
                phase: "spawn",
                status: "active",
              },
              contextProjection: {
                boundaryId: "boundary-1",
                workingSetSummary: "Preserved 2 recent range(s) with 1 offload reference(s).",
                knowledgeItems: [
                  {
                    id: "knowledge:1",
                    kind: "session_recall",
                    scope: "sub_agent",
                    summary:
                      "Runtime compacted delegated context and published 1 recall reference(s).",
                    provenance: ["context_compaction"],
                    confidence: "medium",
                    durable: false,
                  },
                ],
                skillCandidates: [
                  {
                    id: "skill-candidate-1",
                    label: "Runtime review",
                    summary: "Reusable governed delegation pattern.",
                    state: "candidate",
                    source: "sub_agent",
                    evidence: ["status:completed"],
                  },
                ],
              },
              resultSummary: {
                summary: "Delegated session finished with runtime-published evidence.",
                artifacts: ["runtime://sub-agent/session-1/context-summary"],
                nextAction: "Merge the delegated result back into the parent run summary.",
              },
              failureClass: "none",
              summary: "Sub-agent running and waiting for approval.",
              timedOutReason: null,
              interruptedReason: null,
            },
          ],
          limitations: [
            "This review pack was produced by a runtime-managed task without a thread detail view yet.",
            "Runtime evidence is incomplete. Review the available checks before accepting the result.",
          ],
          emptySectionLabels: {
            assumptions: "The runtime did not record explicit review assumptions for this pack.",
            warnings: "The runtime did not record any warnings for this review pack.",
            validations: "Validation evidence was not recorded for this run.",
            artifacts: "No artifacts or evidence references were attached to this review pack.",
            reproduction:
              "The runtime did not record reproduction guidance for this review pack. Re-run the linked validations or inspect attached evidence.",
            rollback:
              "The runtime did not record rollback guidance for this review pack. Use diff evidence or reopen the mission thread before reverting changes.",
          },
        }}
        freshness={{
          status: "ready",
          isStale: false,
          error: null,
          lastUpdatedAt: Date.now(),
        }}
        onSelectReviewPack={onSelectReviewPack}
        onOpenMissionTarget={onOpenMissionTarget}
        onSubmitDecisionAction={onSubmitDecisionAction}
      />
    );

    expect(screen.getByTestId("review-pack-surface")).toBeTruthy();
    expect(screen.getByText("Review Pack")).toBeTruthy();
    expect(screen.getByText("Review evidence snapshot")).toBeTruthy();
    const compactEvidence = screen.getByTestId("review-pack-compact-evidence");
    expect(within(compactEvidence).getByText("Quick decision evidence")).toBeTruthy();
    expect(within(compactEvidence).getByText("Projected fallback")).toBeTruthy();
    expect(within(compactEvidence).getByText("Plan plan-v3")).toBeTruthy();
    expect(
      compactEvidence.compareDocumentPosition(
        screen.getByText("Assumptions and inferred context")
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getAllByText("Operator cockpit").length).toBeGreaterThan(0);
    expect(screen.getByText("Control-device handoff")).toBeTruthy();
    expect(screen.getAllByText("Execution trajectory").length).toBeGreaterThan(0);
    expect(screen.getByText("Validation unavailable")).toBeTruthy();
    expect(screen.getByText("Artifacts and evidence")).toBeTruthy();
    expect(screen.getByText("Trace runtime-7 | log")).toBeTruthy();
    expect(screen.getByText("Assumptions and inferred context")).toBeTruthy();
    expect(screen.getByText("Reproduction guidance")).toBeTruthy();
    expect(screen.getByText("Rollback guidance")).toBeTruthy();
    expect(screen.getByText("Backend audit")).toBeTruthy();
    expect(screen.getByText("Execution context")).toBeTruthy();
    expect(screen.getByText("Source provenance")).toBeTruthy();
    expect(screen.getByText("Governance and approval")).toBeTruthy();
    expect(screen.getByText("Placement evidence")).toBeTruthy();
    expect(screen.getByText("Run operator")).toBeTruthy();
    expect(screen.getByText("Workspace evidence")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show changed files" })).toBeTruthy();
    expect(screen.getByText("Mission lineage")).toBeTruthy();
    expect(screen.getByText("Run ledger")).toBeTruthy();
    expect(screen.getAllByText("Checkpoint and handoff").length).toBeGreaterThan(0);
    expect(screen.getByText("Balanced Delegate via backend-review-a")).toBeTruthy();
    expect(screen.getAllByText(/pnpm validate:fast/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/apps\/code\/src\/features\/review\/components\/ReviewPackSurface\.tsx/)
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        "Runtime confirmed workspace-default placement on backend backend-review-a."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Awaiting review decision: Accept or reject this result from the review surface."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Objective, guardrails, and review outcome stayed attached to this runtime-managed mission."
      )
    ).toBeTruthy();
    expect(
      screen.getAllByText("Runtime recovered the run from a checkpoint. Resume to continue.").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Resume is ready from another control device.")).toBeTruthy();
    expect(screen.getAllByText("Trace ID: trace-runtime-7").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Follow-up relaunches inherit the recorded execution profile and backend route until changed by a control device in Mission Control."
      )
    ).toBeTruthy();
    expect(
      screen.getByText("PR follow-up started from issue_comment.created in OpenHuge/HugeCode.")
    ).toBeTruthy();
    expect(screen.getByText("Source comment: #991 by reviewer")).toBeTruthy();
    expect(screen.getByText("Review decision")).toBeTruthy();
    expect(screen.getByText("Review decisions and follow-up")).toBeTruthy();
    expect(screen.getByText("Remote provider route")).toBeTruthy();
    expect(screen.getByText("Decision source: Controlled legacy follow-up fallback")).toBeTruthy();
    expect(
      screen.getByText(
        "Decision availability is using the controlled fallback until canonical runtime review actionability is published."
      )
    ).toBeTruthy();
    expect(screen.getAllByText("Decision pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Accept or reject this result from the review surface.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prepare retry draft" })).toBeTruthy();
    expect(
      screen.getByText(
        "This review pack was produced by a runtime-managed task without a thread detail view yet."
      )
    ).toBeTruthy();
    expect(screen.getAllByText("Validation failure").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Publish ready for review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Branch: main").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gh pr create --draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirm validations").length).toBeGreaterThan(0);
    expect(screen.getByText("Source and runtime lineage")).toBeTruthy();
    expect(
      screen.getByText(
        /Repo guidance: AGENTS\.md \| Source evidence: GitHub issue #42 \| Runtime confirmed workspace-default placement on backend backend-review-a\. \| Objective, guardrails, and review outcome stayed attached to this runtime-managed mission\./
      )
    ).toBeTruthy();
    expect(
      screen.getAllByText("Thread detail is unavailable in this runtime snapshot.").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Relaunch options")).toBeTruthy();
    expect(screen.getByText("Sub-agent supervision")).toBeTruthy();
    expect(screen.getByText("Sub-agent running and waiting for approval.")).toBeTruthy();
    expect(
      screen.getByText("Delegated session finished with runtime-published evidence.")
    ).toBeTruthy();
    expect(
      screen.getByText("Next action: Merge the delegated result back into the parent run summary.")
    ).toBeTruthy();
    expect(
      screen.getByText("Artifacts: runtime://sub-agent/session-1/context-summary")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Context projection: Preserved 2 recent range(s) with 1 offload reference(s)."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Knowledge projection: Runtime compacted delegated context and published 1 recall reference(s)."
      )
    ).toBeTruthy();
    expect(screen.getByText("Skill candidates: Runtime review [candidate]")).toBeTruthy();
    expect(screen.getByText("Tools read_only")).toBeTruthy();
    expect(screen.getByText("Budget bounded_subset")).toBeTruthy();
    expect(screen.getByText("Knowledge runtime_scoped_read_only")).toBeTruthy();

    const surface = screen.getAllByTestId("review-pack-surface").at(-1);
    expect(surface).toBeTruthy();
    expect(surface?.getAttribute("data-review-loop-panel")).toBe("review-pack");
    expect(within(surface!).getAllByTestId("review-summary-card").length).toBeGreaterThan(0);
    const cockpit = within(surface!).getByTestId("operator-cockpit");
    const workspaceEvidence = within(surface!).getByTestId("workspace-evidence-detail");
    expect(
      cockpit.compareDocumentPosition(screen.getByText("Validation outcome")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.click(within(cockpit).getByRole("button", { name: "Focus Diffs evidence" }));
    expect(
      within(workspaceEvidence).queryByText(
        /apps\/code\/src\/features\/review\/components\/ReviewPackSurface\.tsx/
      )
    ).toBeNull();
    expect(workspaceEvidence.textContent).toContain("Workspace diff");
    expect(workspaceEvidence.textContent).toContain("mission-control://runs/runtime-7/diff");
    fireEvent.click(within(workspaceEvidence).getByRole("button", { name: "Show all evidence" }));
    expect(workspaceEvidence.textContent).toContain(
      "apps/code/src/features/review/components/ReviewPackSurface.tsx"
    );
    expect(workspaceEvidence.textContent).toContain("Runtime-recorded changed path");

    fireEvent.click(screen.getByRole("button", { name: "Selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept result" }));
    expect(onSelectReviewPack).toHaveBeenCalledTimes(1);
    expect(onSubmitDecisionAction).toHaveBeenCalledWith({
      reviewPackId: "review-pack:runtime-7",
      action: expect.objectContaining({
        id: "accept",
        actionTarget: {
          kind: "review_decision",
          requestId: "review-pack:runtime-7",
          status: "approved",
        },
      }),
    });
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "review_decision_submitted",
      expect.objectContaining({
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:runtime-7",
        runId: "runtime-7",
        taskId: "runtime-task:runtime-7",
        decision: "accept",
        reviewStatus: "incomplete_evidence",
        eventSource: "review_surface",
      })
    );
  }, 60_000);

  it("elevates mission-run cockpit signals ahead of lower-level evidence sections", () => {
    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: null,
            source: "missions",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: null,
          fallbackReason: null,
          detailKind: "mission_run",
        }}
        detail={{
          ...missionReviewDefaults,
          kind: "mission_run",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Prepare migration",
          runId: "run-1",
          runTitle: "Prepare migration",
          summary: "Runtime run is still active.",
          updatedAt: Date.now() - 10_000,
          runState: "running",
          runStateLabel: "Running",
          operatorHealth: "attention",
          operatorHeadline: "Needs operator awareness",
          operatorDetail: "Runtime is waiting on the validation step.",
          approvalLabel: "Approval pending",
          approvalSummary: "Awaiting operator confirmation before file writes continue.",
          nextActionLabel: "Inspect the active run",
          nextActionDetail: "Open mission detail and review the current runtime route.",
          navigationTarget: {
            kind: "mission",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: null,
            threadId: "thread-1",
            limitation: null,
          },
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          ...buildEmptyReviewMetadata(),
          warnings: [],
          validations: [],
          artifacts: [],
          routeSummary: "Remote sandbox on backend-review-a",
          routeDetails: ["Provider: OpenAI"],
          governance: {
            summary: "Run is blocked on approval.",
            details: ["State: awaiting approval"],
          },
          operatorSnapshot: {
            summary: "OpenAI gpt-5.3-codex is running on backend-review-a.",
            details: ["Runtime: remote sandbox", "Model: gpt-5.3-codex"],
            currentActivity: "Running validation command",
            blocker: "Awaiting approval before write step.",
            recentEvents: [
              {
                label: "Approval wait",
                detail: "Runtime paused for an operator decision.",
                at: Date.now() - 5_000,
              },
            ],
          },
          placement: {
            summary: "Runtime confirmed workspace-default placement on backend backend-review-a.",
            details: ["Placement lifecycle: confirmed"],
          },
          workspaceEvidence: {
            summary: "Runtime published inspectable workspace evidence for this run.",
            buckets: [
              {
                kind: "commands",
                label: "Commands",
                summary: "1 command artifact linked.",
                items: [{ label: "pnpm validate", detail: "command trace", uri: null }],
                missingReason: null,
              },
            ],
          },
          lineage: undefined,
          ledger: undefined,
          executionContext: {
            summary: "Balanced Delegate via backend-review-a",
            details: ["Execution profile: Balanced Delegate"],
          },
          missionBrief: undefined,
          relaunchContext: undefined,
          autoDriveSummary: [],
          subAgentSummary: [],
          limitations: [],
          emptySectionLabels: {
            warnings: "No warnings.",
            validations: "No validations.",
            artifacts: "No artifacts.",
            autoDrive: "No auto-drive snapshot.",
          },
        }}
        onSelectReviewPack={() => undefined}
      />
    );

    const surface = screen.getAllByTestId("review-pack-surface").at(-1);
    expect(surface).toBeTruthy();
    const cockpit = within(surface!).getByTestId("operator-cockpit");
    expect(within(cockpit).getByText("Awaiting approval before write step.")).toBeTruthy();
    expect(within(cockpit).getAllByText("Run is blocked on approval.").length).toBeGreaterThan(0);
    expect(
      cockpit.compareDocumentPosition(screen.getByText("Validation evidence")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps run-only triage entries selected while showing mission-run detail continuity", () => {
    const onSelectReviewPack = vi.fn();

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "run-1",
            kind: "mission_run",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: null,
            workspaceId: "workspace-1",
            title: "Prepare migration",
            summary: "Runtime run is waiting for approval.",
            createdAt: Date.now() - 20_000,
            state: "needsAction",
            validationOutcome: "unknown",
            warningCount: 0,
            recommendedNextAction: "Inspect mission detail and unblock the run.",
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 10_000,
            filterTags: ["needs_attention", "sub_agent_blocked"],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: null,
              threadId: "thread-1",
              limitation: null,
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
            operatorSignal: "Awaiting approval",
            attentionSignals: ["Approval pending", "Blocked"],
            failureClassLabel: null,
            subAgentSignal: "Sub-agent awaiting approval",
            publishHandoffLabel: "Publish handoff ready",
            relaunchLabel: "Relaunch available",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: null,
            source: "missions",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: null,
          fallbackReason: null,
          detailKind: "mission_run",
        }}
        detail={{
          ...missionReviewDefaults,
          kind: "mission_run",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Prepare migration",
          runId: "run-1",
          runTitle: "Prepare migration",
          summary: "Runtime run is waiting for approval.",
          updatedAt: Date.now() - 10_000,
          runState: "needs_input",
          runStateLabel: "Needs input",
          operatorHealth: "attention",
          operatorHeadline: "Needs operator awareness",
          operatorDetail: "Runtime is blocked pending approval.",
          approvalLabel: "Approval pending",
          approvalSummary: "Awaiting operator confirmation before file writes continue.",
          nextActionLabel: "Inspect the active run",
          nextActionDetail: "Open mission detail and review the current runtime route.",
          navigationTarget: {
            kind: "mission",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: null,
            threadId: "thread-1",
            limitation: null,
          },
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          ...buildEmptyReviewMetadata(),
          warnings: [],
          validations: [],
          artifacts: [],
          routeSummary: "Remote sandbox on backend-review-a",
          routeDetails: ["Provider: OpenAI"],
          governance: {
            summary: "Run is blocked on approval.",
            details: ["State: awaiting approval"],
          },
          operatorSnapshot: {
            summary: "OpenAI gpt-5.3-codex is paused on backend-review-a.",
            details: ["Runtime: remote sandbox", "Model: gpt-5.3-codex"],
            currentActivity: "Awaiting approval",
            blocker: "Waiting for operator confirmation.",
            recentEvents: [
              {
                label: "Approval wait",
                detail: "Runtime paused for an operator decision.",
                at: Date.now() - 5_000,
              },
            ],
          },
          placement: {
            summary: "Runtime confirmed workspace-default placement on backend backend-review-a.",
            details: ["Placement lifecycle: confirmed"],
          },
          workspaceEvidence: {
            summary: "Runtime published inspectable workspace evidence for this run.",
            buckets: [],
          },
          lineage: undefined,
          ledger: undefined,
          executionContext: {
            summary: "Balanced Delegate via backend-review-a",
            details: ["Execution profile: Balanced Delegate"],
          },
          missionBrief: undefined,
          relaunchContext: undefined,
          autoDriveSummary: [],
          subAgentSummary: [
            {
              sessionId: "agent-1",
              parentRunId: "run-1",
              scopeProfile: "review",
              status: "awaiting_approval",
              approvalState: "pending",
              checkpointState: "awaiting",
              summary: "Sub-agent is waiting for approval.",
              timedOutReason: null,
              interruptedReason: null,
            },
          ],
          limitations: [],
          emptySectionLabels: {
            warnings: "No warnings.",
            validations: "No validations.",
            artifacts: "No artifacts.",
            autoDrive: "No auto-drive snapshot.",
          },
        }}
        onSelectReviewPack={onSelectReviewPack}
      />
    );

    const queuePanel = screen.getAllByTestId("review-queue-panel").at(-1);
    expect(queuePanel).toBeTruthy();
    expect(within(queuePanel!).getAllByText(/mission triage/i).length).toBeGreaterThan(0);
    expect(within(queuePanel!).getByRole("button", { name: "Selected" })).toBeTruthy();
    expect(screen.getByText("Publish handoff ready")).toBeTruthy();
    expect(screen.getByText("Sub-agent awaiting approval")).toBeTruthy();

    fireEvent.click(within(queuePanel!).getByRole("button", { name: "Selected" }));
    expect(onSelectReviewPack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-1",
        kind: "mission_run",
        reviewPackId: null,
      })
    );
  });

  it("prepares retry, clarify, and pair escalation intervention drafts from decision actions", () => {
    const onSelectReviewPack = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const onPrepareInterventionDraft = vi.fn();

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "review-pack:run-1",
            taskId: "task-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            title: "Refactor review routing",
            summary: "Review pack ready.",
            createdAt: Date.now() - 30_000,
            state: "reviewReady",
            validationOutcome: "warning",
            warningCount: 1,
            recommendedNextAction: "Retry with narrower scope.",
            navigationTarget: {
              kind: "thread",
              workspaceId: "workspace-1",
              threadId: "thread-1",
            },
            secondaryLabel: null,
            evidenceLabel: "Evidence confirmed",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:run-1",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          id: "review-pack:run-1",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Refactor review routing",
          runId: "run-1",
          runTitle: "Refactor review routing",
          summary: "Review pack ready.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "action_required",
          reviewStatusLabel: "Needs attention (1 warnings)",
          evidenceState: "confirmed",
          evidenceLabel: "Evidence confirmed",
          validationOutcome: "warning",
          validationLabel: "Validation warning",
          ...buildEmptyReviewMetadata(),
          warningCount: 1,
          warnings: ["Warnings remain after the latest validation pass."],
          validations: [
            {
              id: "validation-1",
              label: "pnpm validate:fast",
              outcome: "warning",
              summary: "One warning remains in the review surface.",
            },
          ],
          artifacts: [
            {
              id: "diff:run-1",
              label: "Diff preview",
              kind: "diff",
              uri: "artifact://diff/run-1",
            },
          ],
          checksPerformed: ["pnpm validate:fast"],
          recommendedNextAction: "Retry with narrower scope.",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          assumptions: [
            'Review assumes the "Balanced Delegate" execution profile guardrails were enforced during execution.',
          ],
          reproductionGuidance: [
            "Re-run pnpm validate:fast: One warning remains in the review surface.",
          ],
          rollbackGuidance: [
            "Use Diff preview as the rollback reference before reverting affected files.",
          ],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          backendAudit: {
            summary: "Workspace default backend",
            details: ["Provider: OpenAI", "Routing health: ready"],
            missingReason: null,
          },
          decisionActions: [
            {
              id: "accept",
              label: "Accept result",
              detail:
                "Mark the run as accepted after reviewing evidence, warnings, and rollback posture.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              interventionDraft: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "approved",
              },
            },
            {
              id: "reject",
              label: "Reject result",
              detail:
                "Reject this result and send it back for another pass with explicit operator feedback.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              interventionDraft: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "rejected",
              },
            },
            {
              id: "retry",
              label: "Retry run",
              detail:
                "Open the mission thread and relaunch the run with the recorded review context.",
              enabled: true,
              disabledReason: null,
              navigationTarget: {
                kind: "thread",
                workspaceId: "workspace-1",
                threadId: "thread-1",
              },
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "retry",
                title: "Refactor review routing",
                instruction:
                  "Refactor review routing\n\nWarnings indicate the review surface still needs a narrower pass.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
            {
              id: "clarify",
              label: "Clarify",
              detail:
                "Open the mission thread and relaunch with clarification while preserving the recorded review context.",
              enabled: true,
              disabledReason: null,
              navigationTarget: {
                kind: "thread",
                workspaceId: "workspace-1",
                threadId: "thread-1",
              },
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "clarify",
                title: "Refactor review routing",
                instruction:
                  "Refactor review routing\n\nWarnings indicate the review surface still needs a narrower pass.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
            {
              id: "switch_profile_and_retry",
              label: "Switch profile and retry",
              detail:
                "Open the mission thread, choose a different execution profile, and relaunch with the recorded review context.",
              enabled: true,
              disabledReason: null,
              navigationTarget: {
                kind: "thread",
                workspaceId: "workspace-1",
                threadId: "thread-1",
              },
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "switch_profile",
                title: "Refactor review routing",
                instruction:
                  "Refactor review routing\n\nWarnings indicate the review surface still needs a narrower pass.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
            {
              id: "continue_in_pair",
              label: "Continue in pair",
              detail:
                "Escalate this mission into pair mode while preserving the review context and runtime lineage.",
              enabled: true,
              disabledReason: null,
              navigationTarget: {
                kind: "thread",
                workspaceId: "workspace-1",
                threadId: "thread-1",
              },
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "pair_mode",
                title: "Refactor review routing",
                instruction:
                  "Refactor review routing\n\nWarnings indicate the review surface still needs a narrower pass.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
          ],
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          relaunchOptions: [],
          subAgentSummary: [],
          limitations: [],
          emptySectionLabels: {
            assumptions: "The runtime did not record explicit review assumptions for this pack.",
            warnings: "The runtime did not record any warnings for this review pack.",
            validations: "No individual validation checks were recorded for this run.",
            artifacts: "No artifacts or evidence references were attached to this review pack.",
            reproduction:
              "The runtime did not record reproduction guidance for this review pack. Re-run the linked validations or inspect attached evidence.",
            rollback:
              "The runtime did not record rollback guidance for this review pack. Use diff evidence or reopen the mission thread before reverting changes.",
          },
        }}
        freshness={{
          status: "ready",
          isStale: false,
          error: null,
          lastUpdatedAt: Date.now(),
        }}
        onSelectReviewPack={onSelectReviewPack}
        onOpenMissionTarget={onOpenMissionTarget}
        onPrepareInterventionDraft={onPrepareInterventionDraft}
      />
    );

    const cockpit = within(screen.getAllByTestId("operator-cockpit").at(-1)!);
    expect(cockpit.getByRole("button", { name: "Open mission thread" })).toBeTruthy();
    expect(cockpit.getByRole("button", { name: "Prepare retry draft" })).toBeTruthy();
    expect(cockpit.getByRole("button", { name: "Open decision and recovery" })).toBeTruthy();

    fireEvent.click(cockpit.getByRole("button", { name: "Prepare retry draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Clarify" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch profile and retry" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continue in pair" }).at(-1)!);

    expect(onOpenMissionTarget).not.toHaveBeenCalled();
    expect(onPrepareInterventionDraft).toHaveBeenCalledTimes(4);
    expect(onPrepareInterventionDraft).toHaveBeenNthCalledWith(1, {
      actionId: "retry",
      workspaceId: "workspace-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      draft: expect.objectContaining({
        intent: "retry",
        preferredBackendIds: ["backend-review-a"],
        sourceReviewPackId: "review-pack:run-1",
      }),
    });
    expect(onPrepareInterventionDraft).toHaveBeenNthCalledWith(2, {
      actionId: "clarify",
      workspaceId: "workspace-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      draft: expect.objectContaining({
        intent: "clarify",
        preferredBackendIds: ["backend-review-a"],
        sourceReviewPackId: "review-pack:run-1",
      }),
    });
    expect(onPrepareInterventionDraft).toHaveBeenNthCalledWith(3, {
      actionId: "switch_profile_and_retry",
      workspaceId: "workspace-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      draft: expect.objectContaining({
        intent: "switch_profile",
        preferredBackendIds: ["backend-review-a"],
        sourceReviewPackId: "review-pack:run-1",
      }),
    });
    expect(onPrepareInterventionDraft).toHaveBeenNthCalledWith(4, {
      actionId: "continue_in_pair",
      workspaceId: "workspace-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      draft: expect.objectContaining({
        intent: "pair_mode",
        preferredBackendIds: ["backend-review-a"],
        sourceReviewPackId: "review-pack:run-1",
      }),
    });
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "review_follow_up_prepared",
      expect.objectContaining({
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:run-1",
        decision: "switch_profile_and_retry",
        interventionKind: "switch_profile",
        eventSource: "review_surface",
      })
    );
  }, 20_000);

  it("edits and launches a prepared intervention draft with backend-aware overrides", async () => {
    const onLaunchInterventionDraft = vi.fn().mockResolvedValue(undefined);

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "review-pack:run-1",
            taskId: "task-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            title: "Refactor review routing",
            summary: "Review pack ready.",
            createdAt: Date.now() - 30_000,
            state: "reviewReady",
            validationOutcome: "warning",
            warningCount: 1,
            recommendedNextAction: "Retry with narrower scope.",
            navigationTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack:run-1",
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Evidence confirmed",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:run-1",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          id: "review-pack:run-1",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Refactor review routing",
          runId: "run-1",
          runTitle: "Refactor review routing",
          summary: "Review pack ready.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "action_required",
          reviewStatusLabel: "Needs attention (1 warnings)",
          evidenceState: "confirmed",
          evidenceLabel: "Evidence confirmed",
          validationOutcome: "warning",
          validationLabel: "Validation warning",
          ...buildEmptyReviewMetadata(),
          warningCount: 1,
          warnings: ["Warnings remain after the latest validation pass."],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Retry with narrower scope.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            limitation: "thread_unavailable",
          },
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          backendAudit: {
            summary: "Workspace default backend",
            details: ["Provider: OpenAI", "Routing health: ready"],
            missingReason: null,
          },
          decisionActions: [
            {
              id: "accept",
              label: "Accept result",
              detail:
                "Mark the run as accepted after reviewing evidence, warnings, and rollback posture.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "approved",
              },
              interventionDraft: null,
            },
            {
              id: "reject",
              label: "Reject result",
              detail:
                "Reject this result and send it back for another pass with explicit operator feedback.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "rejected",
              },
              interventionDraft: null,
            },
            {
              id: "retry",
              label: "Retry run",
              detail:
                "Open the mission thread and relaunch the run with the recorded review context.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "retry",
                title: "Refactor review routing",
                instruction: "Retry the runtime-managed review task.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
            {
              id: "clarify",
              label: "Clarify",
              detail:
                "Open the mission thread to narrow scope, switch profile, relax validation, or continue with clarification.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "clarify",
                title: "Refactor review routing",
                instruction: "Clarify the runtime-managed review task.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
          ],
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          relaunchOptions: [],
          subAgentSummary: [],
          limitations: [],
          emptySectionLabels: {
            assumptions: "The runtime did not record explicit review assumptions for this pack.",
            warnings: "The runtime did not record any warnings for this review pack.",
            validations: "No individual validation checks were recorded for this run.",
            artifacts: "No artifacts or evidence references were attached to this review pack.",
            reproduction:
              "The runtime did not record reproduction guidance for this review pack. Re-run the linked validations or inspect attached evidence.",
            rollback:
              "The runtime did not record rollback guidance for this review pack. Use diff evidence or reopen the mission thread before reverting changes.",
          },
        }}
        freshness={{
          status: "ready",
          isStale: false,
          error: null,
          lastUpdatedAt: Date.now(),
        }}
        interventionBackendOptions={[
          { value: "backend-review-a", label: "Review backend A" },
          { value: "backend-review-b", label: "Review backend B" },
        ]}
        defaultInterventionBackendId="backend-default"
        onSelectReviewPack={vi.fn()}
        onLaunchInterventionDraft={onLaunchInterventionDraft}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Retry run" }).at(-1)!);
    expect(screen.getAllByText("Mission Control relaunch").length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByLabelText("Intervention run title").at(-1)!, {
      target: { value: "Retry review routing with tighter scope" },
    });
    fireEvent.change(screen.getAllByLabelText("Intervention instruction").at(-1)!, {
      target: { value: "Retry with a narrower runtime-managed scope." },
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Intervention execution profile" }).at(-1)!
    );
    fireEvent.click(screen.getByRole("option", { name: "Operator Review" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Intervention backend route" }).at(-1)!);
    fireEvent.click(screen.getByRole("option", { name: "Review backend B" }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Launch relaunch draft" }).at(-1)!);
    });

    await waitFor(() => {
      expect(onLaunchInterventionDraft).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        navigationTarget: null,
        draft: expect.objectContaining({
          intent: "retry",
          title: "Retry review routing with tighter scope",
          instruction: "Retry with a narrower runtime-managed scope.",
          profileId: "operator-review",
          preferredBackendIds: ["backend-review-b"],
          sourceTaskId: "task-1",
          sourceRunId: "run-1",
          sourceReviewPackId: "review-pack:run-1",
        }),
      });
    });
  }, 60_000);

  it("shows a locally recorded review decision until runtime snapshot catches up", () => {
    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "review-pack:run-1",
            taskId: "task-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            title: "Refactor review routing",
            summary: "Review pack ready.",
            createdAt: Date.now() - 30_000,
            state: "reviewReady",
            validationOutcome: "passed",
            warningCount: 0,
            recommendedNextAction: "Accept the result.",
            navigationTarget: {
              kind: "thread",
              workspaceId: "workspace-1",
              threadId: "thread-1",
            },
            secondaryLabel: null,
            evidenceLabel: "Evidence confirmed",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:run-1",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          id: "review-pack:run-1",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Refactor review routing",
          runId: "run-1",
          runTitle: "Refactor review routing",
          summary: "Review pack ready.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "ready",
          reviewStatusLabel: "Review ready",
          evidenceState: "confirmed",
          evidenceLabel: "Evidence confirmed",
          validationOutcome: "passed",
          validationLabel: "Validation passed",
          ...buildEmptyReviewMetadata(),
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Accept the result.",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
          secondaryLabel: null,
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          backendAudit: {
            summary: "Workspace default backend",
            details: [],
            missingReason: null,
          },
          decisionActions: [
            {
              id: "accept",
              label: "Accept result",
              detail: "Accept this runtime review pack.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              interventionDraft: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "approved",
              },
            },
            {
              id: "reject",
              label: "Reject result",
              detail: "Reject this runtime review pack.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              interventionDraft: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "rejected",
              },
            },
          ],
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          relaunchOptions: [],
          subAgentSummary: [],
          limitations: [],
          emptySectionLabels: {
            assumptions: "none",
            warnings: "none",
            validations: "none",
            artifacts: "none",
            reproduction: "none",
            rollback: "none",
          },
        }}
        freshness={null}
        onSelectReviewPack={() => undefined}
        decisionSubmission={{
          reviewPackId: "review-pack:run-1",
          actionId: "accept",
          phase: "recorded",
          recordedStatus: "approved",
          recordedAt: Date.now() - 5_000,
          error: null,
          warning: "Decision recorded, but mission control could not be refreshed yet.",
        }}
      />
    );

    expect(screen.getAllByText("Accepted").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Result accepted. Waiting for runtime mission control to publish the updated review state."
      )
    ).toBeTruthy();
    expect(
      screen.getByText("Decision recorded, but mission control could not be refreshed yet.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept result unavailable" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: "Reject result unavailable" })).toHaveProperty(
      "disabled",
      true
    );
  }, 60_000);

  it("launches continue-in-pair drafts through the runtime intervention helper", async () => {
    const interveneTask = vi.fn().mockResolvedValue({
      accepted: true,
      action: "escalate_to_pair_mode",
      taskId: "task-1",
      status: "queued",
      outcome: "spawned",
      spawnedTaskId: "task-2",
    });
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[
          {
            id: "review-pack:run-1",
            taskId: "task-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            title: "Refactor review routing",
            summary: "Review pack ready.",
            createdAt: Date.now() - 30_000,
            state: "reviewReady",
            validationOutcome: "warning",
            warningCount: 1,
            recommendedNextAction: "Continue in pair with tighter operator control.",
            navigationTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack:run-1",
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Evidence confirmed",
          },
        ]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            source: "review_surface",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "task-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:run-1",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          id: "review-pack:run-1",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "task-1",
          taskTitle: "Refactor review routing",
          runId: "run-1",
          runTitle: "Refactor review routing",
          summary: "Review pack ready.",
          createdAt: Date.now() - 30_000,
          reviewStatus: "action_required",
          reviewStatusLabel: "Needs attention (1 warnings)",
          evidenceState: "confirmed",
          evidenceLabel: "Evidence confirmed",
          validationOutcome: "warning",
          validationLabel: "Validation warning",
          ...buildEmptyReviewMetadata(),
          warningCount: 1,
          warnings: ["Warnings remain after the latest validation pass."],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Continue in pair with tighter operator control.",
          navigationTarget: {
            kind: "review",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            limitation: "thread_unavailable",
          },
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:run-1",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          backendAudit: {
            summary: "Workspace default backend",
            details: ["Provider: OpenAI", "Routing health: ready"],
            missingReason: null,
          },
          decisionActions: [
            {
              id: "accept",
              label: "Accept result",
              detail:
                "Mark the run as accepted after reviewing evidence, warnings, and rollback posture.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "approved",
              },
              interventionDraft: null,
            },
            {
              id: "reject",
              label: "Reject result",
              detail:
                "Reject this result and send it back for another pass with explicit operator feedback.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: {
                kind: "review_decision",
                requestId: "review-pack:run-1",
                status: "rejected",
              },
              interventionDraft: null,
            },
            {
              id: "continue_in_pair",
              label: "Continue in pair",
              detail:
                "Escalate this mission into pair mode while preserving the review context and runtime lineage.",
              enabled: true,
              disabledReason: null,
              navigationTarget: null,
              actionTarget: null,
              interventionDraft: buildInterventionDraft({
                intent: "pair_mode",
                title: "Refactor review routing",
                instruction: "Continue in pair with the current review context.",
                profileId: "balanced-delegate",
                preferredBackendIds: ["backend-review-a"],
                sourceTaskId: "task-1",
                sourceRunId: "run-1",
                sourceReviewPackId: "review-pack:run-1",
              }),
            },
          ],
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: null,
          relaunchOptions: [],
          subAgentSummary: [],
          limitations: [],
          emptySectionLabels: {
            assumptions: "The runtime did not record explicit review assumptions for this pack.",
            warnings: "The runtime did not record any warnings for this review pack.",
            validations: "No individual validation checks were recorded for this run.",
            artifacts: "No artifacts or evidence references were attached to this review pack.",
            reproduction:
              "The runtime did not record reproduction guidance for this review pack. Re-run the linked validations or inspect attached evidence.",
            rollback:
              "The runtime did not record rollback guidance for this review pack. Use diff evidence or reopen the mission thread before reverting changes.",
          },
        }}
        freshness={{
          status: "ready",
          isStale: false,
          error: null,
          lastUpdatedAt: Date.now(),
        }}
        interventionBackendOptions={[{ value: "backend-review-a", label: "Review backend A" }]}
        defaultInterventionBackendId="backend-review-a"
        onSelectReviewPack={vi.fn()}
        onLaunchInterventionDraft={(input) =>
          launchReviewInterventionDraft({
            draft: input.draft,
            runtimeControl: { interveneTask },
            onRefresh,
          })
        }
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Continue in pair" }).at(-1)!);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Launch relaunch draft" }).at(-1)!);
    });

    await waitFor(() => {
      expect(interveneTask).toHaveBeenCalledWith({
        taskId: "task-1",
        action: "escalate_to_pair_mode",
        reason: "review_follow_up:pair_mode",
        instructionPatch: "Continue in pair with the current review context.",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-review-a"],
        relaunchContext: null,
      });
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "manual_rescue_invoked",
      expect.objectContaining({
        workspaceId: "workspace-1",
        reviewPackId: "review-pack:run-1",
        runId: "run-1",
        taskId: "task-1",
        interventionKind: "pair_mode",
        eventSource: "review_surface",
      })
    );
  }, 20_000);

  it("renders runtime mission detail when a run has no review pack yet", () => {
    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "runtime-task:active-1",
            runId: "run-active-1",
            source: "missions",
          },
          status: "selected",
          detailKind: "mission_run",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "runtime-task:active-1",
          selectedRunId: "run-active-1",
          selectedReviewPackId: null,
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          kind: "mission_run",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "runtime-task:active-1",
          taskTitle: "Stabilize mission detail routing",
          runId: "run-active-1",
          runTitle: "Stabilize mission detail routing",
          summary: "Runtime is still executing the mission route.",
          updatedAt: Date.now() - 15_000,
          runState: "running",
          runStateLabel: "Running",
          operatorHealth: "attention",
          operatorHeadline: "Run is controllable",
          operatorDetail: "Monitor the active waypoint until validation starts.",
          approvalLabel: null,
          approvalSummary: null,
          nextActionLabel: "Inspect active route",
          nextActionDetail: "Mission detail now carries the runtime-only observe path.",
          navigationTarget: null,
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          ...buildEmptyReviewMetadata(),
          warnings: ["Validation has not run yet."],
          validations: [],
          artifacts: [],
          routeSummary: "Workspace default backend",
          routeDetails: ["Backend: backend-a", "Resolved through backend-a."],
          autoDriveSummary: [
            "Destination: Close the observe loop",
            "Active waypoint: Route mission targets into review detail",
          ],
          subAgentSummary: [],
          limitations: [
            "This runtime-managed mission now opens in mission detail so route state, validations, and interventions stay in one place.",
          ],
          emptySectionLabels: {
            warnings: "The runtime did not record warnings for this mission run.",
            validations: "No runtime validation details were recorded for this mission run.",
            artifacts:
              "No runtime artifacts or evidence references were attached to this mission run.",
            autoDrive: "This run did not publish an AutoDrive route snapshot.",
          },
        }}
        freshness={null}
        onSelectReviewPack={() => undefined}
      />
    );

    expect(screen.getAllByText("Mission Detail").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Workspace default backend").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AutoDrive route snapshot").length).toBeGreaterThan(0);
    expect(screen.getByText("Destination: Close the observe loop")).toBeTruthy();
    expect(screen.getByText("Validation has not run yet.")).toBeTruthy();
    expect(screen.getAllByText("Runtime-owned mission workspace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mission detail freshness").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Published mission source").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Linked execution attempt").length).toBeGreaterThan(0);
  });

  it("shows runtime continuity guidance and canonical mission navigation for review packs", () => {
    const onOpenMissionTarget = vi.fn();

    render(
      <ReviewPackSurface
        workspaceName="Workspace One"
        items={[]}
        selection={{
          request: {
            workspaceId: "workspace-1",
            taskId: "runtime-task:run-9",
            runId: "run-9",
            reviewPackId: "review-pack:run-9",
            source: "home",
          },
          status: "selected",
          source: "runtime_snapshot_v1",
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "runtime-task:run-9",
          selectedRunId: "run-9",
          selectedReviewPackId: "review-pack:run-9",
          fallbackReason: null,
        }}
        detail={{
          ...missionReviewDefaults,
          decisionActionability: reviewPackDecisionActionabilityDefaults,
          id: "review-pack:run-9",
          workspaceId: "workspace-1",
          workspaceName: "Workspace One",
          taskId: "runtime-task:run-9",
          taskTitle: "Recover a blocked follow-up",
          runId: "run-9",
          runTitle: "Recover a blocked follow-up",
          summary: "Review pack ready.",
          createdAt: Date.now() - 20_000,
          reviewStatus: "ready",
          reviewStatusLabel: "Review ready",
          evidenceState: "confirmed",
          evidenceLabel: "Runtime evidence confirmed",
          validationOutcome: "passed",
          validationLabel: "Validation passed",
          ...buildEmptyReviewMetadata(),
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Runtime blocked follow-up until validation evidence is repaired.",
          navigationTarget: {
            kind: "mission",
            workspaceId: "workspace-1",
            taskId: "runtime-task:run-9",
            runId: "run-9",
            reviewPackId: "review-pack:run-9",
            threadId: "thread-legacy",
            limitation: null,
          },
          secondaryLabel: "Runtime-managed mission",
          source: "runtime_snapshot_v1",
          sourceLabel: "Runtime snapshot",
          failureClass: null,
          failureClassLabel: null,
          failureClassSummary: null,
          publishHandoff: {
            summary: "Publish handoff is ready for another control device.",
            branchName: "main",
            reviewTitle: "Recover blocked follow-up",
            reviewBody: null,
            reviewChecklist: null,
            operatorCommands: null,
            details: ["handoff detail"],
          },
          continuity: {
            ...blockedContinuityDefaults,
            state: "blocked",
            summary: "Runtime blocked follow-up until validation evidence is repaired.",
            details: [
              "Resume from the runtime-published mission detail.",
              "Canonical recovery path: mission run.",
              "Publish handoff is ready for another control device.",
            ],
            recommendedAction:
              "Open Review Pack and resolve the runtime-blocked follow-up before continuing.",
            blockingReason: "Runtime blocked follow-up until validation evidence is repaired.",
            continuePathLabel: "Mission run",
            truthSourceLabel: "Runtime continuation truth",
            continuityOverview: "Runtime blocked follow-up until validation evidence is repaired.",
            canSafelyContinue: false,
            hasHandoffPath: true,
            reviewFollowUpActionable: false,
            checkpointDurabilityState: "blocked",
          },
          assumptions: [],
          reproductionGuidance: [],
          rollbackGuidance: [],
          reviewDecision: {
            status: "pending",
            reviewPackId: "review-pack:run-9",
            label: "Decision pending",
            summary: "Accept or reject this result from the review surface.",
            decidedAt: null,
          },
          backendAudit: {
            summary: "Runtime backend audit unavailable",
            details: [],
            missingReason: null,
          },
          governance: undefined,
          operatorSnapshot: undefined,
          placement: undefined,
          workspaceEvidence: undefined,
          lineage: undefined,
          ledger: undefined,
          checkpoint: undefined,
          executionContext: undefined,
          missionBrief: undefined,
          relaunchContext: undefined,
          decisionActions: [],
          limitations: [],
          relaunchOptions: [],
          subAgentSummary: [],
          emptySectionLabels: {
            assumptions: "No assumptions",
            warnings: "No warnings",
            validations: "No validations",
            artifacts: "No artifacts",
            reproduction: "No reproduction guidance",
            rollback: "No rollback guidance",
          },
        }}
        freshness={null}
        onSelectReviewPack={() => undefined}
        onOpenMissionTarget={onOpenMissionTarget}
      />
    );

    expect(screen.getAllByText("Action center").length).toBeGreaterThan(0);
    const openLinkedMissionButtons = screen.getAllByRole("button", {
      name: "Open action center",
    });
    expect(openLinkedMissionButtons.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Runtime blocked follow-up until validation evidence is repaired.").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Open Review Pack and resolve the runtime-blocked follow-up before continuing."
      )
    ).toBeTruthy();

    fireEvent.click(openLinkedMissionButtons.at(-1)!);
    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task:run-9",
      runId: "run-9",
      reviewPackId: "review-pack:run-9",
      threadId: "thread-legacy",
      limitation: null,
    });
  }, 20_000);
});
