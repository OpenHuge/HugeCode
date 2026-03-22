import type { ActionRequiredKind, ActionRequiredRecord } from "@ku0/code-runtime-host-contract";
import type { ApprovalRequest, RequestUserInputRequest, RequestUserInputResponse } from "../types";
import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
  resourceNotFoundError,
} from "./webMcpBridgeRuntimeToolHelpers";
import type {
  BuildRuntimeToolsOptions,
  JsonRecord,
  WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";

type RuntimeActionRequiredSource =
  | "runtime-task-approval"
  | "thread-approval"
  | "thread-user-input";

type RuntimeActionRequiredItem = {
  id: string;
  requestId: number | string;
  requestKey: string;
  kind: ActionRequiredKind;
  source: RuntimeActionRequiredSource;
  workspaceId: string;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  summary: string;
  actionRecord: ActionRequiredRecord | null;
};

type ResolvedRuntimeActionRequiredInput =
  | {
      workspaceId: string;
      requestId: number | string;
      kind: "approval";
      decision: "approved" | "rejected";
      reason: string | null;
      answers: null;
    }
  | {
      workspaceId: string;
      requestId: number | string;
      kind: "elicitation";
      decision: "submitted" | "cancelled";
      reason: null;
      answers: RequestUserInputResponse["answers"] | null;
    };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRequestKey(requestId: number | string): string {
  if (typeof requestId === "string") {
    return requestId.trim();
  }
  return String(requestId);
}

function readOptionalRequestId(value: unknown): number | string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function readNestedString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function summarizeApprovalMethod(method: string): string {
  return method
    .replace(/^runtime\/requestApproval\/?/, "")
    .replace(/^workspace\/requestApproval\/?/, "")
    .replace(/^codex\/requestApproval\/?/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function summarizeThreadApproval(request: ApprovalRequest): string {
  const methodLabel = summarizeApprovalMethod(request.method);
  return methodLabel.length > 0
    ? `Approval requested for ${methodLabel}.`
    : "Approval requested for workspace action.";
}

function summarizeUserInputRequest(request: RequestUserInputRequest): string {
  const firstQuestion = request.params.questions[0] ?? null;
  if (!firstQuestion) {
    return "User input requested.";
  }
  if (firstQuestion.header.trim().length > 0) {
    return `User input requested: ${firstQuestion.header.trim()}.`;
  }
  if (firstQuestion.question.trim().length > 0) {
    return `User input requested: ${firstQuestion.question.trim()}.`;
  }
  return "User input requested.";
}

function compareActionRequiredItems(
  left: RuntimeActionRequiredItem,
  right: RuntimeActionRequiredItem
): number {
  const leftUpdated = left.updatedAt ?? left.createdAt ?? -1;
  const rightUpdated = right.updatedAt ?? right.createdAt ?? -1;
  if (leftUpdated !== rightUpdated) {
    return rightUpdated - leftUpdated;
  }
  const leftCreated = left.createdAt ?? -1;
  const rightCreated = right.createdAt ?? -1;
  if (leftCreated !== rightCreated) {
    return rightCreated - leftCreated;
  }
  return left.id.localeCompare(right.id);
}

function dedupeActionRequiredItems(
  items: RuntimeActionRequiredItem[]
): RuntimeActionRequiredItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function findRuntimeActionRequiredItem(
  items: RuntimeActionRequiredItem[],
  workspaceId: string,
  requestId: number | string
): RuntimeActionRequiredItem | null {
  const requestKey = readRequestKey(requestId);
  return (
    items.find((item) => item.workspaceId === workspaceId && item.requestKey === requestKey) ?? null
  );
}

async function readActionRecord(
  runtimeControl: BuildRuntimeToolsOptions["runtimeControl"],
  requestId: number | string
): Promise<ActionRequiredRecord | null> {
  if (typeof requestId !== "string" || requestId.trim().length === 0) {
    return null;
  }
  const getActionRequired = runtimeControl.actionRequiredGetV2;
  if (typeof getActionRequired !== "function") {
    return null;
  }
  return getActionRequired(requestId.trim());
}

async function enrichActionRequiredItems(
  items: RuntimeActionRequiredItem[],
  runtimeControl: BuildRuntimeToolsOptions["runtimeControl"]
): Promise<RuntimeActionRequiredItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      actionRecord: await readActionRecord(runtimeControl, item.requestId),
    }))
  );
}

function createRuntimeTaskApprovalItem(
  snapshot: BuildRuntimeToolsOptions["snapshot"],
  task: Awaited<ReturnType<BuildRuntimeToolsOptions["runtimeControl"]["listTasks"]>>[number]
): RuntimeActionRequiredItem | null {
  if (!task.pendingApprovalId) {
    return null;
  }
  const requestKey = readRequestKey(task.pendingApprovalId);
  return {
    id: `runtime-task-approval:${snapshot.workspaceId}:${requestKey}`,
    requestId: task.pendingApprovalId,
    requestKey,
    kind: "approval",
    source: "runtime-task-approval",
    workspaceId: task.workspaceId,
    threadId: task.threadId,
    turnId: null,
    itemId: task.taskId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    summary: `Runtime task ${task.title?.trim() || task.taskId} is awaiting approval.`,
    actionRecord: null,
  };
}

function createThreadApprovalItem(request: ApprovalRequest): RuntimeActionRequiredItem {
  const params = isRecord(request.params) ? request.params : {};
  const requestKey = readRequestKey(request.request_id);
  return {
    id: `thread-approval:${request.workspace_id}:${requestKey}`,
    requestId: request.request_id,
    requestKey,
    kind: "approval",
    source: "thread-approval",
    workspaceId: request.workspace_id,
    threadId: readNestedString(params, ["threadId", "thread_id"]),
    turnId: readNestedString(params, ["turnId", "turn_id"]),
    itemId: readNestedString(params, ["itemId", "item_id"]),
    createdAt: null,
    updatedAt: null,
    summary: summarizeThreadApproval(request),
    actionRecord: null,
  };
}

function createUserInputItem(request: RequestUserInputRequest): RuntimeActionRequiredItem {
  const requestKey = readRequestKey(request.request_id);
  return {
    id: `thread-user-input:${request.workspace_id}:${requestKey}`,
    requestId: request.request_id,
    requestKey,
    kind: "elicitation",
    source: "thread-user-input",
    workspaceId: request.workspace_id,
    threadId: request.params.thread_id,
    turnId: request.params.turn_id,
    itemId: request.params.item_id,
    createdAt: null,
    updatedAt: null,
    summary: summarizeUserInputRequest(request),
    actionRecord: null,
  };
}

async function listRuntimeActionRequiredItems(
  options: BuildRuntimeToolsOptions,
  input: JsonRecord
): Promise<RuntimeActionRequiredItem[]> {
  const workspaceId =
    options.helpers.toNonEmptyString(input.workspaceId) ?? options.snapshot.workspaceId;
  const limit = options.helpers.toPositiveInteger(input.limit) ?? 50;
  const runtimeTasks = await options.runtimeControl.listTasks({
    workspaceId,
    status: "awaiting_approval",
    limit,
  });
  const runtimeItems = runtimeTasks
    .map((task) => createRuntimeTaskApprovalItem(options.snapshot, task))
    .filter((item): item is RuntimeActionRequiredItem => item !== null);
  const approvalItems = (options.responseRequiredState?.approvals ?? [])
    .filter((request) => request.workspace_id === workspaceId)
    .map(createThreadApprovalItem);
  const userInputItems = (options.responseRequiredState?.userInputRequests ?? [])
    .filter((request) => request.workspace_id === workspaceId)
    .map(createUserInputItem);
  const deduped = dedupeActionRequiredItems([...runtimeItems, ...approvalItems, ...userInputItems]);
  const sorted = deduped.sort(compareActionRequiredItems).slice(0, limit);
  return enrichActionRequiredItems(sorted, options.runtimeControl);
}

function normalizeResolveInput(
  input: JsonRecord,
  options: BuildRuntimeToolsOptions
): ResolvedRuntimeActionRequiredInput {
  const workspaceId =
    options.helpers.toNonEmptyString(input.workspaceId) ?? options.snapshot.workspaceId;
  const requestId = readOptionalRequestId(input.requestId);
  const kind = options.helpers.toNonEmptyString(input.kind);
  const decision = options.helpers.toNonEmptyString(input.decision);
  if (!requestId) {
    throw requiredInputError("requestId is required.");
  }
  if (kind === "approval") {
    if (decision !== "approved" && decision !== "rejected") {
      throw invalidInputError("approval decision must be approved or rejected.");
    }
    return {
      workspaceId,
      requestId,
      kind: "approval",
      decision,
      reason: options.helpers.toNonEmptyString(input.reason),
      answers: null,
    };
  }
  if (kind === "elicitation") {
    if (decision !== "submitted" && decision !== "cancelled") {
      throw invalidInputError("elicitation decision must be submitted or cancelled.");
    }
    const answers = isRecord(input.answers)
      ? (input.answers as RequestUserInputResponse["answers"])
      : null;
    return {
      workspaceId,
      requestId,
      kind: "elicitation",
      decision,
      reason: null,
      answers,
    };
  }
  throw invalidInputError("kind must be approval or elicitation.");
}

async function recordActionRequiredResolution(
  runtimeControl: BuildRuntimeToolsOptions["runtimeControl"],
  input: ResolvedRuntimeActionRequiredInput
): Promise<void> {
  if (typeof input.requestId !== "string" || input.requestId.trim().length === 0) {
    return;
  }
  const submitActionRequired = runtimeControl.actionRequiredSubmitV2;
  if (typeof submitActionRequired !== "function") {
    return;
  }
  const status =
    input.kind === "approval"
      ? input.decision
      : input.decision === "submitted"
        ? "submitted"
        : "cancelled";
  try {
    await submitActionRequired({
      requestId: input.requestId.trim(),
      kind: input.kind,
      status,
      reason: input.kind === "approval" ? input.reason : null,
    });
  } catch {
    // Best-effort bookkeeping only.
  }
}

export function buildRuntimeActionRequiredTools(
  options: BuildRuntimeToolsOptions
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;

  return [
    {
      name: "list-runtime-action-required",
      description:
        "List runtime and thread action-required items, including approvals and user-input requests.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          limit: { type: "number" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const items = await listRuntimeActionRequiredItems(options, input);
        return helpers.buildResponse("Runtime action-required items retrieved.", {
          workspaceId,
          total: items.length,
          items,
        });
      },
    },
    {
      name: "get-runtime-action-required",
      description:
        "Get a unified runtime action-required item by workspace and request identifier.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          requestId: {
            anyOf: [{ type: "string" }, { type: "number" }],
          },
        },
        required: ["requestId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const requestId = readOptionalRequestId(input.requestId);
        if (!requestId) {
          throw requiredInputError("requestId is required.");
        }
        const liveItems = await listRuntimeActionRequiredItems(options, {
          workspaceId,
          limit: input.limit,
        });
        const liveItem = findRuntimeActionRequiredItem(liveItems, workspaceId, requestId);
        if (liveItem) {
          return helpers.buildResponse("Runtime action-required item retrieved.", {
            workspaceId,
            item: liveItem,
          });
        }
        const actionRecord = await readActionRecord(runtimeControl, requestId);
        if (!actionRecord) {
          throw resourceNotFoundError(
            `Runtime action-required item ${readRequestKey(requestId)} was not found.`
          );
        }
        return helpers.buildResponse("Runtime action-required item retrieved.", {
          workspaceId,
          item: {
            id: `action-record:${workspaceId}:${actionRecord.requestId}`,
            requestId,
            requestKey: readRequestKey(requestId),
            kind: actionRecord.kind,
            source: "runtime-task-approval",
            workspaceId,
            threadId: null,
            turnId: null,
            itemId: null,
            createdAt: actionRecord.createdAt,
            updatedAt: actionRecord.decidedAt,
            summary: actionRecord.action ?? actionRecord.reason ?? "Runtime action-required item.",
            actionRecord,
          } satisfies RuntimeActionRequiredItem,
        });
      },
    },
    {
      name: "resolve-runtime-action-required",
      description: "Resolve a runtime action-required approval or elicitation request.",
      inputSchema: {
        oneOf: [
          {
            type: "object",
            properties: {
              workspaceId: { type: "string" },
              requestId: { anyOf: [{ type: "string" }, { type: "number" }] },
              kind: { type: "string", const: "approval" },
              decision: { type: "string", enum: ["approved", "rejected"] },
              reason: { type: "string" },
            },
            required: ["requestId", "kind", "decision"],
          },
          {
            type: "object",
            properties: {
              workspaceId: { type: "string" },
              requestId: { anyOf: [{ type: "string" }, { type: "number" }] },
              kind: { type: "string", const: "elicitation" },
              decision: { type: "string", enum: ["submitted", "cancelled"] },
              answers: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    answers: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["answers"],
                },
              },
            },
            required: ["requestId", "kind", "decision"],
          },
        ],
      },
      execute: async (input, agent) => {
        const normalizedInput = normalizeResolveInput(input, options);
        const liveItems = await listRuntimeActionRequiredItems(options, {
          workspaceId: normalizedInput.workspaceId,
          limit: 200,
        });
        const liveItem = findRuntimeActionRequiredItem(
          liveItems,
          normalizedInput.workspaceId,
          normalizedInput.requestId
        );
        if (!liveItem) {
          throw resourceNotFoundError(
            `Runtime action-required item ${readRequestKey(normalizedInput.requestId)} was not found in the live queue.`
          );
        }
        if (liveItem.kind !== normalizedInput.kind) {
          throw invalidInputError(
            `Runtime action-required item ${liveItem.requestKey} is ${liveItem.kind}, not ${normalizedInput.kind}.`
          );
        }

        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Resolve runtime action-required item in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );

        let result: unknown;
        if (normalizedInput.kind === "approval") {
          if (liveItem.source === "runtime-task-approval") {
            result = await runtimeControl.submitTaskApprovalDecision({
              approvalId: String(normalizedInput.requestId),
              decision: normalizedInput.decision,
              reason: normalizedInput.reason,
            });
          } else {
            if (typeof runtimeControl.respondToServerRequest !== "function") {
              throw methodUnavailableError(
                "resolve-runtime-action-required",
                "respondToServerRequest"
              );
            }
            result = await runtimeControl.respondToServerRequest(
              normalizedInput.workspaceId,
              normalizedInput.requestId,
              normalizedInput.decision === "approved" ? "accept" : "decline"
            );
          }
        } else if (normalizedInput.decision === "submitted") {
          if (!normalizedInput.answers || Object.keys(normalizedInput.answers).length === 0) {
            throw requiredInputError("answers are required when submitting elicitation input.");
          }
          if (typeof runtimeControl.respondToUserInputRequest !== "function") {
            throw methodUnavailableError(
              "resolve-runtime-action-required",
              "respondToUserInputRequest"
            );
          }
          result = await runtimeControl.respondToUserInputRequest(
            normalizedInput.workspaceId,
            normalizedInput.requestId,
            normalizedInput.answers
          );
        } else {
          if (typeof runtimeControl.respondToServerRequestResult !== "function") {
            throw methodUnavailableError(
              "resolve-runtime-action-required",
              "respondToServerRequestResult"
            );
          }
          result = await runtimeControl.respondToServerRequestResult(
            normalizedInput.workspaceId,
            normalizedInput.requestId,
            {}
          );
        }

        await recordActionRequiredResolution(runtimeControl, normalizedInput);

        return helpers.buildResponse("Runtime action-required item resolved.", {
          workspaceId: normalizedInput.workspaceId,
          item: liveItem,
          result,
        });
      },
    },
  ];
}
