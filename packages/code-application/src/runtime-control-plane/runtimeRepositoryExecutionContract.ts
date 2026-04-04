import type {
  AccessMode,
  AgentTaskRelaunchContext,
  AgentTaskSourceSummary,
  RuntimeRunRiskLevelV2,
} from "@ku0/code-runtime-host-contract";

export type SupportedRepositoryTaskSourceKind = Extract<
  AgentTaskSourceSummary["kind"],
  | "manual"
  | "github_issue"
  | "github_pr_followup"
  | "github_discussion"
  | "note"
  | "customer_feedback"
  | "doc"
  | "call_summary"
  | "external_ref"
  | "schedule"
>;

type RepositoryExecutionContractPolicy = {
  executionProfileId?: string | null;
  preferredBackendIds?: string[];
  accessMode?: AccessMode | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
  guidance?: RepositoryExecutionContractGuidance;
  triage?: RepositoryExecutionContractTriagePolicy;
};

export type RepositoryExecutionContractGuidance = {
  instructions: string[];
  skillIds: string[];
};

export type RepositoryExecutionContractTriagePriority = "low" | "medium" | "high" | "urgent";

export type RepositoryExecutionContractTriagePolicy = {
  owner: string | null;
  priority: RepositoryExecutionContractTriagePriority | null;
  riskLevel: RuntimeRunRiskLevelV2 | null;
  tags: string[];
};

export type RepositoryExecutionValidationPreset = {
  id: string;
  label: string | null;
  description: string | null;
  commands: string[];
};

export type RepositoryExecutionReviewProfileAutofixPolicy = "disabled" | "bounded" | "manual";

export type RepositoryExecutionReviewProfileGithubMirrorPolicy =
  | "disabled"
  | "summary"
  | "check_output";

export type RepositoryExecutionReviewProfile = {
  id: string;
  label: string;
  description: string | null;
  allowedSkillIds: string[];
  validationPresetId: string | null;
  autofixPolicy: RepositoryExecutionReviewProfileAutofixPolicy;
  githubMirrorPolicy: RepositoryExecutionReviewProfileGithubMirrorPolicy;
};

export type RepositoryExecutionContract = {
  version: 1;
  metadata: {
    label: string | null;
    description: string | null;
  } | null;
  defaults: RepositoryExecutionContractPolicy;
  defaultReviewProfileId: string | null;
  sourceMappings: Partial<
    Record<SupportedRepositoryTaskSourceKind, RepositoryExecutionContractPolicy>
  >;
  validationPresets: RepositoryExecutionValidationPreset[];
  reviewProfiles: RepositoryExecutionReviewProfile[];
};

export type RepositoryExecutionExplicitLaunchInput = {
  executionProfileId?: string | null;
  preferredBackendIds?: string[];
  defaultBackendId?: string | null;
  accessMode?: AccessMode | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
};

export type ResolvedRepositoryExecutionDefaults = {
  contract: RepositoryExecutionContract | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  executionProfileId: string | null;
  preferredBackendIds?: string[];
  defaultBackendId?: string | null;
  accessMode: AccessMode | null;
  reviewProfileId: string | null;
  reviewProfile: RepositoryExecutionReviewProfile | null;
  validationPresetId: string | null;
  validationPresetLabel: string | null;
  validationCommands: string[];
  repoInstructions: string[];
  repoSkillIds: string[];
  sourceInstructions: string[];
  sourceSkillIds: string[];
  owner: string | null;
  triagePriority: RepositoryExecutionContractTriagePriority | null;
  triageRiskLevel: RuntimeRunRiskLevelV2 | null;
  triageTags: string[];
};

export type RuntimeRecordedContinuationDefaults = {
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId?: string | null;
  taskSource?: AgentTaskSourceSummary | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[];
  accessMode?: AccessMode | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
};

export type SupportedRepositoryTaskSource = SupportedRepositoryTaskSourceKind;
