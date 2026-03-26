import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import {
  createRuntimeEnvelope,
  createRuntimeError,
} from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import {
  syncWebMcpAgentControl as syncWebMcpAgentControlShared,
  teardownWebMcpAgentControl as teardownWebMcpAgentControlShared,
} from "@ku0/code-runtime-webmcp-client/webMcpBridge";
import {
  buildWebMcpPrompts,
  buildWebMcpResources,
  type WebMcpContextDescriptorOptions,
} from "./webMcpBridgeContextDescriptors";
import { buildReadTools } from "./webMcpBridgeReadTools";
import { buildRuntimeTools } from "./webMcpBridgeRuntimeTools";
import { invalidateCachedRuntimeLiveSkills } from "./webMcpBridgeRuntimeWorkspaceTools";
import {
  AGENT_CONTROL_TOOL_NAMES,
  AGENT_RUNTIME_CONTROL_TOOL_NAMES,
} from "./webMcpBridgeToolNames";
import { wrapToolsWithInputSchemaPreflight } from "./webMcpBridgeToolPreflight";
import {
  resolveRuntimeToolExposurePolicy,
  type RuntimeToolExposurePolicyDecision,
} from "../application/runtime/facades/runtimeToolExposurePolicy";
import { subscribeScopedRuntimeUpdatedEvents } from "../application/runtime/ports/runtimeUpdatedEvents";
import type {
  AgentCommandCenterActions,
  AgentCommandCenterSnapshot,
  AgentIntentPriority,
  AgentIntentState,
  JsonRecord,
  RuntimeAgentAccessMode,
  RuntimeAgentReasonEffort,
  RuntimeAgentTaskExecutionMode,
  RuntimeAgentTaskStatus,
  RuntimeAgentTaskStepKind,
  WebMcpAgent,
  WebMcpSyncOptions,
  WebMcpSyncResult,
  WebMcpToolDescriptor,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
let activeRuntimeLiveSkillCatalogUnsubscribe: (() => void) | null = null;

function normalizeRuntimeTaskStatus(value: unknown): RuntimeAgentTaskStatus | null {
  if (
    value === "queued" ||
    value === "running" ||
    value === "awaiting_approval" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "interrupted"
  ) {
    return value;
  }
  return null;
}

function teardownRuntimeLiveSkillCatalogInvalidation(): void {
  activeRuntimeLiveSkillCatalogUnsubscribe?.();
  activeRuntimeLiveSkillCatalogUnsubscribe = null;
}

function syncRuntimeLiveSkillCatalogInvalidation(options: WebMcpSyncOptions): void {
  teardownRuntimeLiveSkillCatalogInvalidation();
  const listLiveSkills = options.runtimeControl?.listLiveSkills;
  invalidateCachedRuntimeLiveSkills(listLiveSkills);
  if (!options.enabled || typeof listLiveSkills !== "function") {
    return;
  }
  activeRuntimeLiveSkillCatalogUnsubscribe = subscribeScopedRuntimeUpdatedEvents(
    {
      workspaceId: options.snapshot.workspaceId,
      scopes: ["bootstrap", "skills"],
    },
    () => {
      invalidateCachedRuntimeLiveSkills(listLiveSkills);
    }
  );
}

function normalizeRuntimeExecutionMode(value: unknown): RuntimeAgentTaskExecutionMode {
  if (value === "distributed") {
    return "distributed";
  }
  return "single";
}

function normalizeRuntimeStepKind(value: unknown): RuntimeAgentTaskStepKind {
  if (
    value === "write" ||
    value === "edit" ||
    value === "bash" ||
    value === "js_repl" ||
    value === "diagnostics"
  ) {
    return value;
  }
  return "read";
}

function normalizeRuntimeAccessMode(value: unknown): RuntimeAgentAccessMode {
  if (value === "read-only" || value === "full-access") {
    return value;
  }
  return "on-request";
}

function normalizeRuntimeReasonEffort(value: unknown): RuntimeAgentReasonEffort | null {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return null;
}

function normalizeIntentPriority(value: unknown): AgentIntentPriority {
  if (value === "low" || value === "high" || value === "critical") {
    return value;
  }
  return "medium";
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const parsed = Math.floor(value);
  if (parsed <= 0) {
    return null;
  }
  return parsed;
}

function buildResponse(message: string, data: JsonRecord, code?: string): JsonRecord {
  return createRuntimeEnvelope({ code, message, data });
}

async function confirmWriteAction(
  agent: WebMcpAgent | null,
  requireUserApproval: boolean,
  message: string,
  onApprovalRequest?: (message: string) => Promise<boolean>
): Promise<void> {
  if (!requireUserApproval) {
    return;
  }

  const askForApproval = async () => {
    if (onApprovalRequest) {
      return onApprovalRequest(message);
    }
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return window.confirm(message);
    }
    return false;
  };

  const requestUserInteraction =
    agent && typeof agent.requestUserInteraction === "function"
      ? agent.requestUserInteraction
      : null;

  const approved = requestUserInteraction
    ? await requestUserInteraction(() => askForApproval())
    : await askForApproval();

  if (!approved) {
    throw createRuntimeError({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.approvalRejected,
      message: "Action cancelled: user approval is required.",
    });
  }
}

function buildWriteTools(
  snapshot: AgentCommandCenterSnapshot,
  actions: AgentCommandCenterActions,
  requireUserApproval: boolean,
  onApprovalRequest?: (message: string) => Promise<boolean>
): WebMcpToolDescriptor[] {
  const confirmWorkspaceWrite = (agent: WebMcpAgent | null, actionLabel: string) =>
    confirmWriteAction(
      agent,
      requireUserApproval,
      `${actionLabel} workspace ${snapshot.workspaceName}?`,
      onApprovalRequest
    );
  const buildWorkspaceResponse = (message: string, data: JsonRecord) =>
    buildResponse(message, {
      workspaceId: snapshot.workspaceId,
      ...data,
    });

  return [
    {
      name: "set-user-intent",
      description:
        "Update structured user intent fields such as objective, constraints, success criteria, deadline, and priority.",
      inputSchema: {
        type: "object",
        properties: {
          objective: { type: "string" },
          constraints: { type: "string" },
          successCriteria: { type: "string" },
          deadline: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          managerNotes: { type: "string" },
        },
      },
      execute: async (input, agent) => {
        await confirmWorkspaceWrite(agent, "Update intent for");
        const patch: Partial<AgentIntentState> = {};
        if (toNonEmptyString(input.objective) !== null) {
          patch.objective = toNonEmptyString(input.objective) as string;
        }
        if (toNonEmptyString(input.constraints) !== null) {
          patch.constraints = toNonEmptyString(input.constraints) as string;
        }
        if (toNonEmptyString(input.successCriteria) !== null) {
          patch.successCriteria = toNonEmptyString(input.successCriteria) as string;
        }
        if (typeof input.deadline === "string") {
          patch.deadline = input.deadline.trim().length > 0 ? input.deadline.trim() : null;
        }
        if (toNonEmptyString(input.managerNotes) !== null) {
          patch.managerNotes = toNonEmptyString(input.managerNotes) as string;
        }
        if (typeof input.priority === "string") {
          patch.priority = normalizeIntentPriority(input.priority);
        }
        const intent = actions.setIntentPatch(patch);
        return buildWorkspaceResponse("Intent updated.", { intent });
      },
    },
  ];
}

function buildRuntimeControlTools(options: WebMcpSyncOptions): WebMcpToolDescriptor[] {
  if (!options.runtimeControl) {
    return [];
  }

  const runtimeTools = buildRuntimeTools({
    snapshot: options.snapshot,
    runtimeControl: options.runtimeControl,
    requireUserApproval: options.requireUserApproval,
    responseRequiredState: options.responseRequiredState,
    onApprovalRequest: options.onApprovalRequest,
    helpers: {
      buildResponse,
      toNonEmptyString,
      toStringArray,
      toPositiveInteger,
      normalizeRuntimeTaskStatus,
      normalizeRuntimeStepKind,
      normalizeRuntimeExecutionMode,
      normalizeRuntimeAccessMode,
      normalizeRuntimeReasonEffort,
      confirmWriteAction,
    },
  });

  return options.readOnlyMode
    ? runtimeTools.filter((tool) => tool.annotations?.readOnlyHint === true)
    : runtimeTools;
}

function toContextDescriptorOptions(options?: {
  activeModelContext?: WebMcpSyncOptions["activeModelContext"];
  toolExposureDecision?: {
    provider: string;
    mode: "minimal" | "full" | "slim";
    visibleToolNames: string[];
    hiddenToolNames: string[];
    reasonCodes: string[];
  } | null;
  runtimeToolNames?: readonly string[];
}): WebMcpContextDescriptorOptions | undefined {
  if (!options) {
    return undefined;
  }

  const toolExposureDecision = options.toolExposureDecision
    ? ({
        provider: options.toolExposureDecision
          .provider as RuntimeToolExposurePolicyDecision["provider"],
        mode: options.toolExposureDecision.mode,
        visibleToolNames: options.toolExposureDecision.visibleToolNames,
        hiddenToolNames: options.toolExposureDecision.hiddenToolNames,
        reasonCodes: options.toolExposureDecision
          .reasonCodes as RuntimeToolExposurePolicyDecision["reasonCodes"],
      } satisfies RuntimeToolExposurePolicyDecision)
    : null;

  return {
    activeModelContext: options.activeModelContext,
    toolExposureDecision,
    runtimeToolNames: options.runtimeToolNames,
  };
}

export async function syncWebMcpAgentControl(
  options: WebMcpSyncOptions
): Promise<WebMcpSyncResult> {
  syncRuntimeLiveSkillCatalogInvalidation(options);
  return syncWebMcpAgentControlShared({
    ...options,
    runtimeToolNames: AGENT_RUNTIME_CONTROL_TOOL_NAMES,
    buildReadTools: (snapshot) =>
      buildReadTools(snapshot, {
        buildResponse,
      }),
    buildWriteTools: ({ snapshot, actions, requireUserApproval, onApprovalRequest }) =>
      buildWriteTools(snapshot, actions, requireUserApproval, onApprovalRequest),
    buildRuntimeTools: ({
      snapshot,
      runtimeControl,
      requireUserApproval,
      responseRequiredState,
      onApprovalRequest,
    }) =>
      buildRuntimeControlTools({
        ...options,
        snapshot,
        runtimeControl,
        requireUserApproval,
        responseRequiredState,
        onApprovalRequest,
      }),
    wrapToolsWithInputSchemaPreflight,
    resolveToolExposurePolicy: resolveRuntimeToolExposurePolicy,
    buildResources: (snapshot, descriptorOptions) =>
      buildWebMcpResources(snapshot, toContextDescriptorOptions(descriptorOptions)),
    buildPrompts: (snapshot, descriptorOptions) =>
      buildWebMcpPrompts(snapshot, toContextDescriptorOptions(descriptorOptions)),
  });
}

export async function teardownWebMcpAgentControl(): Promise<void> {
  teardownRuntimeLiveSkillCatalogInvalidation();
  invalidateCachedRuntimeLiveSkills();
  await teardownWebMcpAgentControlShared();
}

export {
  callWebMcpTool,
  createWebMcpMessage,
  elicitWebMcpInput,
  getWebMcpCapabilities,
  listWebMcpCatalog,
  supportsWebMcp,
} from "./webMcpBridgeModelContextApi";
export type * from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
export { WebMcpInputSchemaValidationError } from "@ku0/code-runtime-client/webMcpInputSchemaValidationError";
export { invalidateCachedRuntimeLiveSkills } from "./webMcpBridgeRuntimeWorkspaceTools";

export const WEB_MCP_AGENT_CONTROL_TOOL_NAMES = [...AGENT_CONTROL_TOOL_NAMES];
export const WEB_MCP_RUNTIME_CONTROL_TOOL_NAMES = [...AGENT_RUNTIME_CONTROL_TOOL_NAMES];
export const WEB_MCP_ALL_TOOL_NAMES = [
  ...AGENT_CONTROL_TOOL_NAMES,
  ...AGENT_RUNTIME_CONTROL_TOOL_NAMES,
];
