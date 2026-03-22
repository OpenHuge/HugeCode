import { applyRuntimeContextBudgetToToolOutput } from "./runtimeContextBudget";
import {
  canonicalizeLiveSkillId,
  listAcceptedLiveSkillIds,
  listAcceptedLiveSkillIdsFromCatalogSkill,
  normalizeLiveSkillLookupId,
} from "./runtimeClientLiveSkills";
import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
  summarizeRuntimeToolOutput,
} from "./webMcpBridgeRuntimeToolHelpers";
import type {
  AgentCommandCenterSnapshot,
  RuntimeAllowedSkillResolution,
  RuntimeAgentAccessMode,
  RuntimeAgentControl,
  RuntimeAgentReasonEffort,
  RuntimeSkillIdResolution,
  RuntimeAgentTaskExecutionMode,
  RuntimeSubAgentSessionHandle,
  RuntimeSubAgentSessionStatus,
  RuntimeSubAgentSessionSummary,
  RuntimeAgentTaskStatus,
  RuntimeAgentTaskStepKind,
  WebMcpAgent,
  WebMcpResponseRequiredState,
} from "./webMcpBridgeTypes";

export type JsonRecord = Record<string, unknown>;

type RuntimeLiveSkillResult = JsonRecord & {
  output: string;
  metadata?: unknown;
};

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

export type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

export type RuntimeToolHelpers = {
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
  toNonEmptyString: (value: unknown) => string | null;
  toStringArray: (value: unknown) => string[];
  toPositiveInteger: (value: unknown) => number | null;
  normalizeRuntimeTaskStatus: (value: unknown) => RuntimeAgentTaskStatus | null;
  normalizeRuntimeStepKind: (value: unknown) => RuntimeAgentTaskStepKind;
  normalizeRuntimeExecutionMode: (value: unknown) => RuntimeAgentTaskExecutionMode;
  normalizeRuntimeAccessMode: (value: unknown) => RuntimeAgentAccessMode;
  normalizeRuntimeReasonEffort: (value: unknown) => RuntimeAgentReasonEffort | null;
  confirmWriteAction: (
    agent: WebMcpAgent | null,
    requireUserApproval: boolean,
    message: string,
    onApprovalRequest?: (message: string) => Promise<boolean>
  ) => Promise<void>;
};

export type BuildRuntimeToolsOptions = {
  snapshot: AgentCommandCenterSnapshot;
  runtimeControl: RuntimeAgentControl;
  requireUserApproval: boolean;
  responseRequiredState?: WebMcpResponseRequiredState;
  onApprovalRequest?: (message: string) => Promise<boolean>;
  helpers: RuntimeToolHelpers;
};

type WorkspaceIdHelper = Pick<RuntimeToolHelpers, "toNonEmptyString">;

export type RuntimeLiveSkillCatalogIndex = {
  knownSkillIds: Set<string>;
  canonicalSkillIdByAcceptedId: Map<string, string>;
  acceptedSkillIdsByCanonicalId: Map<string, string[]>;
};

export type SubAgentSpawnInputHelpers = Pick<
  RuntimeToolHelpers,
  | "toNonEmptyString"
  | "toStringArray"
  | "normalizeRuntimeAccessMode"
  | "normalizeRuntimeReasonEffort"
>;

export type CallerModelContextSource = "explicit" | "agent" | "none";

export type CallerModelContextResolution = {
  provider: string | null;
  modelId: string | null;
  source: CallerModelContextSource;
};

function toOptionalRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function resolveProviderModelFromInputAndAgentWithSource(
  input: JsonRecord,
  agent: WebMcpAgent | null,
  helpers: Pick<RuntimeToolHelpers, "toNonEmptyString">
): CallerModelContextResolution {
  const explicitProvider = helpers.toNonEmptyString(input.provider);
  const explicitModelId = helpers.toNonEmptyString(input.modelId);
  const agentRecord = toOptionalRecord(agent);
  const modelRecord = toOptionalRecord(agentRecord?.model);
  const contextRecord = toOptionalRecord(agentRecord?.context);
  const agentProvider =
    helpers.toNonEmptyString(agentRecord?.provider) ??
    helpers.toNonEmptyString(modelRecord?.provider) ??
    helpers.toNonEmptyString(contextRecord?.provider);
  const agentModelId =
    helpers.toNonEmptyString(agentRecord?.modelId) ??
    helpers.toNonEmptyString(agentRecord?.model_id) ??
    helpers.toNonEmptyString(modelRecord?.id) ??
    helpers.toNonEmptyString(contextRecord?.modelId) ??
    helpers.toNonEmptyString(contextRecord?.model_id);
  const provider = explicitProvider ?? agentProvider;
  const modelId = explicitModelId ?? agentModelId;
  return {
    provider,
    modelId,
    source:
      explicitProvider !== null || explicitModelId !== null
        ? "explicit"
        : provider !== null || modelId !== null
          ? "agent"
          : "none",
  };
}

export function resolveProviderModelFromInputAndAgent(
  input: JsonRecord,
  agent: WebMcpAgent | null,
  helpers: Pick<RuntimeToolHelpers, "toNonEmptyString">
): {
  provider: string | null;
  modelId: string | null;
} {
  const resolution = resolveProviderModelFromInputAndAgentWithSource(input, agent, helpers);
  return {
    provider: resolution.provider,
    modelId: resolution.modelId,
  };
}

export function buildRuntimeLiveSkillResponse(input: {
  toolName: string;
  message: string;
  result: RuntimeLiveSkillResult;
  workspaceId: string;
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
  extraData?: JsonRecord;
}): JsonRecord {
  const toolOutput = summarizeRuntimeToolOutput({
    toolName: input.toolName,
    output: input.result.output,
  });
  const compacted = applyRuntimeContextBudgetToToolOutput({
    result: input.result,
    toolOutput,
  });
  return input.buildResponse(input.message, {
    workspaceId: input.workspaceId,
    result: compacted.result,
    toolOutput: compacted.toolOutput,
    ...(input.extraData ?? {}),
  });
}

type SubAgentControlMethod =
  | "spawnSubAgentSession"
  | "sendSubAgentInstruction"
  | "waitSubAgentSession"
  | "getSubAgentSessionStatus"
  | "interruptSubAgentSession"
  | "closeSubAgentSession";

export function requireSubAgentControlMethod<MethodName extends SubAgentControlMethod>(
  control: RuntimeAgentControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeAgentControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeAgentControl[MethodName]>;
}

export function requireRuntimeLiveSkillControlMethod<
  MethodName extends "listLiveSkills" | "runLiveSkill",
>(
  control: RuntimeAgentControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeAgentControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeAgentControl[MethodName]>;
}

export function resolveWorkspaceId<Helper extends WorkspaceIdHelper>(
  input: JsonRecord,
  snapshot: AgentCommandCenterSnapshot,
  helpers: Helper
): string {
  return helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
}

export function normalizeSubAgentSpawnInput(
  input: JsonRecord,
  snapshot: AgentCommandCenterSnapshot,
  helpers: SubAgentSpawnInputHelpers,
  liveSkillCatalogIndex?: RuntimeLiveSkillCatalogIndex | null,
  agent?: WebMcpAgent | null
) {
  const callerModelContext = resolveProviderModelFromInputAndAgent(input, agent ?? null, helpers);
  return {
    workspaceId: resolveWorkspaceId(input, snapshot, helpers),
    threadId: helpers.toNonEmptyString(input.threadId),
    title: helpers.toNonEmptyString(input.title),
    accessMode: helpers.normalizeRuntimeAccessMode(input.accessMode),
    reasonEffort: helpers.normalizeRuntimeReasonEffort(input.reasonEffort),
    provider: callerModelContext.provider,
    modelId: callerModelContext.modelId,
    scopeProfile: normalizeSubAgentScopeProfile(input.scopeProfile),
    allowedSkillIds: normalizeAllowedSkillIds(
      input.allowedSkillIds,
      helpers,
      liveSkillCatalogIndex
    ),
    allowNetwork: normalizeOptionalBoolean(input.allowNetwork),
    workspaceReadPaths: normalizeOptionalStringArray(input.workspaceReadPaths, helpers),
    parentRunId: helpers.toNonEmptyString(input.parentRunId),
  };
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeOptionalStringArray(
  value: unknown,
  helpers: Pick<RuntimeToolHelpers, "toStringArray">
): string[] | null {
  const normalized = helpers.toStringArray(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeAllowedSkillIds(
  value: unknown,
  helpers: Pick<RuntimeToolHelpers, "toStringArray">,
  liveSkillCatalogIndex?: RuntimeLiveSkillCatalogIndex | null
): string[] | null {
  const resolution = buildRuntimeAllowedSkillResolution(value, helpers, liveSkillCatalogIndex);
  if (!resolution) {
    return null;
  }
  return resolution.resolvedSkillIds;
}

function normalizeSubAgentScopeProfile(
  value: unknown
): NonNullable<RuntimeSubAgentSessionSummary["scopeProfile"]> | null {
  if (value === "general" || value === "research" || value === "review") {
    return value;
  }
  return null;
}

type RuntimeSubAgentSessionHandleSource = Pick<
  RuntimeSubAgentSessionSummary,
  "sessionId" | "status"
> &
  Partial<
    Pick<
      RuntimeSubAgentSessionSummary,
      "activeTaskId" | "lastTaskId" | "checkpointId" | "traceId" | "recovered"
    >
  >;

export function buildRuntimeSubAgentSessionHandle(
  session: RuntimeSubAgentSessionHandleSource | null | undefined
): RuntimeSubAgentSessionHandle | null {
  if (!session) {
    return null;
  }
  return {
    sessionId: session.sessionId,
    status: session.status as RuntimeSubAgentSessionStatus,
    activeTaskId: session.activeTaskId ?? null,
    lastTaskId: session.lastTaskId ?? null,
    checkpointId: session.checkpointId ?? null,
    traceId: session.traceId ?? null,
    recovered: session.recovered ?? null,
  };
}

function resolveRuntimeSkillId(
  skillId: string,
  liveSkillCatalogIndex?: RuntimeLiveSkillCatalogIndex | null
): string {
  const requestedSkillId = skillId.trim();
  const lookupId = normalizeLiveSkillLookupId(requestedSkillId);
  return (
    liveSkillCatalogIndex?.canonicalSkillIdByAcceptedId.get(lookupId) ??
    canonicalizeLiveSkillId(requestedSkillId) ??
    requestedSkillId
  );
}

function resolveAcceptedRuntimeSkillIds(
  requestedSkillId: string,
  resolvedSkillId: string,
  liveSkillCatalogIndex?: RuntimeLiveSkillCatalogIndex | null
): string[] {
  return (
    liveSkillCatalogIndex?.acceptedSkillIdsByCanonicalId.get(resolvedSkillId) ??
    listAcceptedLiveSkillIds(requestedSkillId)
  );
}

export function buildRuntimeSkillIdResolution(
  skillId: string,
  liveSkillCatalogIndex?: RuntimeLiveSkillCatalogIndex | null
): RuntimeSkillIdResolution {
  const requestedSkillId = skillId.trim();
  const resolvedSkillId = resolveRuntimeSkillId(requestedSkillId, liveSkillCatalogIndex);
  return {
    requestedSkillId,
    resolvedSkillId,
    aliasApplied: requestedSkillId !== resolvedSkillId,
    acceptedSkillIds: resolveAcceptedRuntimeSkillIds(
      requestedSkillId,
      resolvedSkillId,
      liveSkillCatalogIndex
    ),
  };
}

export function buildRuntimeAllowedSkillResolution(
  value: unknown,
  helpers: Pick<RuntimeToolHelpers, "toStringArray">,
  liveSkillCatalogIndex?: RuntimeLiveSkillCatalogIndex | null
): RuntimeAllowedSkillResolution | null {
  const requestedSkillIds = helpers.toStringArray(value);
  if (requestedSkillIds.length === 0) {
    return null;
  }
  const entries = requestedSkillIds.map((skillId) =>
    buildRuntimeSkillIdResolution(skillId, liveSkillCatalogIndex)
  );
  return {
    requestedSkillIds,
    resolvedSkillIds: Array.from(new Set(entries.map((entry) => entry.resolvedSkillId))),
    entries,
  };
}

function buildRuntimeLiveSkillCatalogIndex(
  liveSkills: Awaited<ReturnType<NonNullable<RuntimeAgentControl["listLiveSkills"]>>>
): RuntimeLiveSkillCatalogIndex {
  const knownSkillIds = new Set<string>();
  const canonicalSkillIdByAcceptedId = new Map<string, string>();
  const acceptedSkillIdsByCanonicalId = new Map<string, string[]>();

  for (const skill of liveSkills) {
    const canonicalSkillId = canonicalizeLiveSkillId(skill.id) ?? skill.id.trim();
    const acceptedSkillIds = listAcceptedLiveSkillIdsFromCatalogSkill(skill);
    const acceptedSkillEntries = acceptedSkillIdsByCanonicalId.get(canonicalSkillId) ?? [];
    const acceptedSkillEntryLookup = new Set(
      acceptedSkillEntries.map((entry) => normalizeLiveSkillLookupId(entry))
    );
    for (const acceptedSkillId of acceptedSkillIds) {
      const normalizedAcceptedSkillId = normalizeLiveSkillLookupId(acceptedSkillId);
      if (!acceptedSkillEntryLookup.has(normalizedAcceptedSkillId)) {
        acceptedSkillEntries.push(acceptedSkillId);
        acceptedSkillEntryLookup.add(normalizedAcceptedSkillId);
      }
      knownSkillIds.add(normalizedAcceptedSkillId);
      canonicalSkillIdByAcceptedId.set(normalizedAcceptedSkillId, canonicalSkillId);
    }
    acceptedSkillIdsByCanonicalId.set(canonicalSkillId, acceptedSkillEntries);
  }

  return {
    knownSkillIds,
    canonicalSkillIdByAcceptedId,
    acceptedSkillIdsByCanonicalId,
  };
}

export async function getRuntimeLiveSkillCatalogIndex(
  runtimeControl: RuntimeAgentControl
): Promise<RuntimeLiveSkillCatalogIndex | null> {
  if (typeof runtimeControl.listLiveSkills !== "function") {
    return null;
  }
  const liveSkills = await runtimeControl.listLiveSkills();
  return buildRuntimeLiveSkillCatalogIndex(liveSkills);
}

export async function getKnownRuntimeLiveSkillIds(
  runtimeControl: RuntimeAgentControl
): Promise<Set<string> | null> {
  return (await getRuntimeLiveSkillCatalogIndex(runtimeControl))?.knownSkillIds ?? null;
}

export function assertKnownRuntimeLiveSkillIds(
  allowedSkillIds: string[] | null | undefined,
  knownLiveSkillIds: Set<string> | null,
  toolName: string
): void {
  if (!allowedSkillIds || allowedSkillIds.length === 0 || knownLiveSkillIds === null) {
    return;
  }
  const unknownSkillIds = allowedSkillIds.filter(
    (skillId) => !knownLiveSkillIds.has(normalizeLiveSkillLookupId(skillId))
  );
  if (unknownSkillIds.length === 0) {
    return;
  }
  throw invalidInputError(
    `${toolName} received unknown allowedSkillIds: ${unknownSkillIds.join(", ")}.`
  );
}

export function getRequiredSubAgentSessionId(
  input: JsonRecord,
  helpers: RuntimeToolHelpers
): string {
  const sessionId = helpers.toNonEmptyString(input.sessionId);
  if (!sessionId) {
    throw requiredInputError("sessionId is required.");
  }
  return sessionId;
}

export function getRequiredSubAgentInstruction(
  input: JsonRecord,
  helpers: RuntimeToolHelpers
): string {
  const instruction = helpers.toNonEmptyString(input.instruction);
  if (!instruction) {
    throw requiredInputError("instruction is required.");
  }
  return instruction;
}
