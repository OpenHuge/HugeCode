import {
  buildCapabilityMatrix,
  formatMissingMethodsMessage,
  getModelContext,
} from "./webMcpBridgeModelContextApi";
import type {
  AgentCommandCenterActions,
  AgentCommandCenterSnapshot,
  RuntimeAgentControl,
  WebMcpActiveModelContext,
  WebMcpPromptDescriptor,
  WebMcpResourceDescriptor,
  WebMcpSyncResult,
  WebMcpToolDescriptor,
} from "./webMcpBridgeTypes";

export type WebMcpToolExposureDecision = {
  provider: string;
  mode: "full" | "slim";
  visibleToolNames: string[];
  hiddenToolNames: string[];
  reasonCodes: string[];
};

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

type WebMcpContextDescriptorOptions = {
  activeModelContext?: WebMcpActiveModelContext | null;
  toolExposureDecision?: WebMcpToolExposureDecision | null;
  runtimeToolNames?: readonly string[];
};

type WebMcpBuildWriteToolsParams<
  TSnapshot extends AgentCommandCenterSnapshot,
  TActions extends AgentCommandCenterActions,
> = {
  snapshot: TSnapshot;
  actions: TActions;
  requireUserApproval: boolean;
  onApprovalRequest?: (message: string) => Promise<boolean>;
};

type WebMcpBuildRuntimeToolsParams<
  TSnapshot extends AgentCommandCenterSnapshot,
  TRuntimeControl extends RuntimeAgentControl,
  TResponseRequiredState,
> = {
  snapshot: TSnapshot;
  runtimeControl: TRuntimeControl | null;
  requireUserApproval: boolean;
  responseRequiredState?: TResponseRequiredState;
  onApprovalRequest?: (message: string) => Promise<boolean>;
};

export type WebMcpAgentControlSyncOptions<
  TSnapshot extends AgentCommandCenterSnapshot,
  TActions extends AgentCommandCenterActions,
  TRuntimeControl extends RuntimeAgentControl,
  TResponseRequiredState,
> = {
  enabled: boolean;
  readOnlyMode: boolean;
  requireUserApproval: boolean;
  snapshot: TSnapshot;
  actions: TActions;
  activeModelContext?: WebMcpActiveModelContext | null;
  runtimeControl?: TRuntimeControl | null;
  responseRequiredState?: TResponseRequiredState;
  onApprovalRequest?: (message: string) => Promise<boolean>;
  runtimeToolNames: readonly string[];
  buildReadTools: (snapshot: TSnapshot) => WebMcpToolDescriptor[];
  buildWriteTools: (
    params: WebMcpBuildWriteToolsParams<TSnapshot, TActions>
  ) => WebMcpToolDescriptor[];
  buildRuntimeTools: (
    params: WebMcpBuildRuntimeToolsParams<TSnapshot, TRuntimeControl, TResponseRequiredState>
  ) => WebMcpToolDescriptor[];
  wrapToolsWithInputSchemaPreflight: (
    tools: WebMcpToolDescriptor[],
    scope: "write" | "runtime"
  ) => WebMcpToolDescriptor[];
  resolveToolExposurePolicy: (input: {
    provider?: string | null;
    modelId?: string | null;
    toolNames: string[];
    runtimeToolNames?: readonly string[];
  }) => WebMcpToolExposureDecision;
  buildResources: (
    snapshot: TSnapshot,
    options?: WebMcpContextDescriptorOptions
  ) => WebMcpResourceDescriptor[];
  buildPrompts: (
    snapshot: TSnapshot,
    options?: WebMcpContextDescriptorOptions
  ) => WebMcpPromptDescriptor[];
};

let activeToolNames = new Set<string>();
let activeResourceUris = new Set<string>();
let activePromptNames = new Set<string>();
let activeRegistrations: Array<() => void | Promise<void>> = [];
let activeSyncMode: WebMcpSyncResult["mode"] = "disabled";

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

async function clearRegisteredContext(
  modelContext: NonNullable<ReturnType<typeof getModelContext>>
): Promise<void> {
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
    for (const toolName of activeToolNames) {
      await modelContext.unregisterTool(toolName);
    }
  }

  if (typeof modelContext.unregisterResource === "function") {
    for (const resourceUri of activeResourceUris) {
      await modelContext.unregisterResource(resourceUri);
    }
  }

  if (typeof modelContext.unregisterPrompt === "function") {
    for (const promptName of activePromptNames) {
      await modelContext.unregisterPrompt(promptName);
    }
  }

  resetRegisteredState();
}

function trackRegistrationHandle(
  registration: { unregister?: () => void | Promise<void> } | undefined
): void {
  if (!registration || typeof registration.unregister !== "function") {
    return;
  }
  activeRegistrations.push(() => registration.unregister?.());
}

function cacheActiveCatalog(
  tools: WebMcpToolDescriptor[],
  resources: WebMcpResourceDescriptor[],
  prompts: WebMcpPromptDescriptor[],
  mode: WebMcpSyncResult["mode"]
): void {
  activeToolNames = new Set(tools.map((tool) => tool.name));
  activeResourceUris = new Set(resources.map((resource) => resource.uri));
  activePromptNames = new Set(prompts.map((prompt) => prompt.name));
  activeSyncMode = mode;
}

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

export async function syncWebMcpAgentControl<
  TSnapshot extends AgentCommandCenterSnapshot,
  TActions extends AgentCommandCenterActions,
  TRuntimeControl extends RuntimeAgentControl,
  TResponseRequiredState,
>(
  options: WebMcpAgentControlSyncOptions<
    TSnapshot,
    TActions,
    TRuntimeControl,
    TResponseRequiredState
  >
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
    await clearRegisteredContext(modelContext);
    return createWebMcpSyncResult({
      supported: true,
      enabled: false,
      mode: "disabled",
      capabilities,
      error: null,
    });
  }

  const readTools = options.buildReadTools(options.snapshot);
  const writeTools = options.readOnlyMode
    ? []
    : options.wrapToolsWithInputSchemaPreflight(
        options.buildWriteTools({
          snapshot: options.snapshot,
          actions: options.actions,
          requireUserApproval: options.requireUserApproval,
          onApprovalRequest: options.onApprovalRequest,
        }),
        "write"
      );
  const runtimeTools = options.wrapToolsWithInputSchemaPreflight(
    options.buildRuntimeTools({
      snapshot: options.snapshot,
      runtimeControl: options.runtimeControl ?? null,
      requireUserApproval: options.requireUserApproval,
      responseRequiredState: options.responseRequiredState,
      onApprovalRequest: options.onApprovalRequest,
    }),
    "runtime"
  );
  const allTools = uniqueTools([...readTools, ...writeTools, ...runtimeTools]);
  const toolExposureDecision = options.resolveToolExposurePolicy({
    provider: options.activeModelContext?.provider ?? null,
    modelId: options.activeModelContext?.modelId ?? null,
    toolNames: allTools.map((tool) => tool.name),
    runtimeToolNames: options.runtimeToolNames,
  });
  const visibleToolNames = new Set(toolExposureDecision.visibleToolNames);
  const tools = allTools.filter((tool) => visibleToolNames.has(tool.name));
  const resources = options.buildResources(options.snapshot, {
    activeModelContext: options.activeModelContext,
    toolExposureDecision,
    runtimeToolNames: options.runtimeToolNames,
  });
  const prompts = options.buildPrompts(options.snapshot, {
    activeModelContext: options.activeModelContext,
    toolExposureDecision,
    runtimeToolNames: options.runtimeToolNames,
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

    const { registerPrompt, registerResource, registerTool } = modelContext;
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
  const modelContext = getModelContext();
  if (!modelContext) {
    return;
  }
  await clearRegisteredContext(modelContext);
}
