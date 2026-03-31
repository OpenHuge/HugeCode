import type {
  ReviewIntelligenceSummary,
  RuntimeWorkspaceSkillCatalogState,
  WorkspaceSkillCatalogEntry,
} from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";
import { buildReviewAutofixProposalPreview } from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";

type ReviewTruthTone = "default" | "success" | "warning" | "error" | "progress";

type ReviewTruthFact = {
  label: string;
  value: string;
  tone?: ReviewTruthTone;
};

type ReviewTruthCatalogEntry = {
  id: string;
  title: string;
  version: string;
  trustLabel: string;
  reviewRecommendationLabel: string;
  reviewRecommendationTone: ReviewTruthTone;
  runtimeLabel: string;
  runtimeTone: ReviewTruthTone;
  compatibilityLabel: string;
  recommendedFor: string[];
  reviewProfiles: string[];
  permissions: string[];
  manifestPath: string;
  issues: string[];
  mismatchReason: string | null;
  operatorAction: string | null;
};

export type RuntimeWorkspaceSkillCatalogSurfaceState = Pick<
  RuntimeWorkspaceSkillCatalogState,
  "status" | "entries" | "error"
>;

export type ReviewPackReviewIntelligenceTruth = {
  overview: {
    summary: string;
    facts: ReviewTruthFact[];
  };
  gate: {
    summary: string;
    stateLabel: string;
    stateTone: ReviewTruthTone;
    highestSeverity: string | null;
    findingCount: number;
    blockedReason: string | null;
    nextRecommendedAction: string | null;
  };
  autofix: {
    status: "unavailable" | "available" | "blocked" | "applied";
    label: string;
    tone: ReviewTruthTone;
    summary: string;
    explicitApprovalRequired: boolean;
    actionLabel: string | null;
    operatorGuidance: string;
    blockingReason: string | null;
    actionabilityLabel: string;
    nextStep: string | null;
    proposalPreview: string | null;
  };
  skillCatalog: {
    status: RuntimeWorkspaceSkillCatalogSurfaceState["status"];
    summary: string;
    actionableGuidance: string | null;
    entries: ReviewTruthCatalogEntry[];
  };
};

function formatFieldOrigin(value: ReviewIntelligenceSummary["reviewProfileFieldOrigin"]): string {
  return value.replaceAll("_", " ");
}

function titleCase(input: string): string {
  return input
    .split(/[_\s-]+/u)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatGitHubMirrorPolicy(
  value: ReviewIntelligenceSummary["githubMirrorPolicy"]
): string | null {
  switch (value) {
    case "summary":
      return "Summary mirror";
    case "check_output":
      return "Check output mirror";
    case "disabled":
      return "No GitHub mirror";
    default:
      return null;
  }
}

function formatCompatibility(entry: WorkspaceSkillCatalogEntry): string {
  const parts = [`Runtime >= ${entry.compatibility.minRuntime}`];
  if (entry.compatibility.maxRuntime) {
    parts.push(`Runtime <= ${entry.compatibility.maxRuntime}`);
  }
  if (entry.compatibility.minApp) {
    parts.push(`App >= ${entry.compatibility.minApp}`);
  }
  if (entry.compatibility.maxApp) {
    parts.push(`App <= ${entry.compatibility.maxApp}`);
  }
  return parts.join(" | ");
}

function resolveRuntimeState(entry: WorkspaceSkillCatalogEntry): {
  label: string;
  tone: ReviewTruthTone;
} {
  switch (entry.runtimeReadiness) {
    case "manifest_only":
      return {
        label: "Manifest visible only",
        tone: "warning",
      };
    case "unavailable":
      return {
        label: "Runtime unavailable",
        tone: "error",
      };
    case "disabled":
      return {
        label: "Runtime disabled",
        tone: "warning",
      };
    case "executable":
    default:
      return {
        label: "Runtime executable",
        tone: "success",
      };
  }
}

function normalizeSkillId(value: string): string {
  return value.trim().toLowerCase();
}

function summarizeCatalogEntries(input: {
  reviewIntelligence: ReviewIntelligenceSummary | null;
  workspaceSkillCatalog: RuntimeWorkspaceSkillCatalogSurfaceState;
}): ReviewTruthCatalogEntry[] {
  const activeAllowedSkillIds = input.reviewIntelligence?.allowedSkillIds ?? [];
  const activeAllowedSkillIdSet = new Set(activeAllowedSkillIds.map(normalizeSkillId));
  const workspaceEntries = input.workspaceSkillCatalog.entries.map((entry) => {
    const runtimeState = resolveRuntimeState(entry);
    const recommendedNow = activeAllowedSkillIdSet.has(normalizeSkillId(entry.id));
    const mismatchReason = recommendedNow ? entry.runtimeReadinessReason : null;
    const operatorAction = !recommendedNow
      ? null
      : entry.runtimeReadiness === "executable"
        ? null
        : entry.runtimeReadiness === "disabled"
          ? "Enable this runtime skill before rerunning review or approving follow-up."
          : entry.runtimeReadiness === "manifest_only"
            ? "Replace this source manifest with a runtime-executable skill manifest before relying on it for review."
            : "Install or register this runtime skill before relying on it for review or autofix.";
    return {
      id: entry.id,
      title: entry.name,
      version: entry.version,
      trustLabel: titleCase(entry.trustLevel),
      reviewRecommendationLabel: recommendedNow ? "Recommended now" : "Visible in workspace only",
      reviewRecommendationTone: recommendedNow ? "success" : "default",
      runtimeLabel: runtimeState.label,
      runtimeTone: runtimeState.tone,
      compatibilityLabel: formatCompatibility(entry),
      recommendedFor: entry.recommendedFor,
      reviewProfiles: entry.reviewProfileLabels,
      permissions: entry.permissions,
      manifestPath: entry.manifestPath,
      issues: entry.issues,
      mismatchReason,
      operatorAction,
    } satisfies ReviewTruthCatalogEntry;
  });
  const workspaceEntryIds = new Set(workspaceEntries.map((entry) => normalizeSkillId(entry.id)));
  const missingRecommendedEntries = activeAllowedSkillIds
    .filter((skillId) => !workspaceEntryIds.has(normalizeSkillId(skillId)))
    .map(
      (skillId) =>
        ({
          id: skillId,
          title: skillId,
          version: "not published",
          trustLabel: "Missing manifest",
          reviewRecommendationLabel: "Recommended now",
          reviewRecommendationTone: "warning",
          runtimeLabel: "No workspace manifest",
          runtimeTone: "error",
          compatibilityLabel: "No workspace skill manifest published.",
          recommendedFor: ["review"],
          reviewProfiles: input.reviewIntelligence?.reviewProfileLabel
            ? [input.reviewIntelligence.reviewProfileLabel]
            : [],
          permissions: [],
          manifestPath: `.hugecode/skills/${skillId}/manifest.json`,
          issues: [],
          mismatchReason:
            "Active review profile recommends this skill, but the workspace skill catalog does not publish it.",
          operatorAction:
            "Add the missing workspace manifest or switch to a review profile that does not depend on this skill.",
        }) satisfies ReviewTruthCatalogEntry
    );
  return [...missingRecommendedEntries, ...workspaceEntries].sort((left, right) => {
    const leftPriority =
      left.reviewRecommendationLabel === "Recommended now" ? (left.mismatchReason ? 0 : 1) : 2;
    const rightPriority =
      right.reviewRecommendationLabel === "Recommended now" ? (right.mismatchReason ? 0 : 1) : 2;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildCatalogActionableGuidance(input: {
  reviewIntelligence: ReviewIntelligenceSummary | null;
  workspaceSkillCatalog: RuntimeWorkspaceSkillCatalogSurfaceState;
}): string | null {
  const allowedSkillIds = input.reviewIntelligence?.allowedSkillIds ?? [];
  if (input.workspaceSkillCatalog.status === "empty") {
    if (allowedSkillIds.length > 0) {
      return `Add .hugecode/skills/<skill-id>/manifest.json entries for ${allowedSkillIds.join(", ")}, or remove the unused skill from the active review profile.`;
    }
    return "Add .hugecode/skills/<skill-id>/manifest.json files to publish workspace-native review skills.";
  }
  if (input.workspaceSkillCatalog.status === "error") {
    return "Fix the workspace skill manifest read error, then reload Review Pack to restore operator-facing skill truth.";
  }
  const skillEntries = summarizeCatalogEntries(input);
  if (skillEntries.some((entry) => entry.mismatchReason !== null)) {
    return "Resolve the flagged review-skill mismatches before rerunning review or relying on bounded autofix from this panel.";
  }
  return null;
}

function buildCatalogSummary(input: {
  reviewIntelligence: ReviewIntelligenceSummary | null;
  workspaceSkillCatalog: RuntimeWorkspaceSkillCatalogSurfaceState;
}): string {
  switch (input.workspaceSkillCatalog.status) {
    case "idle":
      return "Workspace skill catalog is idle until a review surface selects a workspace.";
    case "loading":
      return "Loading workspace-native skill manifests from .hugecode/skills.";
    case "error":
      return input.workspaceSkillCatalog.error
        ? `Workspace skill catalog could not be loaded: ${input.workspaceSkillCatalog.error}`
        : "Workspace skill catalog could not be loaded.";
    case "empty":
      return input.reviewIntelligence?.allowedSkillIds.length
        ? `No workspace-native skill manifests were found under .hugecode/skills, even though the active review profile allows ${input.reviewIntelligence.allowedSkillIds.join(", ")}.`
        : "No workspace-native skill manifests were found under .hugecode/skills.";
    case "ready":
    default: {
      const skillEntries = summarizeCatalogEntries(input);
      const recommendedNowCount = skillEntries.filter(
        (entry) => entry.reviewRecommendationLabel === "Recommended now"
      ).length;
      const mismatchCount = skillEntries.filter((entry) => entry.mismatchReason !== null).length;
      const runtimeReadyCount = skillEntries.filter(
        (entry) =>
          entry.reviewRecommendationLabel === "Recommended now" && entry.runtimeTone === "success"
      ).length;
      if (recommendedNowCount > 0) {
        return `Active review profile recommends ${recommendedNowCount} skills: ${runtimeReadyCount} runtime executable, ${mismatchCount} mismatched.`;
      }
      return skillEntries.length === 1
        ? "1 workspace-native skill manifest is available for review-time inspection."
        : `${skillEntries.length} workspace-native skill manifests are available for review-time inspection.`;
    }
  }
}

function buildAutofixTruth(
  reviewIntelligence: ReviewIntelligenceSummary | null
): ReviewPackReviewIntelligenceTruth["autofix"] {
  const candidate = reviewIntelligence?.autofixCandidate ?? null;
  if (!candidate) {
    return {
      status: "unavailable",
      label: "No autofix candidate",
      tone: "default",
      summary: "Runtime did not publish a bounded autofix candidate.",
      explicitApprovalRequired: false,
      actionLabel: null,
      operatorGuidance:
        reviewIntelligence?.nextRecommendedAction ??
        "Continue with manual review follow-up from the published findings.",
      blockingReason: null,
      actionabilityLabel: "Manual follow-up",
      nextStep:
        reviewIntelligence?.nextRecommendedAction ??
        "Continue with manual review follow-up from the published findings.",
      proposalPreview: null,
    };
  }
  if (candidate.status === "available") {
    const proposalPreview = buildReviewAutofixProposalPreview(candidate);
    return {
      status: "available",
      label: "Bounded autofix available",
      tone: "warning",
      summary: candidate.summary,
      explicitApprovalRequired: true,
      actionLabel: "Approve bounded autofix",
      operatorGuidance:
        "Runtime will not apply this bounded autofix unless an operator explicitly approves it from Review Pack.",
      blockingReason: null,
      actionabilityLabel: "Manual approval ready",
      nextStep: "Approve bounded autofix from Review Pack.",
      proposalPreview: `${proposalPreview.instructionPatch}`,
    };
  }
  if (candidate.status === "blocked") {
    return {
      status: "blocked",
      label: "Bounded autofix blocked",
      tone: "error",
      summary: candidate.summary,
      explicitApprovalRequired: true,
      actionLabel: null,
      operatorGuidance: candidate.blockingReason
        ? `Bounded autofix is blocked: ${candidate.blockingReason}`
        : "Bounded autofix is blocked until runtime follow-up clears.",
      blockingReason: candidate.blockingReason ?? reviewIntelligence?.blockedReason ?? null,
      actionabilityLabel: "Blocked",
      nextStep:
        "Resolve the runtime blocker, then return to Review Pack for the published follow-up path.",
      proposalPreview: null,
    };
  }
  return {
    status: "applied",
    label: "Bounded autofix applied",
    tone: "success",
    summary: candidate.summary,
    explicitApprovalRequired: false,
    actionLabel: null,
    operatorGuidance: reviewIntelligence?.nextRecommendedAction
      ? `Bounded autofix already applied. ${reviewIntelligence.nextRecommendedAction}`
      : "Bounded autofix already applied. Inspect the refreshed review evidence before accepting.",
    blockingReason: null,
    actionabilityLabel: "Already applied",
    nextStep:
      reviewIntelligence?.nextRecommendedAction ??
      "Inspect the refreshed review evidence before accepting.",
    proposalPreview: null,
  };
}

export function buildReviewPackReviewIntelligenceTruth(input: {
  reviewIntelligence: ReviewIntelligenceSummary | null;
  workspaceSkillCatalog: RuntimeWorkspaceSkillCatalogSurfaceState;
}): ReviewPackReviewIntelligenceTruth {
  const reviewIntelligence = input.reviewIntelligence;
  const allowedSkillIds = reviewIntelligence?.allowedSkillIds ?? [];
  const gateState = reviewIntelligence?.reviewGate?.state ?? "missing";
  const gateTone: ReviewTruthTone =
    gateState === "pass"
      ? "success"
      : gateState === "warn"
        ? "warning"
        : gateState === "fail" || gateState === "blocked"
          ? "error"
          : "default";
  const skillEntries = summarizeCatalogEntries(input);

  return {
    overview: {
      summary: reviewIntelligence?.summary ?? "Review intelligence metadata was not published.",
      facts: [
        reviewIntelligence?.reviewProfileLabel
          ? {
              label: "Review profile",
              value: reviewIntelligence.reviewProfileLabel,
            }
          : null,
        reviewIntelligence?.reviewProfileFieldOrigin
          ? {
              label: "Profile source",
              value: formatFieldOrigin(reviewIntelligence.reviewProfileFieldOrigin),
            }
          : null,
        reviewIntelligence?.validationPresetLabel
          ? {
              label: "Validation preset",
              value: reviewIntelligence.validationPresetLabel,
            }
          : null,
        reviewIntelligence?.validationPresetFieldOrigin
          ? {
              label: "Validation source",
              value: formatFieldOrigin(reviewIntelligence.validationPresetFieldOrigin),
            }
          : null,
        allowedSkillIds.length > 0
          ? {
              label: "Allowed skills",
              value: allowedSkillIds.join(", "),
            }
          : null,
        reviewIntelligence?.reviewRunId
          ? {
              label: "Review run",
              value: reviewIntelligence.reviewRunId,
            }
          : null,
        formatGitHubMirrorPolicy(reviewIntelligence?.githubMirrorPolicy ?? null)
          ? {
              label: "GitHub closure",
              value: formatGitHubMirrorPolicy(reviewIntelligence?.githubMirrorPolicy ?? null)!,
            }
          : null,
      ].filter((value): value is ReviewTruthFact => value !== null),
    },
    gate: {
      summary: reviewIntelligence?.reviewGate?.summary ?? "Review gate metadata was not published.",
      stateLabel:
        reviewIntelligence?.reviewGate?.state !== undefined
          ? titleCase(reviewIntelligence.reviewGate.state)
          : "Not published",
      stateTone: gateTone,
      highestSeverity: reviewIntelligence?.reviewGate?.highestSeverity ?? null,
      findingCount:
        reviewIntelligence?.reviewGate?.findingCount ??
        reviewIntelligence?.reviewFindings.length ??
        0,
      blockedReason: reviewIntelligence?.blockedReason ?? null,
      nextRecommendedAction: reviewIntelligence?.nextRecommendedAction ?? null,
    },
    autofix: buildAutofixTruth(reviewIntelligence),
    skillCatalog: {
      status: input.workspaceSkillCatalog.status,
      summary: buildCatalogSummary(input),
      actionableGuidance: buildCatalogActionableGuidance(input),
      entries: skillEntries,
    },
  };
}
