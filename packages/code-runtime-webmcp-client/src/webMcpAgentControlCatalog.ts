import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import {
  createRuntimeEnvelope,
  createRuntimeError,
} from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import type {
  AgentCommandCenterActions,
  AgentCommandCenterSnapshot,
  AgentIntentPriority,
  JsonRecord,
  RuntimeAgentAccessMode,
  RuntimeAgentReasonEffort,
  RuntimeAgentTaskExecutionMode,
  RuntimeAgentTaskStatus,
  RuntimeAgentTaskStepKind,
  WebMcpAgent,
  WebMcpToolDescriptor,
} from "./webMcpBridgeTypes";

export function normalizeRuntimeTaskStatus(value: unknown): RuntimeAgentTaskStatus | null {
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

export function normalizeRuntimeExecutionMode(value: unknown): RuntimeAgentTaskExecutionMode {
  if (value === "distributed") {
    return "distributed";
  }
  return "single";
}

export function normalizeRuntimeStepKind(value: unknown): RuntimeAgentTaskStepKind {
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

export function normalizeRuntimeAccessMode(value: unknown): RuntimeAgentAccessMode {
  if (value === "read-only" || value === "full-access") {
    return value;
  }
  return "on-request";
}

export function normalizeRuntimeReasonEffort(value: unknown): RuntimeAgentReasonEffort | null {
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

export function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toStringArray(value: unknown): string[] {
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

export function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const parsed = Math.floor(value);
  if (parsed <= 0) {
    return null;
  }
  return parsed;
}

export function buildResponse(message: string, data: JsonRecord, code?: string): JsonRecord {
  return createRuntimeEnvelope({ code, message, data });
}

export async function confirmWriteAction(
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

type BuildAgentControlWriteToolsOptions = {
  snapshot: AgentCommandCenterSnapshot;
  actions: AgentCommandCenterActions;
  requireUserApproval: boolean;
  onApprovalRequest?: (message: string) => Promise<boolean>;
  buildResponse?: (message: string, data: JsonRecord, code?: string) => JsonRecord;
};

export function buildAgentControlWriteTools(
  options: BuildAgentControlWriteToolsOptions
): WebMcpToolDescriptor[] {
  const buildResponseFn = options.buildResponse ?? buildResponse;
  const confirmWorkspaceWrite = (agent: WebMcpAgent | null, actionLabel: string) =>
    confirmWriteAction(
      agent,
      options.requireUserApproval,
      `${actionLabel} workspace ${options.snapshot.workspaceName}?`,
      options.onApprovalRequest
    );
  const buildWorkspaceResponse = (message: string, data: JsonRecord) =>
    buildResponseFn(message, {
      workspaceId: options.snapshot.workspaceId,
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
        const patch: Partial<AgentCommandCenterSnapshot["intent"]> = {};
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
        const intent = options.actions.setIntentPatch(patch);
        return buildWorkspaceResponse("Intent updated.", { intent });
      },
    },
  ];
}
