import { buildRuntimeAgentTaskTools } from "./webMcpBridgeRuntimeAgentTaskTools";
import { buildRuntimeActionRequiredTools } from "./webMcpBridgeRuntimeActionRequiredTools";
import { buildRuntimeBackendControlTools } from "./webMcpBridgeRuntimeBackendControlTools";
import { buildRuntimeBrowserTools } from "./webMcpBridgeRuntimeBrowserTools";
import { buildRuntimeDiagnosticsTools } from "./webMcpBridgeRuntimeDiagnosticsTools";
import { buildRuntimeDiscoveryTools } from "./webMcpBridgeRuntimeDiscoveryTools";
import { buildRuntimeExtensionTools } from "./webMcpBridgeRuntimeExtensionTools";
import { buildRuntimeGitTools } from "./webMcpBridgeRuntimeGitTools";
import { buildListRuntimeLiveSkillsTool } from "./webMcpBridgeRuntimeLiveSkillTools";
import { buildRuntimeOauthTools } from "./webMcpBridgeRuntimeOauthTools";
import { buildRuntimeOperationsTools } from "./webMcpBridgeRuntimeOperationsTools";
import { buildRuntimePatchTools } from "./webMcpBridgeRuntimePatchTools";
import { buildRuntimePolicyTools } from "./webMcpBridgeRuntimePolicyTools";
import { buildRuntimePromptTools } from "./webMcpBridgeRuntimePromptTools";
import { buildOrchestrateRuntimeSubAgentBatchTool } from "./webMcpBridgeRuntimeSubAgentBatchTool";
import { buildRuntimeSubAgentTools } from "./webMcpBridgeRuntimeSubAgentTools";
import { buildRuntimeTerminalTools } from "./webMcpBridgeRuntimeTerminalTools";
import { buildRuntimeWorkspaceDiagnosticsTools } from "./webMcpBridgeRuntimeWorkspaceDiagnosticsTools";
import {
  buildRuntimeTaskCatalogTools,
  wrapRuntimeComputerObserveTool,
} from "@ku0/code-runtime-webmcp-client/webMcpRuntimeToolCatalog";
import {
  type BuildRuntimeToolsOptions,
  resolveWorkspaceId,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import { buildRuntimeWorkspaceTools } from "./webMcpBridgeRuntimeWorkspaceTools";

export function buildRuntimeTools(options: BuildRuntimeToolsOptions): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const MAX_RUNTIME_FILE_PAYLOAD_BYTES = 512 * 1024;
  const MAX_RUNTIME_COMMAND_CHARS = 8_192;

  const tools: WebMcpToolDescriptor[] = [
    ...buildRuntimeTaskCatalogTools({
      snapshot,
      runtimeControl,
      resolveWorkspaceId: (input) => resolveWorkspaceId(input, snapshot, helpers),
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
        normalizeRuntimeTaskStatus: helpers.normalizeRuntimeTaskStatus,
      },
    }),
    buildListRuntimeLiveSkillsTool({
      snapshot,
      runtimeControl,
      helpers: { buildResponse: helpers.buildResponse, toNonEmptyString: helpers.toNonEmptyString },
    }),
    ...buildRuntimeDiagnosticsTools({
      snapshot,
      runtimeControl,
      helpers: { buildResponse: helpers.buildResponse, toNonEmptyString: helpers.toNonEmptyString },
    }),
    ...buildRuntimeTerminalTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
      },
    }),
    ...buildRuntimeBackendControlTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
        toStringArray: helpers.toStringArray,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimePolicyTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimeOauthTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
      },
    }),
    ...buildRuntimeDiscoveryTools({
      snapshot,
      runtimeControl,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
      },
    }),
    ...buildRuntimeBrowserTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers,
    }),
    ...buildRuntimeWorkspaceDiagnosticsTools({
      snapshot,
      runtimeControl,
      helpers,
    }),
    ...buildRuntimePatchTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers,
    }),
    ...buildRuntimeExtensionTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
      },
    }),
    ...buildRuntimeOperationsTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimePromptTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
      },
    }),
    ...buildRuntimeGitTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimeWorkspaceTools({
      ...options,
      maxRuntimeFilePayloadBytes: MAX_RUNTIME_FILE_PAYLOAD_BYTES,
      maxRuntimeCommandChars: MAX_RUNTIME_COMMAND_CHARS,
    }),
    ...buildRuntimeAgentTaskTools(options),
    buildOrchestrateRuntimeSubAgentBatchTool({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toStringArray: helpers.toStringArray,
        toPositiveInteger: helpers.toPositiveInteger,
        normalizeRuntimeAccessMode: helpers.normalizeRuntimeAccessMode,
        normalizeRuntimeReasonEffort: helpers.normalizeRuntimeReasonEffort,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimeSubAgentTools(options),
    ...buildRuntimeActionRequiredTools(options),
    {
      name: "interrupt-runtime-active-tasks",
      description: "Interrupt all active runtime tasks (queued/running/awaiting_approval).",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          reason: { type: "string" },
        },
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Interrupt all active runtime tasks in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const activeTasks = await runtimeControl.listTasks({
          workspaceId,
          status: null,
          limit: 100,
        });
        const candidates = activeTasks.filter(
          (task) =>
            task.status === "queued" ||
            task.status === "running" ||
            task.status === "awaiting_approval"
        );
        if (candidates.length === 0) {
          return helpers.buildResponse("No active runtime tasks to interrupt.", {
            workspaceId: snapshot.workspaceId,
            interruptedCount: 0,
            taskIds: [],
          });
        }
        const reason =
          helpers.toNonEmptyString(input.reason) ?? "webmcp:interrupt-runtime-active-tasks";
        await Promise.all(
          candidates.map((task) =>
            runtimeControl.interruptTask({
              taskId: task.taskId,
              reason,
            })
          )
        );
        return helpers.buildResponse("Active runtime tasks interrupted.", {
          workspaceId: snapshot.workspaceId,
          interruptedCount: candidates.length,
          taskIds: candidates.map((task) => task.taskId),
        });
      },
    },
  ];

  return tools.map(wrapRuntimeComputerObserveTool);
}
