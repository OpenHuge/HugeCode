import { resourceNotFoundError } from "./webMcpBridgeRuntimeToolHelpers";
import {
  assertKnownRuntimeLiveSkillIds,
  buildRuntimeAllowedSkillResolution,
  buildRuntimeSubAgentSessionHandle,
  type BuildRuntimeToolsOptions,
  getRuntimeLiveSkillCatalogIndex,
  getRequiredSubAgentInstruction,
  getRequiredSubAgentSessionId,
  normalizeSubAgentSpawnInput,
  requireSubAgentControlMethod,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";

export function buildRuntimeSubAgentTools(
  options: BuildRuntimeToolsOptions
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const subAgentControl = runtimeControl;

  return [
    {
      name: "spawn-runtime-sub-agent-session",
      description:
        "Create a runtime sub-agent session. The returned sessionId is the primary handle for send, wait, status, interrupt, and close operations. allowedSkillIds aliases are canonicalized and echoed in allowedSkillResolution.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          threadId: { type: "string" },
          title: { type: "string" },
          accessMode: { type: "string", enum: ["read-only", "on-request", "full-access"] },
          reasonEffort: { type: "string", enum: ["low", "medium", "high", "xhigh"] },
          provider: { type: "string" },
          modelId: { type: "string" },
          scopeProfile: { type: "string", enum: ["general", "research", "review"] },
          allowedSkillIds: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          allowNetwork: { type: "boolean" },
          workspaceReadPaths: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          parentRunId: { type: "string" },
        },
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Spawn runtime sub-agent session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const spawnSubAgentSession = requireSubAgentControlMethod(
          subAgentControl,
          "spawnSubAgentSession",
          "spawn-runtime-sub-agent-session"
        );
        const liveSkillCatalogIndex = await getRuntimeLiveSkillCatalogIndex(runtimeControl);
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
        assertKnownRuntimeLiveSkillIds(
          spawnInput.allowedSkillIds,
          liveSkillCatalogIndex?.knownSkillIds ?? null,
          "spawn-runtime-sub-agent-session"
        );
        const session = await spawnSubAgentSession(spawnInput);
        return helpers.buildResponse("Runtime sub-agent session spawned.", {
          workspaceId: session.workspaceId,
          session,
          sessionHandle: buildRuntimeSubAgentSessionHandle(session),
          allowedSkillResolution,
        });
      },
    },
    {
      name: "send-runtime-sub-agent-instruction",
      description:
        "Send an instruction to an existing runtime sub-agent session. Use sessionId as the stable handle for follow-up wait and status calls.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          instruction: { type: "string" },
          requestId: { type: "string" },
          requiresApproval: { type: "boolean" },
          approvalReason: { type: "string" },
        },
        required: ["sessionId", "instruction"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Send runtime sub-agent instruction in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const sendSubAgentInstruction = requireSubAgentControlMethod(
          subAgentControl,
          "sendSubAgentInstruction",
          "send-runtime-sub-agent-instruction"
        );
        const sessionId = getRequiredSubAgentSessionId(input, helpers);
        const instruction = getRequiredSubAgentInstruction(input, helpers);
        const dispatch = await sendSubAgentInstruction({
          sessionId,
          instruction,
          requestId: helpers.toNonEmptyString(input.requestId) ?? undefined,
          requiresApproval:
            typeof input.requiresApproval === "boolean" ? input.requiresApproval : undefined,
          approvalReason: helpers.toNonEmptyString(input.approvalReason),
        });
        return helpers.buildResponse("Runtime sub-agent instruction dispatched.", {
          workspaceId: snapshot.workspaceId,
          dispatch,
          sessionHandle: buildRuntimeSubAgentSessionHandle(dispatch.session),
        });
      },
    },
    {
      name: "wait-runtime-sub-agent-session",
      description:
        "Wait for a runtime sub-agent session to advance or complete. sessionId remains the primary tracking handle across polls.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          timeoutMs: { type: "number" },
          pollIntervalMs: { type: "number" },
        },
        required: ["sessionId"],
      },
      execute: async (input) => {
        const waitSubAgentSession = requireSubAgentControlMethod(
          subAgentControl,
          "waitSubAgentSession",
          "wait-runtime-sub-agent-session"
        );
        const sessionId = getRequiredSubAgentSessionId(input, helpers);
        const result = await waitSubAgentSession({
          sessionId,
          timeoutMs: helpers.toPositiveInteger(input.timeoutMs),
          pollIntervalMs: helpers.toPositiveInteger(input.pollIntervalMs),
        });
        return helpers.buildResponse("Runtime sub-agent session wait completed.", {
          workspaceId: snapshot.workspaceId,
          wait: result,
          sessionHandle: buildRuntimeSubAgentSessionHandle(result.session),
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-sub-agent-session-status",
      description:
        "Get the latest status snapshot for a runtime sub-agent session by sessionId, the primary durable tracking handle.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      },
      execute: async (input) => {
        const getSubAgentSessionStatus = requireSubAgentControlMethod(
          subAgentControl,
          "getSubAgentSessionStatus",
          "get-runtime-sub-agent-session-status"
        );
        const sessionId = getRequiredSubAgentSessionId(input, helpers);
        const session = await getSubAgentSessionStatus({ sessionId });
        if (!session) {
          throw resourceNotFoundError(`Runtime sub-agent session ${sessionId} was not found.`);
        }
        return helpers.buildResponse("Runtime sub-agent session status retrieved.", {
          workspaceId: session.workspaceId,
          session,
          sessionHandle: buildRuntimeSubAgentSessionHandle(session),
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "interrupt-runtime-sub-agent-session",
      description:
        "Interrupt the active work in a runtime sub-agent session while preserving session history.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["sessionId"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Interrupt runtime sub-agent session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const interruptSubAgentSession = requireSubAgentControlMethod(
          subAgentControl,
          "interruptSubAgentSession",
          "interrupt-runtime-sub-agent-session"
        );
        const sessionId = getRequiredSubAgentSessionId(input, helpers);
        const result = await interruptSubAgentSession({
          sessionId,
          reason: helpers.toNonEmptyString(input.reason),
        });
        return helpers.buildResponse("Runtime sub-agent session interruption submitted.", {
          workspaceId: snapshot.workspaceId,
          result,
          sessionHandle: buildRuntimeSubAgentSessionHandle({
            sessionId: result.sessionId,
            status: result.status,
          }),
        });
      },
    },
    {
      name: "close-runtime-sub-agent-session",
      description:
        "Close a runtime sub-agent session by sessionId and optionally force close when needed.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          reason: { type: "string" },
          force: { type: "boolean" },
        },
        required: ["sessionId"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Close runtime sub-agent session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const closeSubAgentSession = requireSubAgentControlMethod(
          subAgentControl,
          "closeSubAgentSession",
          "close-runtime-sub-agent-session"
        );
        const sessionId = getRequiredSubAgentSessionId(input, helpers);
        const result = await closeSubAgentSession({
          sessionId,
          reason: helpers.toNonEmptyString(input.reason),
          force: typeof input.force === "boolean" ? input.force : undefined,
        });
        return helpers.buildResponse("Runtime sub-agent session close submitted.", {
          workspaceId: snapshot.workspaceId,
          result,
          sessionHandle: buildRuntimeSubAgentSessionHandle({
            sessionId: result.sessionId,
            status: result.status,
          }),
        });
      },
    },
  ];
}
