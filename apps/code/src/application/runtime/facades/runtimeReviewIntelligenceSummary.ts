import type {
  AgentTaskSourceSummary,
  HugeCodeReviewFinding,
  HugeCodeReviewGateSummary,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeRuntimeAutofixCandidate,
  HugeCodeRuntimeSkillUsageRecommendedFor,
  HugeCodeRuntimeSkillUsageSummary,
} from "@ku0/code-runtime-host-contract";
import {
  type RepositoryExecutionContract,
  type RepositoryExecutionReviewProfile,
  type RepositoryExecutionReviewProfileAutofixPolicy,
  type RepositoryExecutionReviewProfileGithubMirrorPolicy,
  type SupportedRepositoryTaskSourceKind,
} from "./runtimeRepositoryExecutionContract";
import { resolveRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionDefaults";

export type ReviewProfileFieldOrigin =
  | "explicit_override"
  | "runtime_recorded"
  | "repo_source_mapping"
  | "repo_defaults"
  | "runtime_fallback";

export type ResolvedReviewProfileDefaults = {
  reviewProfileId: string | null;
  reviewProfile: RepositoryExecutionReviewProfile | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  validationPresetId: string | null;
  validationPresetLabel: string | null;
  validationCommands: string[];
  reviewProfileFieldOrigin: ReviewProfileFieldOrigin;
  validationPresetFieldOrigin: ReviewProfileFieldOrigin;
};

export type ReviewIntelligenceSummary = {
  summary: string;
  blockedReason: string | null;
  nextRecommendedAction: string | null;
  reviewProfileId: string | null;
  reviewProfileLabel: string | null;
  reviewProfileDescription: string | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  reviewProfileFieldOrigin: ReviewProfileFieldOrigin;
  validationPresetId: string | null;
  validationPresetLabel: string | null;
  validationCommands: string[];
  validationPresetFieldOrigin: ReviewProfileFieldOrigin;
  allowedSkillIds: string[];
  autofixPolicy: RepositoryExecutionReviewProfileAutofixPolicy | null;
  githubMirrorPolicy: RepositoryExecutionReviewProfileGithubMirrorPolicy | null;
  reviewGate: HugeCodeReviewGateSummary | null;
  reviewFindings: HugeCodeReviewFinding[];
  reviewRunId: string | null;
  skillUsage: HugeCodeRuntimeSkillUsageSummary[];
  autofixCandidate: HugeCodeRuntimeAutofixCandidate | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRepoFieldOrigin(input: {
  contract: RepositoryExecutionContract | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  field: "reviewProfileId" | "validationPresetId";
  value: string | null;
}): ReviewProfileFieldOrigin {
  if (
    input.value &&
    input.sourceMappingKind &&
    input.contract?.sourceMappings[input.sourceMappingKind]?.[input.field] === input.value
  ) {
    return "repo_source_mapping";
  }
  if (
    input.value &&
    input.contract?.defaults[input.field] !== undefined &&
    input.contract.defaults[input.field] === input.value
  ) {
    return "repo_defaults";
  }
  return "runtime_fallback";
}

function mergeReviewSkillUsage(input: {
  reviewProfile: RepositoryExecutionReviewProfile | null;
  runtimeSkillUsage: HugeCodeRuntimeSkillUsageSummary[];
}): HugeCodeRuntimeSkillUsageSummary[] {
  const merged = new Map<string, HugeCodeRuntimeSkillUsageSummary>();
  for (const skill of input.runtimeSkillUsage) {
    const normalizedSkillId = readOptionalText(skill.skillId);
    if (!normalizedSkillId) {
      continue;
    }
    const recommendedFor: HugeCodeRuntimeSkillUsageRecommendedFor[] = Array.from(
      new Set<HugeCodeRuntimeSkillUsageRecommendedFor>([...(skill.recommendedFor ?? []), "review"])
    );
    merged.set(normalizedSkillId, {
      ...skill,
      skillId: normalizedSkillId,
      recommendedFor,
    });
  }
  for (const skillId of input.reviewProfile?.allowedSkillIds ?? []) {
    if (merged.has(skillId)) {
      continue;
    }
    merged.set(skillId, {
      skillId,
      name: skillId,
      status: "suggested",
      recommendedFor: ["review"],
      summary: `Allowed by review profile ${input.reviewProfile?.label}.`,
    });
  }
  return [...merged.values()];
}

function buildReviewIntelligenceSummaryText(input: {
  reviewProfile: RepositoryExecutionReviewProfile | null;
  reviewGate: HugeCodeReviewGateSummary | null;
  reviewRunId: string | null;
}): string {
  if (input.reviewGate?.summary) {
    return input.reviewGate.summary;
  }
  if (input.reviewProfile?.label) {
    return `Runtime review uses ${input.reviewProfile.label}.`;
  }
  if (input.reviewRunId) {
    return `Runtime published review intelligence for review run ${input.reviewRunId}.`;
  }
  return "Review intelligence metadata was not published.";
}

function buildReviewIntelligenceNextAction(input: {
  reviewGate: HugeCodeReviewGateSummary | null;
  autofixCandidate: HugeCodeRuntimeAutofixCandidate | null;
  recommendedNextAction?: string | null;
}): string | null {
  if (input.reviewGate?.blockingReason) {
    return "Resolve the blocked review gate before continuing this mission.";
  }
  if (input.autofixCandidate?.status === "available") {
    return "Apply the bounded autofix or relaunch with the recorded findings.";
  }
  if (input.autofixCandidate?.status === "blocked") {
    return input.autofixCandidate.blockingReason ?? "Review autofix is currently blocked.";
  }
  return readOptionalText(input.recommendedNextAction) ?? input.reviewGate?.summary ?? null;
}

export function resolveReviewProfileDefaults(input: {
  contract: RepositoryExecutionContract | null;
  taskSource?: AgentTaskSourceSummary | null;
  explicitReviewProfileId?: string | null;
  runtimeReviewProfileId?: string | null;
  explicitValidationPresetId?: string | null;
  runtimeValidationPresetId?: string | null;
}): ResolvedReviewProfileDefaults {
  const repoDefaults = resolveRepositoryExecutionDefaults({
    contract: input.contract,
    taskSource: input.taskSource ?? null,
    explicitLaunchInput: {
      reviewProfileId: input.explicitReviewProfileId ?? null,
      validationPresetId: input.explicitValidationPresetId ?? null,
    },
  });
  const runtimeReviewProfileId = readOptionalText(input.runtimeReviewProfileId);
  const runtimeValidationPresetId = readOptionalText(input.runtimeValidationPresetId);
  const reviewProfileId = readOptionalText(input.explicitReviewProfileId) ?? runtimeReviewProfileId;
  const validationPresetId =
    readOptionalText(input.explicitValidationPresetId) ??
    runtimeValidationPresetId ??
    repoDefaults.validationPresetId;
  const resolvedReviewProfileId = reviewProfileId ?? repoDefaults.reviewProfileId;
  const reviewProfile =
    resolvedReviewProfileId === null
      ? null
      : (input.contract?.reviewProfiles.find((profile) => profile.id === resolvedReviewProfileId) ??
        null);
  return {
    reviewProfileId: resolvedReviewProfileId,
    reviewProfile,
    sourceMappingKind: repoDefaults.sourceMappingKind,
    validationPresetId,
    validationPresetLabel: repoDefaults.validationPresetLabel,
    validationCommands: repoDefaults.validationCommands,
    reviewProfileFieldOrigin: readOptionalText(input.explicitReviewProfileId)
      ? "explicit_override"
      : runtimeReviewProfileId
        ? "runtime_recorded"
        : resolveRepoFieldOrigin({
            contract: input.contract,
            sourceMappingKind: repoDefaults.sourceMappingKind,
            field: "reviewProfileId",
            value: resolvedReviewProfileId,
          }),
    validationPresetFieldOrigin: readOptionalText(input.explicitValidationPresetId)
      ? "explicit_override"
      : runtimeValidationPresetId
        ? "runtime_recorded"
        : resolveRepoFieldOrigin({
            contract: input.contract,
            sourceMappingKind: repoDefaults.sourceMappingKind,
            field: "validationPresetId",
            value: validationPresetId,
          }),
  };
}

export function resolveReviewIntelligenceSummary(input: {
  contract: RepositoryExecutionContract | null;
  taskSource?: AgentTaskSourceSummary | null;
  run?: Pick<
    HugeCodeRunSummary,
    | "reviewProfileId"
    | "executionProfile"
    | "reviewGate"
    | "reviewFindings"
    | "reviewRunId"
    | "skillUsage"
    | "autofixCandidate"
  > | null;
  reviewPack?: Pick<
    HugeCodeReviewPackSummary,
    | "reviewProfileId"
    | "reviewGate"
    | "reviewFindings"
    | "reviewRunId"
    | "skillUsage"
    | "autofixCandidate"
  > | null;
  recommendedNextAction?: string | null;
}): ReviewIntelligenceSummary | null {
  const runtimeReviewProfileId =
    readOptionalText(input.reviewPack?.reviewProfileId) ??
    readOptionalText(input.run?.reviewProfileId);
  const runtimeValidationPresetId = readOptionalText(
    input.run?.executionProfile?.validationPresetId
  );
  const reviewGate = input.reviewPack?.reviewGate ?? input.run?.reviewGate ?? null;
  const reviewFindings = input.reviewPack?.reviewFindings ?? input.run?.reviewFindings ?? [];
  const reviewRunId =
    readOptionalText(input.reviewPack?.reviewRunId) ?? readOptionalText(input.run?.reviewRunId);
  const runtimeSkillUsage = input.reviewPack?.skillUsage ?? input.run?.skillUsage ?? [];
  const autofixCandidate =
    input.reviewPack?.autofixCandidate ?? input.run?.autofixCandidate ?? null;

  const resolvedDefaults = resolveReviewProfileDefaults({
    contract: input.contract,
    taskSource: input.taskSource ?? null,
    runtimeReviewProfileId,
    runtimeValidationPresetId,
  });

  const reviewProfile = resolvedDefaults.reviewProfile;
  const skillUsage = mergeReviewSkillUsage({
    reviewProfile,
    runtimeSkillUsage,
  });
  const blockedReason = reviewGate?.blockingReason ?? autofixCandidate?.blockingReason ?? null;

  if (
    !reviewProfile &&
    !reviewGate &&
    reviewFindings.length === 0 &&
    !reviewRunId &&
    skillUsage.length === 0 &&
    !autofixCandidate
  ) {
    return null;
  }

  return {
    summary: buildReviewIntelligenceSummaryText({
      reviewProfile,
      reviewGate,
      reviewRunId: reviewRunId ?? null,
    }),
    blockedReason,
    nextRecommendedAction: buildReviewIntelligenceNextAction({
      reviewGate,
      autofixCandidate,
      recommendedNextAction: input.recommendedNextAction ?? null,
    }),
    reviewProfileId: resolvedDefaults.reviewProfileId,
    reviewProfileLabel: reviewProfile?.label ?? resolvedDefaults.reviewProfileId,
    reviewProfileDescription: reviewProfile?.description ?? null,
    sourceMappingKind: resolvedDefaults.sourceMappingKind,
    reviewProfileFieldOrigin: resolvedDefaults.reviewProfileFieldOrigin,
    validationPresetId: resolvedDefaults.validationPresetId,
    validationPresetLabel: resolvedDefaults.validationPresetLabel,
    validationCommands: resolvedDefaults.validationCommands,
    validationPresetFieldOrigin: resolvedDefaults.validationPresetFieldOrigin,
    allowedSkillIds: reviewProfile?.allowedSkillIds ?? [],
    autofixPolicy: reviewProfile?.autofixPolicy ?? null,
    githubMirrorPolicy: reviewProfile?.githubMirrorPolicy ?? null,
    reviewGate,
    reviewFindings,
    reviewRunId: reviewRunId ?? null,
    skillUsage,
    autofixCandidate,
  };
}
