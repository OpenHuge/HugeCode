import { requestRequiresSubAgentOrchestration } from "./webMcpBridgeRuntimeToolGuards";
import {
  blockedRequestError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  buildRuntimeAllowedSkillResolution,
  buildRuntimeSubAgentSessionHandle,
  type BuildRuntimeToolsOptions,
  getRuntimeLiveSkillCatalogIndex,
  normalizeSubAgentSpawnInput,
  resolveProviderModelFromInputAndAgent,
  requireSubAgentControlMethod,
  resolveWorkspaceId,
  validateAllowedRuntimeSkillIds,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";

export function buildRuntimeAgentTaskTools(
  options: BuildRuntimeToolsOptions
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const subAgentControl = runtimeControl;

  return [
    {
      name: "start-runtime-run",
      description:
        "Start a runtime agent task for managed execution. Accepts a high-level instruction and orchestration options. Delegated sub-agent flows echo canonicalized allowedSkillIds in allowedSkillResolution.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          threadId: { type: "string" },
          requestId: { type: "string" },
          title: { type: "string" },
          instruction: { type: "string" },
          stepKind: {
            type: "string",
            enum: ["read", "write", "edit", "bash", "js_repl", "diagnostics"],
          },
          executionMode: { type: "string", enum: ["single", "distributed"] },
          accessMode: { type: "string", enum: ["read-only", "on-request", "full-access"] },
          reasonEffort: { type: "string", enum: ["low", "medium", "high", "xhigh"] },
          validationPresetId: { type: "string" },
          provider: { type: "string" },
          modelId: { type: "string" },
          scopeProfile: { type: "string", enum: ["general", "research", "review"] },
          catalogSessionId: { type: "string" },
          allowedSkillIds: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          allowNetwork: { type: "boolean" },
          workspaceReadPaths: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          parentRunId: { type: "string" },
          requiredCapabilities: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          preferredBackendIds: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          waitTimeoutMs: { type: "number" },
          waitPollIntervalMs: { type: "number" },
          closeSubAgentSession: { type: "boolean" },
          closeReason: { type: "string" },
          requiresApproval: { type: "boolean" },
          approvalReason: { type: "string" },
        },
        required: ["instruction"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Start runtime agent task in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const instruction = helpers.toNonEmptyString(input.instruction);
        if (!instruction) {
          throw requiredInputError("instruction is required.");
        }
        const stepKind = helpers.normalizeRuntimeStepKind(input.stepKind);
        const subAgentOrchestrationRequested = requestRequiresSubAgentOrchestration(instruction);
        if (subAgentOrchestrationRequested && (stepKind === "bash" || stepKind === "js_repl")) {
          throw blockedRequestError(
            `instruction requests sub-agent orchestration, so ${stepKind} stepKind is blocked. Use read/write/edit delegation flow instead.`
          );
        }
        const canUseSubAgentSessionFlow =
          subAgentOrchestrationRequested &&
          typeof subAgentControl.spawnSubAgentSession === "function" &&
          typeof subAgentControl.sendSubAgentInstruction === "function" &&
          typeof subAgentControl.waitSubAgentSession === "function";
        if (canUseSubAgentSessionFlow) {
          const spawnSubAgentSession = requireSubAgentControlMethod(
            subAgentControl,
            "spawnSubAgentSession",
            "start-runtime-run"
          );
          const sendSubAgentInstruction = requireSubAgentControlMethod(
            subAgentControl,
            "sendSubAgentInstruction",
            "start-runtime-run"
          );
          const waitSubAgentSession = requireSubAgentControlMethod(
            subAgentControl,
            "waitSubAgentSession",
            "start-runtime-run"
          );
          const catalogSessionId = helpers.toNonEmptyString(input.catalogSessionId);
          const liveSkillCatalogIndex = await getRuntimeLiveSkillCatalogIndex(runtimeControl, {
            sessionId: catalogSessionId,
          });
          const allowedSkillResolution = buildRuntimeAllowedSkillResolution(
            input.allowedSkillIds,
            helpers,
            liveSkillCatalogIndex
          );
          const spawnInput = normalizeSubAgentSpawnInput(
            input,
            snapshot,
            helpers,
            liveSkillCatalogIndex,
            agent
          );
          validateAllowedRuntimeSkillIds(
            spawnInput.allowedSkillIds,
            liveSkillCatalogIndex,
            "start-runtime-run"
          );
          const session = await spawnSubAgentSession(spawnInput);
          const dispatch = await sendSubAgentInstruction({
            sessionId: session.sessionId,
            instruction,
            requestId: helpers.toNonEmptyString(input.requestId) ?? undefined,
            requiresApproval:
              typeof input.requiresApproval === "boolean" ? input.requiresApproval : undefined,
            approvalReason: helpers.toNonEmptyString(input.approvalReason),
          });
          const wait = await waitSubAgentSession({
            sessionId: session.sessionId,
            timeoutMs: helpers.toPositiveInteger(input.waitTimeoutMs),
            pollIntervalMs: helpers.toPositiveInteger(input.waitPollIntervalMs),
          });
          let closeResult: unknown = null;
          const shouldClose =
            typeof input.closeSubAgentSession === "boolean" ? input.closeSubAgentSession : true;
          if (
            shouldClose &&
            typeof subAgentControl.closeSubAgentSession === "function" &&
            (wait.done || wait.timedOut)
          ) {
            closeResult = await subAgentControl.closeSubAgentSession({
              sessionId: session.sessionId,
              reason:
                helpers.toNonEmptyString(input.closeReason) ?? "webmcp:sub-agent-task-complete",
              force: Boolean(wait.timedOut),
            });
          }
          return helpers.buildResponse("Runtime sub-agent session executed.", {
            workspaceId: snapshot.workspaceId,
            session,
            sessionHandle: buildRuntimeSubAgentSessionHandle(
              wait.session ?? dispatch.session ?? session
            ),
            allowedSkillResolution,
            dispatch,
            wait,
            close: closeResult,
            subAgentOrchestrationRequested,
            delegatedViaSubAgentSession: true,
          });
        }
        const callerModelContext = resolveProviderModelFromInputAndAgent(input, agent, helpers);
        const task = await runtimeControl.startTask({
          workspaceId: resolveWorkspaceId(input, snapshot, helpers),
          threadId: helpers.toNonEmptyString(input.threadId),
          requestId: helpers.toNonEmptyString(input.requestId) ?? undefined,
          title: helpers.toNonEmptyString(input.title),
          instruction,
          stepKind,
          executionMode: helpers.normalizeRuntimeExecutionMode(input.executionMode),
          accessMode: helpers.normalizeRuntimeAccessMode(input.accessMode),
          reasonEffort: helpers.normalizeRuntimeReasonEffort(input.reasonEffort),
          validationPresetId: helpers.toNonEmptyString(input.validationPresetId),
          provider: callerModelContext.provider,
          modelId: callerModelContext.modelId,
          requiredCapabilities: helpers.toStringArray(input.requiredCapabilities),
          preferredBackendIds: helpers.toStringArray(input.preferredBackendIds),
          requiresApproval:
            typeof input.requiresApproval === "boolean" ? input.requiresApproval : undefined,
          approvalReason: helpers.toNonEmptyString(input.approvalReason),
        });
        return helpers.buildResponse("Runtime agent task started.", {
          workspaceId: snapshot.workspaceId,
          task,
          subAgentOrchestrationRequested,
        });
      },
    },
    {
      name: "interrupt-runtime-run",
      description: "Interrupt an active runtime agent task while preserving audit history.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["taskId"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Interrupt runtime task in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const taskId = helpers.toNonEmptyString(input.taskId);
        if (!taskId) {
          throw requiredInputError("taskId is required.");
        }
        const result = await runtimeControl.interruptTask({
          taskId,
          reason: helpers.toNonEmptyString(input.reason),
        });
        return helpers.buildResponse("Runtime task interruption submitted.", {
          workspaceId: snapshot.workspaceId,
          result,
        });
      },
    },
    {
      name: "resume-runtime-run",
      description: "Resume an interrupted runtime agent task using the latest durable checkpoint.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["taskId"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Resume runtime task in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const taskId = helpers.toNonEmptyString(input.taskId);
        if (!taskId) {
          throw requiredInputError("taskId is required.");
        }
        if (typeof runtimeControl.resumeTask !== "function") {
          throw methodUnavailableError("resume-runtime-run", "resumeTask");
        }
        const result = await runtimeControl.resumeTask({
          taskId,
          reason: helpers.toNonEmptyString(input.reason),
        });
        return helpers.buildResponse("Runtime task resume submitted.", {
          workspaceId: snapshot.workspaceId,
          result,
        });
      },
    },
    {
      name: "terminate-runtime-run",
      description: "Terminate a runtime agent task immediately by issuing an interrupt command.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["taskId"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Terminate runtime task in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const taskId = helpers.toNonEmptyString(input.taskId);
        if (!taskId) {
          throw requiredInputError("taskId is required.");
        }
        const result = await runtimeControl.interruptTask({
          taskId,
          reason: helpers.toNonEmptyString(input.reason) ?? "webmcp:terminate-runtime-run",
        });
        return helpers.buildResponse("Runtime task termination submitted.", {
          workspaceId: snapshot.workspaceId,
          result,
        });
      },
    },
  ];
}
