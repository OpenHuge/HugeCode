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
          scopeProfile: "review-pack",
          status: "running",
          summary: "Reviewing runtime evidence.",
          approvalState: "pending",
          checkpointState: "available",
          timedOutReason: null,
          interruptedReason: null,
          parentRunId: "run-1",
        },
      ])
    );

    expect(markup).toContain('data-status-tone="progress"');
    expect(markup).toContain("Reviewing runtime evidence.");
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
