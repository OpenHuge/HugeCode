import type {
  ReviewIntelligenceSummary,
  RuntimeWorkspaceSkillCatalogState,
  WorkspaceSkillCatalogEntry,
} from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";

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
  runtimeLabel: string;
  runtimeTone: ReviewTruthTone;
  compatibilityLabel: string;
  recommendedFor: string[];
  reviewProfiles: string[];
  permissions: string[];
  manifestPath: string;
  issues: string[];
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
  if (!entry.availableInRuntime) {
    return {
      label: "Unavailable in runtime",
      tone: "error",
    };
  }
  if (!entry.enabledInRuntime) {
    return {
      label: "Disabled in runtime",
      tone: "warning",
    };
  }
  return {
    label: "Enabled in runtime",
    tone: "success",
  };
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
  const missingRuntimeEntries = input.workspaceSkillCatalog.entries.filter(
    (entry) => !entry.availableInRuntime || !entry.enabledInRuntime
  );
  if (missingRuntimeEntries.length > 0) {
    return `Enable or install the runtime skill entries flagged in this catalog before relying on them during review or autofix.`;
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
    default:
      return input.workspaceSkillCatalog.entries.length === 1
        ? "1 workspace-native skill manifest is available for review-time inspection."
        : `${input.workspaceSkillCatalog.entries.length} workspace-native skill manifests are available for review-time inspection.`;
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
    };
  }
  if (candidate.status === "available") {
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
  const skillEntries = input.workspaceSkillCatalog.entries.map((entry) => {
    const runtimeState = resolveRuntimeState(entry);
    return {
      id: entry.id,
      title: entry.name,
      version: entry.version,
      trustLabel: titleCase(entry.trustLevel),
      runtimeLabel: runtimeState.label,
      runtimeTone: runtimeState.tone,
      compatibilityLabel: formatCompatibility(entry),
      recommendedFor: entry.recommendedFor,
      reviewProfiles: entry.reviewProfileLabels,
      permissions: entry.permissions,
      manifestPath: entry.manifestPath,
      issues: entry.issues,
    };
  });

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
