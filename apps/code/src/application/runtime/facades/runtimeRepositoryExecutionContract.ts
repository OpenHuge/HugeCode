import type {
  AccessMode,
  AgentTaskSourceSummary,
  RuntimeRunRiskLevelV2,
} from "@ku0/code-runtime-host-contract";
import { RuntimeUnavailableError } from "../ports/runtimeClient";
import { readWorkspaceFile } from "../ports/tauriWorkspaceFiles";
import { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";

const REPOSITORY_EXECUTION_CONTRACT_PATH = ".hugecode/repository-execution-contract.json";
const ALLOWED_VALIDATION_COMMAND_PATTERN =
  /^pnpm (?:validate(?::(?:fast|full))?|test:component|test:e2e:[a-z0-9:_-]+)$/u;

const KNOWN_EXECUTION_PROFILE_IDS = new Set(
  listRunExecutionProfiles().map((profile) => profile.id)
);
const KNOWN_ACCESS_MODES = new Set<AccessMode>(["read-only", "on-request", "full-access"]);

type SupportedRepositoryTaskSourceKind = Extract<
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
  accessMode?: AccessMode | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
};

export type ResolvedRepositoryExecutionDefaults = {
  contract: RepositoryExecutionContract | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  executionProfileId: string | null;
  preferredBackendIds?: string[];
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

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBackendIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids.length > 0 ? ids : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function readGuidance(value: unknown, context: string): RepositoryExecutionContractGuidance {
  if (value === null || value === undefined) {
    return {
      instructions: [],
      skillIds: [],
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  return {
    instructions: normalizeStringList(record.instructions),
    skillIds: normalizeStringList(record.skillIds),
  };
}

function readTriagePriority(
  value: unknown,
  context: string
): RepositoryExecutionContractTriagePriority | null {
  const normalized = readOptionalText(value);
  if (normalized === null) {
    return null;
  }
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "urgent"
  ) {
    return normalized;
  }
  throw new Error(`${context} must be low, medium, high, or urgent.`);
}

function readRiskLevel(value: unknown, context: string): RuntimeRunRiskLevelV2 | null {
  const normalized = readOptionalText(value);
  if (normalized === null) {
    return null;
  }
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  throw new Error(`${context} must be low, medium, or high.`);
}

function readTriage(value: unknown, context: string): RepositoryExecutionContractTriagePolicy {
  if (value === null || value === undefined) {
    return {
      owner: null,
      priority: null,
      riskLevel: null,
      tags: [],
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  return {
    owner: readOptionalText(record.owner),
    priority: readTriagePriority(record.priority, `${context}.priority`),
    riskLevel: readRiskLevel(record.riskLevel, `${context}.riskLevel`),
    tags: normalizeStringList(record.tags),
  };
}

function readPolicy(
  value: unknown,
  context: string,
  presetIds: ReadonlySet<string>,
  reviewProfileIds: ReadonlySet<string>
): RepositoryExecutionContractPolicy {
  if (value === null || value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const executionProfileId = readOptionalText(record.executionProfileId);
  if (executionProfileId && !KNOWN_EXECUTION_PROFILE_IDS.has(executionProfileId)) {
    throw new Error(
      `${context}.executionProfileId must be one of ${Array.from(KNOWN_EXECUTION_PROFILE_IDS).join(", ")}.`
    );
  }
  const accessModeValue = readOptionalText(record.accessMode);
  const accessMode =
    accessModeValue === null
      ? null
      : (accessModeValue as RepositoryExecutionContractPolicy["accessMode"]);
  if (accessModeValue && !KNOWN_ACCESS_MODES.has(accessModeValue as AccessMode)) {
    throw new Error(`${context}.accessMode must be read-only, on-request, or full-access.`);
  }
  const reviewProfileId = readOptionalText(record.reviewProfileId);
  if (reviewProfileId && !reviewProfileIds.has(reviewProfileId)) {
    throw new Error(`${context}.reviewProfileId must reference a declared review profile.`);
  }
  const validationPresetId = readOptionalText(record.validationPresetId);
  if (validationPresetId && !presetIds.has(validationPresetId)) {
    throw new Error(`${context}.validationPresetId must reference a declared validation preset.`);
  }
  return {
    ...(executionProfileId ? { executionProfileId } : {}),
    ...(normalizeBackendIds(record.preferredBackendIds)
      ? { preferredBackendIds: normalizeBackendIds(record.preferredBackendIds) }
      : {}),
    ...(accessMode ? { accessMode } : {}),
    ...(reviewProfileId ? { reviewProfileId } : {}),
    ...(validationPresetId ? { validationPresetId } : {}),
    guidance: readGuidance(record.guidance, `${context}.guidance`),
    triage: readTriage(record.triage, `${context}.triage`),
  };
}

function parseValidationPresets(value: unknown): RepositoryExecutionValidationPreset[] {
  if (!Array.isArray(value)) {
    throw new Error("validationPresets must be an array.");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`validationPresets[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const id = readOptionalText(record.id);
    if (!id) {
      throw new Error(`validationPresets[${index}].id is required.`);
    }
    if (seen.has(id)) {
      throw new Error(`validationPresets contains duplicate id \`${id}\`.`);
    }
    seen.add(id);
    if (!Array.isArray(record.commands)) {
      throw new Error(`validationPresets[${index}].commands must be an array.`);
    }
    const commands = normalizeBackendIds(record.commands)?.filter((command) => {
      if (ALLOWED_VALIDATION_COMMAND_PATTERN.test(command)) {
        return true;
      }
      throw new Error(
        `validationPresets[${index}].commands may only reference supported pnpm validation commands.`
      );
    });
    if (!commands || commands.length === 0) {
      throw new Error(`validationPresets[${index}].commands must include at least one command.`);
    }
    return {
      id,
      label: readOptionalText(record.label),
      description: readOptionalText(record.description),
      commands,
    };
  });
}

function parseAllowedSkillIds(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function parseReviewProfileAutofixPolicy(
  value: unknown,
  context: string
): RepositoryExecutionReviewProfileAutofixPolicy {
  const normalized = readOptionalText(value) ?? "manual";
  if (normalized === "disabled" || normalized === "bounded" || normalized === "manual") {
    return normalized;
  }
  throw new Error(`${context} must be disabled, bounded, or manual.`);
}

function parseReviewProfileGithubMirrorPolicy(
  value: unknown,
  context: string
): RepositoryExecutionReviewProfileGithubMirrorPolicy {
  const normalized = readOptionalText(value) ?? "disabled";
  if (normalized === "disabled" || normalized === "summary" || normalized === "check_output") {
    return normalized;
  }
  throw new Error(`${context} must be disabled, summary, or check_output.`);
}

function parseReviewProfiles(
  value: unknown,
  presetIds: ReadonlySet<string>
): RepositoryExecutionReviewProfile[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("reviewProfiles must be an array.");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`reviewProfiles[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const id = readOptionalText(record.id);
    if (!id) {
      throw new Error(`reviewProfiles[${index}].id is required.`);
    }
    if (seen.has(id)) {
      throw new Error(`reviewProfiles contains duplicate id \`${id}\`.`);
    }
    seen.add(id);
    const label = readOptionalText(record.label);
    if (!label) {
      throw new Error(`reviewProfiles[${index}].label is required.`);
    }
    const validationPresetId = readOptionalText(record.validationPresetId);
    if (validationPresetId && !presetIds.has(validationPresetId)) {
      throw new Error(
        `reviewProfiles[${index}].validationPresetId must reference a declared validation preset.`
      );
    }
    return {
      id,
      label,
      description: readOptionalText(record.description),
      allowedSkillIds: parseAllowedSkillIds(
        record.allowedSkillIds ?? [],
        `reviewProfiles[${index}].allowedSkillIds`
      ),
      validationPresetId,
      autofixPolicy: parseReviewProfileAutofixPolicy(
        record.autofixPolicy,
        `reviewProfiles[${index}].autofixPolicy`
      ),
      githubMirrorPolicy: parseReviewProfileGithubMirrorPolicy(
        record.githubMirrorPolicy,
        `reviewProfiles[${index}].githubMirrorPolicy`
      ),
    };
  });
}

function readSourceMappingKind(value: string): SupportedRepositoryTaskSourceKind | null {
  switch (value) {
    case "manual":
    case "github_issue":
    case "github_pr_followup":
    case "github_discussion":
    case "note":
    case "customer_feedback":
    case "doc":
    case "call_summary":
    case "external_ref":
    case "schedule":
      return value;
    default:
      return null;
  }
}

export function parseRepositoryExecutionContract(raw: string): RepositoryExecutionContract {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${REPOSITORY_EXECUTION_CONTRACT_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid repository execution contract at ${REPOSITORY_EXECUTION_CONTRACT_PATH}.`
    );
  }
  const record = parsed as Record<string, unknown>;
  if (record.version !== 1) {
    throw new Error(
      `Unsupported repository execution contract version \`${String(record.version ?? "unknown")}\` at ${REPOSITORY_EXECUTION_CONTRACT_PATH}.`
    );
  }
  const validationPresets = parseValidationPresets(record.validationPresets);
  const presetIds = new Set(validationPresets.map((preset) => preset.id));
  const reviewProfiles = parseReviewProfiles(record.reviewProfiles, presetIds);
  const reviewProfileIds = new Set(reviewProfiles.map((profile) => profile.id));
  const defaultReviewProfileId = readOptionalText(record.defaultReviewProfileId);
  if (defaultReviewProfileId && !reviewProfileIds.has(defaultReviewProfileId)) {
    throw new Error("defaultReviewProfileId must reference a declared review profile.");
  }
  const sourceMappings: RepositoryExecutionContract["sourceMappings"] = {};
  const sourceMappingsValue = record.sourceMappings;
  if (
    sourceMappingsValue !== null &&
    sourceMappingsValue !== undefined &&
    (typeof sourceMappingsValue !== "object" || Array.isArray(sourceMappingsValue))
  ) {
    throw new Error("sourceMappings must be an object.");
  }
  for (const [key, value] of Object.entries(
    (sourceMappingsValue as Record<string, unknown> | undefined) ?? {}
  )) {
    const sourceKind = readSourceMappingKind(key);
    if (!sourceKind) {
      throw new Error(`sourceMappings.${key} is not a supported task source.`);
    }
    sourceMappings[sourceKind] = readPolicy(
      value,
      `sourceMappings.${key}`,
      presetIds,
      reviewProfileIds
    );
  }
  return {
    version: 1,
    metadata:
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? {
            label: readOptionalText((record.metadata as Record<string, unknown>).label),
            description: readOptionalText((record.metadata as Record<string, unknown>).description),
          }
        : null,
    defaults: readPolicy(record.defaults, "defaults", presetIds, reviewProfileIds),
    defaultReviewProfileId,
    sourceMappings,
    validationPresets,
    reviewProfiles,
  };
}

export async function readRepositoryExecutionContract(
  workspaceId: string
): Promise<RepositoryExecutionContract | null> {
  let payload: { content?: string | null } | null;
  try {
    payload = (await readWorkspaceFile(workspaceId, REPOSITORY_EXECUTION_CONTRACT_PATH)) as {
      content?: string | null;
    } | null;
  } catch (error) {
    if (error instanceof RuntimeUnavailableError) {
      return null;
    }
    throw error;
  }
  const content = readOptionalText(payload?.content);
  if (!content) {
    return null;
  }
  return parseRepositoryExecutionContract(content);
}

export {
  REPOSITORY_EXECUTION_CONTRACT_PATH,
  type RepositoryExecutionContractPolicy,
  type SupportedRepositoryTaskSourceKind,
};
