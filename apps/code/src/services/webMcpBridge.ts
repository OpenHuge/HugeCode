import {
  buildAgentControlWriteTools,
  buildResponse,
  confirmWriteAction,
  normalizeRuntimeAccessMode,
  normalizeRuntimeExecutionMode,
  normalizeRuntimeReasonEffort,
  normalizeRuntimeStepKind,
  normalizeRuntimeTaskStatus,
  toNonEmptyString,
  toPositiveInteger,
  toStringArray,
} from "@ku0/code-runtime-webmcp-client/webMcpAgentControlCatalog";
import {
  syncWebMcpAgentControl as syncWebMcpAgentControlShared,
  teardownWebMcpAgentControl as teardownWebMcpAgentControlShared,
} from "@ku0/code-runtime-webmcp-client/webMcpBridge";
import {
  buildWebMcpPrompts,
  buildWebMcpResources,
  type WebMcpContextDescriptorOptions,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeContextDescriptors";
import { buildReadTools } from "@ku0/code-runtime-webmcp-client/webMcpBridgeReadTools";
import { buildRuntimeTools } from "./webMcpBridgeRuntimeTools";
import { invalidateCachedRuntimeLiveSkills } from "./webMcpBridgeRuntimeWorkspaceTools";
import {
  AGENT_CONTROL_TOOL_NAMES,
  AGENT_RUNTIME_CONTROL_TOOL_NAMES,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeToolNames";
import { wrapToolsWithInputSchemaPreflight } from "./webMcpBridgeToolPreflight";
import {
  resolveRuntimeToolExposurePolicy,
  type RuntimeToolExposurePolicyDecision,
} from "../application/runtime/facades/runtimeToolExposurePolicy";
import { subscribeScopedRuntimeUpdatedEvents } from "../application/runtime/ports/runtimeUpdatedEvents";
import type {
  WebMcpSyncOptions,
  WebMcpSyncResult,
  WebMcpToolDescriptor,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
let activeRuntimeLiveSkillCatalogUnsubscribe: (() => void) | null = null;

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

function buildRuntimeControlTools(options: WebMcpSyncOptions): WebMcpToolDescriptor[] {
  if (!options.runtimeControl) {
    return [];
  }

  const allowedRuntimeToolNames = new Set<string>(AGENT_RUNTIME_CONTROL_TOOL_NAMES);
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
  const canonicalRuntimeTools = runtimeTools.filter((tool) =>
    allowedRuntimeToolNames.has(tool.name)
  );

  return options.readOnlyMode
    ? canonicalRuntimeTools.filter((tool) => tool.annotations?.readOnlyHint === true)
    : canonicalRuntimeTools;
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
      buildAgentControlWriteTools({
        snapshot,
        actions,
        requireUserApproval,
        onApprovalRequest,
        buildResponse,
      }),
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
