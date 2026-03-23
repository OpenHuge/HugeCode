import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import {
  createRuntimeEnvelope,
  createRuntimeError,
} from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import { buildWebMcpPrompts, buildWebMcpResources } from "./webMcpBridgeContextDescriptors";
import {
  buildCapabilityMatrix,
  formatMissingMethodsMessage,
  getModelContext,
  type WebMcpModelContext,
  type WebMcpRegistrationHandle,
} from "./webMcpBridgeModelContextApi";
import { buildReadTools } from "./webMcpBridgeReadTools";
import { buildRuntimeTools } from "./webMcpBridgeRuntimeTools";
import { invalidateCachedRuntimeLiveSkills } from "./webMcpBridgeRuntimeWorkspaceTools";
import {
  AGENT_CONTROL_TOOL_NAMES,
  AGENT_RUNTIME_CONTROL_TOOL_NAMES,
} from "./webMcpBridgeToolNames";
import { wrapToolsWithInputSchemaPreflight } from "./webMcpBridgeToolPreflight";
import { resolveRuntimeToolExposurePolicy } from "../application/runtime/facades/runtimeToolExposurePolicy";
import { subscribeScopedRuntimeUpdatedEvents } from "../application/runtime/ports/runtimeUpdatedEvents";
import type {
  AgentCommandCenterActions,
  AgentCommandCenterSnapshot,
  AgentIntentPriority,
  AgentIntentState,
  RuntimeAgentAccessMode,
  RuntimeAgentReasonEffort,
  RuntimeAgentTaskExecutionMode,
  RuntimeAgentTaskStatus,
  RuntimeAgentTaskStepKind,
  WebMcpAgent,
  WebMcpSyncOptions,
  WebMcpSyncResult,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type WebMcpToolExecutor = (input: JsonRecord, agent: WebMcpAgent | null) => unknown;

type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: WebMcpToolExecutor;
};

let activeToolNames = new Set<string>();
let activeResourceUris = new Set<string>();
let activePromptNames = new Set<string>();
let activeRegistrations: Array<() => void | Promise<void>> = [];
let activeSyncMode: WebMcpSyncResult["mode"] = "disabled";
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

function uniqueTools(tools: WebMcpToolDescriptor[]): WebMcpToolDescriptor[] {
  const seen = new Set<string>();
  return tools.filter((tool) => {
    if (seen.has(tool.name)) {
      return false;
    }
    seen.add(tool.name);
    return true;
  });
}

function resetRegisteredState(): void {
  activeToolNames = new Set();
  activeResourceUris = new Set();
  activePromptNames = new Set();
  activeRegistrations = [];
  activeSyncMode = "disabled";
}

async function clearRegisteredContext(modelContext: WebMcpModelContext): Promise<void> {
  if (typeof modelContext.clearContext === "function") {
    await modelContext.clearContext();
    resetRegisteredState();
    return;
  }

  if (typeof modelContext.provideContext === "function") {
    await modelContext.provideContext({ tools: [], resources: [], prompts: [] });
  }

  const activeHandles = [...activeRegistrations].reverse();
  for (const unregister of activeHandles) {
    await unregister();
  }

  if (typeof modelContext.unregisterTool === "function") {
    const toolNames = [...activeToolNames];
    for (const toolName of toolNames) {
      await modelContext.unregisterTool(toolName);
    }
  }

  if (typeof modelContext.unregisterResource === "function") {
    const resourceUris = [...activeResourceUris];
    for (const uri of resourceUris) {
      await modelContext.unregisterResource(uri);
    }
  }

  if (typeof modelContext.unregisterPrompt === "function") {
    const promptNames = [...activePromptNames];
    for (const promptName of promptNames) {
      await modelContext.unregisterPrompt(promptName);
    }
  }

  resetRegisteredState();
}

function trackRegistrationHandle(registration: WebMcpRegistrationHandle | undefined): void {
  if (!registration || typeof registration.unregister !== "function") {
    return;
  }
  activeRegistrations.push(() => registration.unregister?.());
}

function cacheActiveCatalog(
  tools: WebMcpToolDescriptor[],
  resources: ReturnType<typeof buildWebMcpResources>,
  prompts: ReturnType<typeof buildWebMcpPrompts>,
  mode: WebMcpSyncResult["mode"]
): void {
  activeToolNames = new Set(tools.map((tool) => tool.name));
  activeResourceUris = new Set(resources.map((resource) => resource.uri));
  activePromptNames = new Set(prompts.map((prompt) => prompt.name));
  activeSyncMode = mode;
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

type WebMcpSyncResultOptions = {
  supported: boolean;
  enabled: boolean;
  mode: WebMcpSyncResult["mode"];
  capabilities: WebMcpSyncResult["capabilities"];
  error: string | null;
  registeredTools?: number;
  registeredResources?: number;
  registeredPrompts?: number;
};

function createWebMcpSyncResult(options: WebMcpSyncResultOptions): WebMcpSyncResult {
  return {
    supported: options.supported,
    enabled: options.enabled,
    mode: options.mode,
    registeredTools: options.registeredTools ?? 0,
    registeredResources: options.registeredResources ?? 0,
    registeredPrompts: options.registeredPrompts ?? 0,
    capabilities: options.capabilities,
    error: options.error,
  };
}

export async function syncWebMcpAgentControl(
  options: WebMcpSyncOptions
): Promise<WebMcpSyncResult> {
  const modelContext = getModelContext();
  const capabilities = buildCapabilityMatrix(modelContext);
  if (!modelContext) {
    return createWebMcpSyncResult({
      supported: false,
      enabled: false,
      mode: "disabled",
      capabilities,
      error: "WebMCP modelContext is unavailable in this browser.",
    });
  }

  if (!capabilities.supported) {
    return createWebMcpSyncResult({
      supported: false,
      enabled: false,
      mode: "disabled",
      capabilities,
      error: formatMissingMethodsMessage(capabilities.missingRequired),
    });
  }

  if (!options.enabled) {
    syncRuntimeLiveSkillCatalogInvalidation(options);
    await clearRegisteredContext(modelContext);
    return createWebMcpSyncResult({
      supported: true,
      enabled: false,
      mode: "disabled",
      capabilities,
      error: null,
    });
  }

  const readTools = buildReadTools(options.snapshot, {
    buildResponse,
  });
  const writeTools = options.readOnlyMode
    ? []
    : wrapToolsWithInputSchemaPreflight(
        buildWriteTools(
          options.snapshot,
          options.actions,
          options.requireUserApproval,
          options.onApprovalRequest
        ),
        "write"
      );
  const runtimeTools = wrapToolsWithInputSchemaPreflight(
    buildRuntimeControlTools(options),
    "runtime"
  );
  syncRuntimeLiveSkillCatalogInvalidation(options);
  const allTools = uniqueTools([...readTools, ...writeTools, ...runtimeTools]);
  const toolExposureDecision = resolveRuntimeToolExposurePolicy({
    provider: options.activeModelContext?.provider ?? null,
    modelId: options.activeModelContext?.modelId ?? null,
    toolNames: allTools.map((tool) => tool.name),
    runtimeToolNames: AGENT_RUNTIME_CONTROL_TOOL_NAMES,
  });
  const visibleToolNames = new Set(toolExposureDecision.visibleToolNames);
  const tools = allTools.filter((tool) => visibleToolNames.has(tool.name));
  const resources = buildWebMcpResources(options.snapshot, {
    activeModelContext: options.activeModelContext,
    toolExposureDecision,
    runtimeToolNames: AGENT_RUNTIME_CONTROL_TOOL_NAMES,
  });
  const prompts = buildWebMcpPrompts(options.snapshot, {
    activeModelContext: options.activeModelContext,
    toolExposureDecision,
    runtimeToolNames: AGENT_RUNTIME_CONTROL_TOOL_NAMES,
  });

  try {
    if (typeof modelContext.provideContext === "function") {
      if (activeSyncMode !== "provideContext") {
        await clearRegisteredContext(modelContext);
      }
      await modelContext.provideContext({ tools, resources, prompts });
      cacheActiveCatalog(tools, resources, prompts, "provideContext");
      return createWebMcpSyncResult({
        supported: true,
        enabled: true,
        mode: "provideContext",
        registeredTools: tools.length,
        registeredResources: resources.length,
        registeredPrompts: prompts.length,
        capabilities,
        error: null,
      });
    }

    await clearRegisteredContext(modelContext);

    const registerTool = modelContext.registerTool;
    const registerResource = modelContext.registerResource;
    const registerPrompt = modelContext.registerPrompt;
    if (
      typeof registerTool === "function" &&
      typeof registerResource === "function" &&
      typeof registerPrompt === "function"
    ) {
      for (const tool of tools) {
        const registration = await registerTool(tool);
        trackRegistrationHandle(registration);
      }
      for (const resource of resources) {
        const registration = await registerResource(resource);
        trackRegistrationHandle(registration);
      }
      for (const prompt of prompts) {
        const registration = await registerPrompt(prompt);
        trackRegistrationHandle(registration);
      }
      cacheActiveCatalog(tools, resources, prompts, "registerTool");
      return createWebMcpSyncResult({
        supported: true,
        enabled: true,
        mode: "registerTool",
        registeredTools: tools.length,
        registeredResources: resources.length,
        registeredPrompts: prompts.length,
        capabilities,
        error: null,
      });
    }

    return createWebMcpSyncResult({
      supported: false,
      enabled: false,
      mode: "disabled",
      capabilities,
      error:
        "WebMCP modelContext does not expose registration methods for tools, resources, and prompts.",
    });
  } catch (error) {
    return createWebMcpSyncResult({
      supported: true,
      enabled: true,
      mode: "disabled",
      capabilities,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function teardownWebMcpAgentControl(): Promise<void> {
  teardownRuntimeLiveSkillCatalogInvalidation();
  invalidateCachedRuntimeLiveSkills();
  const modelContext = getModelContext();
  if (!modelContext) {
    return;
  }
  await clearRegisteredContext(modelContext);
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
