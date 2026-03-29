import { describe, expect, it } from "vitest";
import type {
  ReviewIntelligenceSummary,
  WorkspaceSkillCatalogEntry,
} from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";
import {
  buildReviewPackReviewIntelligenceTruth,
  type RuntimeWorkspaceSkillCatalogSurfaceState,
} from "./reviewPackReviewIntelligenceTruth";

function createReviewIntelligence(
  overrides: Partial<ReviewIntelligenceSummary> = {}
): ReviewIntelligenceSummary {
  return {
    summary: "Runtime review published operator-facing truth.",
    blockedReason: null,
    nextRecommendedAction: "Inspect the findings before approval.",
    reviewProfileId: "issue-review",
    reviewProfileLabel: "Issue Review",
    reviewProfileDescription: "Stricter review for issue-driven work.",
    sourceMappingKind: "github_issue",
    reviewProfileFieldOrigin: "repo_source_mapping",
    validationPresetId: "review-first",
    validationPresetLabel: "Review first",
    validationCommands: ["pnpm validate:fast"],
    validationPresetFieldOrigin: "repo_source_mapping",
    allowedSkillIds: ["review-agent", "repo-policy-check"],
    autofixPolicy: "bounded",
    githubMirrorPolicy: "summary",
    reviewGate: {
      state: "warn",
      summary: "Review found follow-up work before acceptance.",
      highestSeverity: "warning",
      findingCount: 1,
    },
    reviewFindings: [],
    reviewRunId: "review-run-1",
    skillUsage: [],
    autofixCandidate: null,
    ...overrides,
  };
}

function createCatalogEntry(
  overrides: Partial<WorkspaceSkillCatalogEntry> = {}
): WorkspaceSkillCatalogEntry {
  return {
    id: "review-agent",
    name: "Review Agent",
    version: "1.0.0",
    trustLevel: "local",
    entrypoint: "review-agent",
    permissions: ["workspace:read"],
    compatibility: {
      minRuntime: "1.0.0",
      maxRuntime: null,
      minApp: "1.0.0",
      maxApp: null,
    },
    recommendedFor: ["review", "delegate"],
    manifestPath: ".hugecode/skills/review-agent/manifest.json",
    availableInRuntime: true,
    enabledInRuntime: true,
    runtimeSkillId: "review-agent",
    reviewProfileIds: ["issue-review"],
    reviewProfileLabels: ["Issue Review"],
    issues: [],
    ...overrides,
  };
}

function createCatalogState(
  overrides: Partial<RuntimeWorkspaceSkillCatalogSurfaceState> = {}
): RuntimeWorkspaceSkillCatalogSurfaceState {
  return {
    status: "ready",
    entries: [],
    error: null,
    ...overrides,
  };
}

describe("reviewPackReviewIntelligenceTruth", () => {
  it("returns actionable empty-state guidance when no workspace skill manifests are available", () => {
    const truth = buildReviewPackReviewIntelligenceTruth({
      reviewIntelligence: createReviewIntelligence(),
      workspaceSkillCatalog: createCatalogState({
        status: "empty",
      }),
    });

    expect(truth.skillCatalog.status).toBe("empty");
    expect(truth.skillCatalog.summary).toContain(".hugecode/skills");
    expect(truth.skillCatalog.actionableGuidance).toContain("manifest.json");
    expect(truth.skillCatalog.actionableGuidance).toContain("review-agent");
  });

  it("maps bounded autofix states into explicit approval guidance", () => {
    const available = buildReviewPackReviewIntelligenceTruth({
      reviewIntelligence: createReviewIntelligence({
        autofixCandidate: {
          id: "autofix-1",
          status: "available",
          summary: "Restore the skipped validation command.",
        },
      }),
      workspaceSkillCatalog: createCatalogState({
        entries: [createCatalogEntry()],
      }),
    });
    const blocked = buildReviewPackReviewIntelligenceTruth({
      reviewIntelligence: createReviewIntelligence({
        blockedReason: "Runtime must finish the previous retry first.",
        autofixCandidate: {
          id: "autofix-1",
          status: "blocked",
          summary: "Restore the skipped validation command.",
          blockingReason: "Runtime must finish the previous retry first.",
        },
      }),
      workspaceSkillCatalog: createCatalogState({
        entries: [createCatalogEntry()],
      }),
    });
    const applied = buildReviewPackReviewIntelligenceTruth({
      reviewIntelligence: createReviewIntelligence({
        nextRecommendedAction: "Inspect the refreshed review evidence.",
        autofixCandidate: {
          id: "autofix-1",
          status: "applied",
          summary: "Restore the skipped validation command.",
        },
      }),
      workspaceSkillCatalog: createCatalogState({
        entries: [createCatalogEntry()],
      }),
    });

    expect(available.autofix.status).toBe("available");
    expect(available.autofix.explicitApprovalRequired).toBe(true);
    expect(available.autofix.operatorGuidance).toContain("explicitly approve");

    expect(blocked.autofix.status).toBe("blocked");
    expect(blocked.autofix.blockingReason).toBe("Runtime must finish the previous retry first.");
    expect(blocked.autofix.operatorGuidance).toContain("blocked");

    expect(applied.autofix.status).toBe("applied");
    expect(applied.autofix.actionLabel).toBeNull();
    expect(applied.autofix.operatorGuidance).toContain("already applied");
  });
});
