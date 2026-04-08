import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReviewIntelligenceSummary } from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";
import {
  renderRelaunchOptions,
  renderReviewIntelligenceSummary,
  renderSubAgentSummary,
  renderWorkspaceSkillCatalog,
} from "./ReviewPackSurfaceSections";

describe("ReviewPackSurfaceSections", () => {
  it("renders sub-agent summaries through shared status-badge semantics", () => {
    const markup = renderToStaticMarkup(
      renderSubAgentSummary([
        {
          sessionId: "agent-1",
          delegationScope: "read_safe:review-pack",
          scopeProfile: "review-pack",
          status: "running",
          summary: "Reviewing runtime evidence.",
          resultSummary: {
            summary: "Delegated session finished with runtime-published evidence.",
            artifacts: ["runtime://sub-agent/session-1/context-summary"],
            nextAction: "Merge the delegated result back into the parent run summary.",
          },
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
          checkpointState: "available",
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
                summary: "Runtime compacted delegated context and published 1 recall reference(s).",
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
          timedOutReason: null,
          interruptedReason: null,
          parentRunId: "run-1",
        },
      ])
    );

    expect(markup).toContain('data-status-tone="progress"');
    expect(markup).toContain("Reviewing runtime evidence.");
    expect(markup).toContain("Delegated session finished with runtime-published evidence.");
    expect(markup).toContain(
      "Next action: Merge the delegated result back into the parent run summary."
    );
    expect(markup).toContain("Artifacts: runtime://sub-agent/session-1/context-summary");
    expect(markup).toContain(
      "Context projection: Preserved 2 recent range(s) with 1 offload reference(s)."
    );
    expect(markup).toContain(
      "Knowledge projection: Runtime compacted delegated context and published 1 recall reference(s)."
    );
    expect(markup).toContain("Skill candidates: Runtime review [candidate]");
    expect(markup).toContain("Tools read_only");
    expect(markup).toContain("Budget bounded_subset");
    expect(markup).toContain("Knowledge runtime_scoped_read_only");
  });

  it("renders relaunch availability through shared status-badge semantics", () => {
    const markup = renderToStaticMarkup(
      renderRelaunchOptions([
        {
          id: "retry",
          label: "Retry with findings",
          enabled: false,
          detail: "Replay the run with the latest bounded findings.",
          disabledReason: "Waiting for runtime handoff.",
        },
      ])
    );

    expect(markup).toContain('data-status-tone="default"');
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("Waiting for runtime handoff.");
  });

  it("renders manual-ready autofix next steps and proposal previews", () => {
    const markup = renderToStaticMarkup(
      renderReviewIntelligenceSummary(
        {
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
          } satisfies ReviewIntelligenceSummary,
          reviewProfileId: "issue-review",
          reviewGate: null,
          reviewRunId: "review-run-1",
          reviewFindings: [],
          skillUsage: [],
          autofixCandidate: {
            id: "autofix-1",
            summary: "Restore the skipped validation command.",
            status: "available",
          },
        },
        {
          status: "ready",
          entries: [],
          error: null,
        }
      )
    );

    expect(markup).toContain("Manual approval ready");
    expect(markup).toContain("Next step: Approve bounded autofix from Review Pack.");
    expect(markup).toContain("Manual proposal preview");
  });

  it("renders skill mismatches with active-review labels", () => {
    const markup = renderToStaticMarkup(
      renderWorkspaceSkillCatalog(
        {
          reviewIntelligence: {
            summary: "Runtime review published operator-facing truth.",
            blockedReason: null,
            nextRecommendedAction: "Inspect the findings before approval.",
            reviewProfileId: "issue-review",
            reviewProfileLabel: "Issue Review",
            reviewProfileDescription: null,
            sourceMappingKind: "github_issue",
            reviewProfileFieldOrigin: "repo_source_mapping",
            validationPresetId: "review-first",
            validationPresetLabel: "Review first",
            validationCommands: ["pnpm validate:fast"],
            validationPresetFieldOrigin: "repo_source_mapping",
            allowedSkillIds: ["review-agent", "repo-policy-check"],
            autofixPolicy: "bounded",
            githubMirrorPolicy: "summary",
            reviewGate: null,
            reviewFindings: [],
            reviewRunId: "review-run-1",
            skillUsage: [],
            autofixCandidate: null,
          } satisfies ReviewIntelligenceSummary,
          reviewProfileId: "issue-review",
          reviewGate: null,
          reviewRunId: "review-run-1",
          reviewFindings: [],
          skillUsage: [],
          autofixCandidate: null,
        },
        {
          status: "ready",
          error: null,
          entries: [
            {
              id: "repo-policy-check",
              name: "Repository Policy Check",
              version: "1.0.0",
              trustLevel: "local",
              kind: "skill",
              entrypoint: "repo-policy-check",
              permissions: ["workspace:read"],
              compatibility: {
                minRuntime: "1.0.0",
                maxRuntime: null,
                minApp: "1.0.0",
                maxApp: null,
              },
              recommendedFor: ["review"],
              manifestPath: ".hugecode/skills/repo-policy-check/manifest.json",
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
        }
      )
    );

    expect(markup).toContain("Recommended now");
    expect(markup).toContain("Runtime unavailable");
    expect(markup).toContain("Mismatch: Runtime live skill is unavailable for this workspace.");
  });
});
