import type { RuntimeToolExecutionScope } from "./code-runtime-rpc/runtimeLiveSkillsAndTooling.js";

export const INVOCATION_DESCRIPTOR_KINDS = ["runtime_tool", "plugin", "session_command"] as const;

export type InvocationDescriptorKind = (typeof INVOCATION_DESCRIPTOR_KINDS)[number];

export const INVOCATION_SOURCE_KINDS = [
  "runtime_tool",
  "live_skill",
  "workspace_skill_manifest",
  "runtime_extension",
  "session_command",
] as const;

export type InvocationSourceKind = (typeof INVOCATION_SOURCE_KINDS)[number];

export const INVOCATION_CONTRIBUTION_TYPES = [
  "built_in",
  "skill_derived",
  "extension_contributed",
  "session_scoped",
  "bridged_external",
] as const;

export type InvocationContributionType = (typeof INVOCATION_CONTRIBUTION_TYPES)[number];

export const INVOCATION_READINESS_STATES = [
  "ready",
  "attention",
  "blocked",
  "unsupported",
] as const;

export type InvocationReadinessState = (typeof INVOCATION_READINESS_STATES)[number];

export const INVOCATION_AUDIENCES = ["operator", "model"] as const;

export type InvocationAudience = (typeof INVOCATION_AUDIENCES)[number];

export type InvocationSafetyLevel = "read" | "write" | "destructive";

export const INVOCATION_EXECUTION_BINDING_KINDS = [
  "runtime_run",
  "runtime_live_skill",
  "runtime_extension_tool",
  "session_message",
  "approval_response",
  "prompt_overlay",
  "unsupported",
] as const;

export type InvocationExecutionBindingKind = (typeof INVOCATION_EXECUTION_BINDING_KINDS)[number];

export type InvocationExecutionHost = "runtime" | "workspace" | "session";

export type InvocationHostRequirementKey =
  | "runtime_service"
  | "extension_bridge"
  | "session_facade"
  | "prompt_library";

export type InvocationExecutionPreflightState = "ready" | "blocked" | "not_required";

export type InvocationExecutionOutcomeStatus = "executed" | "resolved" | "blocked" | "unsupported";

export type InvocationReadiness = {
  state: InvocationReadinessState;
  available: boolean;
  reason: string | null;
  warnings: string[];
  checkedAt: number | null;
};

export type InvocationExposurePolicy = {
  operatorVisible: boolean;
  modelVisible: boolean;
  requiresReadiness: boolean;
  hiddenReason: string | null;
};

export type InvocationSafetyProfile = {
  level: InvocationSafetyLevel;
  readOnly: boolean;
  destructive: boolean;
  openWorld: boolean;
  idempotent: boolean;
};

export type InvocationSource = {
  kind: InvocationSourceKind;
  contributionType: InvocationContributionType;
  authority: "runtime" | "workspace" | "session";
  label: string;
  sourceId: string;
  workspaceId: string | null;
  provenance: Record<string, unknown> | null;
};

export type InvocationHostRequirement = {
  key: InvocationHostRequirementKey;
  summary: string;
};

export type InvocationExecutionBinding = {
  kind: InvocationExecutionBindingKind;
  host: InvocationExecutionHost;
  toolName?: string | null;
  extensionId?: string | null;
  promptId?: string | null;
};

export type InvocationExecutionPreflight = {
  state: InvocationExecutionPreflightState;
  summary: string;
};

export type InvocationExecutionPlan = {
  binding: InvocationExecutionBinding;
  hostRequirements: InvocationHostRequirement[];
  preflight: InvocationExecutionPreflight;
};

export type InvocationExecutionOutcome = {
  status: InvocationExecutionOutcomeStatus;
  summary: string;
};

export type InvocationExecutionEvidence = InvocationExecutionPlan & {
  invocationId: string;
  caller: InvocationAudience;
  source: InvocationSource;
  readiness: InvocationReadiness;
  outcome: InvocationExecutionOutcome;
};

export type RuntimeToolDescriptor = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  inputSchema: Record<string, unknown> | null;
  description: string;
  promptDescription: string | null;
};

export type InvocationDescriptor = {
  id: string;
  title: string;
  summary: string;
  description: string | null;
  kind: InvocationDescriptorKind;
  source: InvocationSource;
  runtimeTool: RuntimeToolDescriptor | null;
  argumentSchema: Record<string, unknown> | null;
  aliases: string[];
  tags: string[];
  safety: InvocationSafetyProfile;
  exposure: InvocationExposurePolicy;
  readiness: InvocationReadiness;
  execution?: InvocationExecutionPlan | null;
  metadata: Record<string, unknown> | null;
};

export type ActiveInvocationCatalogSourceSummary = {
  kind: InvocationDescriptorKind;
  count: number;
};

export type ActiveInvocationCatalogExecutionSummary = {
  bindingKind: InvocationExecutionBindingKind;
  host: InvocationExecutionHost;
  count: number;
  readyCount: number;
  blockedCount: number;
  notRequiredCount: number;
  requirementKeys: InvocationHostRequirementKey[];
};

export type ActiveInvocationCatalogRequirementSummary = {
  key: InvocationHostRequirementKey;
  count: number;
};

export type ActiveInvocationCatalogExecutionPlane = {
  bindings: ActiveInvocationCatalogExecutionSummary[];
  requirements: ActiveInvocationCatalogRequirementSummary[];
};

export type ActiveInvocationCatalog = {
  catalogId: string;
  workspaceId: string;
  revision: number;
  generatedAt: number;
  items: InvocationDescriptor[];
  sources: ActiveInvocationCatalogSourceSummary[];
  execution: ActiveInvocationCatalogExecutionPlane;
};
