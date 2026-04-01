import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { readRuntimeCode } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import {
  planRuntimeSubAgentBatch,
  type RuntimeSubAgentBatchExecutionMode,
} from "./webMcpBridgeRuntimeSubAgentBatchPlanner";
import {
  buildRuntimeAllowedSkillResolution,
  buildRuntimeSubAgentSessionHandle,
  getRuntimeLiveSkillCatalogIndex,
  normalizeSubAgentSpawnInput as normalizeSharedSubAgentSpawnInput,
  resolveProviderModelFromInputAndAgent,
  validateAllowedRuntimeSkillIds,
  type RuntimeToolHelpers,
} from "./webMcpBridgeRuntimeToolsShared";
import type {
  AgentCommandCenterSnapshot,
  RuntimeAgentControl,
  RuntimeAllowedSkillResolution,
  RuntimeSubAgentSessionHandle,
  WebMcpAgent,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

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
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

type RuntimeSubAgentBatchToolHelpers = Pick<
  RuntimeToolHelpers,
  | "buildResponse"
  | "toNonEmptyString"
  | "toStringArray"
  | "toPositiveInteger"
  | "normalizeRuntimeAccessMode"
  | "normalizeRuntimeReasonEffort"
  | "confirmWriteAction"
>;

type BuildRuntimeSubAgentBatchToolOptions = {
  snapshot: AgentCommandCenterSnapshot;
  runtimeControl: RuntimeAgentControl;
  requireUserApproval: boolean;
  onApprovalRequest?: (message: string) => Promise<boolean>;
  helpers: RuntimeSubAgentBatchToolHelpers;
};

type BatchTaskFailurePolicy = "stop" | "continue";

type BatchTaskSuccessResult = {
  index: number;
  taskKey: string;
  label: string;
  dependsOn: string[];
  onFailure: BatchTaskFailurePolicy;
  status: "succeeded";
  ok: true;
  instruction: string;
  attempts: number;
  retried: number;
  resumed: boolean;
  timedOut: false;
  sessionId: string;
  session: unknown;
  sessionHandle: RuntimeSubAgentSessionHandle | null;
  allowedSkillResolution: RuntimeAllowedSkillResolution | null;
  dispatch: unknown;
  wait: unknown;
  close: unknown;
};

type BatchTaskFailureResult = {
  index: number;
  taskKey: string;
  label: string;
  dependsOn: string[];
  onFailure: BatchTaskFailurePolicy;
  status: "failed";
  ok: false;
  instruction: string;
  attempts: number;
  retried: number;
  resumed: boolean;
  timedOut: boolean;
  fatal: boolean;
  error: string;
  allowedSkillResolution: RuntimeAllowedSkillResolution | null;
  close: unknown;
};

type BatchTaskSkippedResult = {
  index: number;
  taskKey: string;
  label: string;
  dependsOn: string[];
  onFailure: BatchTaskFailurePolicy;
  status: "skipped";
  ok: false;
  instruction: string;
  attempts: 0;
  retried: 0;
  resumed: boolean;
  timedOut: false;
  reason: "dependency-failed" | "stopped-by-policy";
  blockedBy: string[];
};

type BatchTaskResult = BatchTaskSuccessResult | BatchTaskFailureResult | BatchTaskSkippedResult;

type BatchTaskAttemptSuccess = {
  ok: true;
  sessionId: string;
  session: unknown;
  sessionHandle: RuntimeSubAgentSessionHandle | null;
  allowedSkillResolution: RuntimeAllowedSkillResolution | null;
  dispatch: unknown;
  wait: unknown;
  close: unknown;
};

type BatchTaskAttemptFailure = {
  ok: false;
  error: string;
  timedOut: boolean;
  fatal: boolean;
  allowedSkillResolution: RuntimeAllowedSkillResolution | null;
  close: unknown;
};

type BatchTaskAttemptResult = BatchTaskAttemptSuccess | BatchTaskAttemptFailure;

type SubAgentMethodName =
  | "spawnSubAgentSession"
  | "sendSubAgentInstruction"
  | "waitSubAgentSession";

type NormalizedBatchTaskInput = {
  index: number;
  taskKey: string;
  label: string;
  instruction: string;
  dependsOn: string[];
  maxRetries: number;
  onFailure: BatchTaskFailurePolicy;
  input: JsonRecord;
};

type BatchRunJournalEntry = {
  batchRunId: string;
  idempotencyKey: string;
  workspaceId: string;
  updatedAt: number;
  resultsByTaskKey: Map<string, BatchTaskResult>;
};

const DEFAULT_TASK_MAX_RETRIES = 0;
const MAX_TASK_MAX_RETRIES = 2;
const BATCH_RUN_JOURNAL_LIMIT = 64;
const FATAL_RUNTIME_ERROR_CODES = new Set<string>([
  RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
  RUNTIME_MESSAGE_CODES.runtime.validation.inputInvalid,
  RUNTIME_MESSAGE_CODES.runtime.validation.methodUnavailable,
  RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLarge,
  RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict,
  RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace,
  RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted,
  RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked,
  RUNTIME_MESSAGE_CODES.runtime.validation.approvalRejected,
  RUNTIME_MESSAGE_CODES.runtime.validation.circuitOpen,
  RUNTIME_MESSAGE_CODES.runtime.validation.rateLimited,
]);

const batchRunJournalByKey = new Map<string, BatchRunJournalEntry>();

function requireSubAgentControlMethod<MethodName extends SubAgentMethodName>(
  control: RuntimeAgentControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeAgentControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw new Error(
      `Tool ${toolName} is unavailable because runtime control method ${String(methodName)} is not implemented.`
    );
  }
  return candidate as NonNullable<RuntimeAgentControl[MethodName]>;
}

function toOptionalRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function toRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const records: JsonRecord[] = [];
  for (const entry of value) {
    const record = toOptionalRecord(entry);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

function normalizeBatchExecutionMode(value: unknown): RuntimeSubAgentBatchExecutionMode {
  if (value === "sequential") {
    return "sequential";
  }
  return "parallel";
}

function getRequiredInstruction(
  input: JsonRecord,
  helpers: RuntimeSubAgentBatchToolHelpers
): string {
  const instruction = helpers.toNonEmptyString(input.instruction);
  if (!instruction) {
    throw new Error("instruction is required.");
  }
  return instruction;
}

function getRequiredTaskKey(input: JsonRecord, helpers: RuntimeSubAgentBatchToolHelpers): string {
  const taskKey = helpers.toNonEmptyString(input.taskKey);
  if (!taskKey) {
    throw new Error("taskKey is required.");
  }
  return taskKey;
}

function toOptionalInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function normalizeTaskMaxRetries(value: unknown): number {
  const normalized = toOptionalInteger(value);
  if (normalized === null) {
    return DEFAULT_TASK_MAX_RETRIES;
  }
  return Math.min(MAX_TASK_MAX_RETRIES, Math.max(0, normalized));
}

function normalizeTaskFailurePolicy(value: unknown): BatchTaskFailurePolicy {
  if (value === "stop") {
    return "stop";
  }
  return "continue";
}

function toDependencyKeyList(value: unknown, helpers: RuntimeSubAgentBatchToolHelpers): string[] {
  if (typeof value === "string") {
    const dependency = helpers.toNonEmptyString(value);
    return dependency ? [dependency] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const dependencies: string[] = [];
  for (const entry of value) {
    const dependency = helpers.toNonEmptyString(entry);
    if (dependency) {
      dependencies.push(dependency);
    }
  }
  return Array.from(new Set(dependencies));
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildBatchJournalKey(workspaceId: string, idempotencyKey: string): string {
  return `${workspaceId}:${idempotencyKey}`;
}

function trimJournalIfNeeded(): void {
  while (batchRunJournalByKey.size > BATCH_RUN_JOURNAL_LIMIT) {
    const oldestKey = batchRunJournalByKey.keys().next().value;
    if (!oldestKey) {
      break;
    }
    batchRunJournalByKey.delete(oldestKey);
  }
}

function upsertBatchJournalEntry(entry: BatchRunJournalEntry): void {
  batchRunJournalByKey.set(buildBatchJournalKey(entry.workspaceId, entry.idempotencyKey), entry);
  trimJournalIfNeeded();
}

function normalizeIdempotencyKey(
  value: unknown,
  helpers: RuntimeSubAgentBatchToolHelpers,
  fallback: string
): string {
  return helpers.toNonEmptyString(value) ?? fallback;
}

function isFatalBatchAttemptError(error: unknown): boolean {
  const runtimeCode = readRuntimeCode(error);
  if (runtimeCode && FATAL_RUNTIME_ERROR_CODES.has(runtimeCode)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /input schema validation failed/i.test(message) ||
    /approval.*required|approval.*rejected/i.test(message) ||
    /unavailable because runtime control method/i.test(message)
  );
}

function isTimeoutLikeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timed out/i.test(message);
}

function buildBatchRunId(): string {
  return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTaskKeyForRequestId(taskKey: string): string {
  const normalized = taskKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return normalized.length > 0 ? normalized.replace(/^-+|-+$/g, "") : "task";
}

function buildBatchTaskRequestId(input: {
  batchRunId: string;
  task: NormalizedBatchTaskInput;
  attempt: number;
  helpers: RuntimeSubAgentBatchToolHelpers;
}): string {
  const explicit = input.helpers.toNonEmptyString(input.task.input.requestId);
  if (explicit) {
    return explicit;
  }
  return `webmcp:sub-agent-batch:${input.batchRunId}:${normalizeTaskKeyForRequestId(input.task.taskKey)}:attempt-${input.attempt}`;
}

export function buildOrchestrateRuntimeSubAgentBatchTool(
  options: BuildRuntimeSubAgentBatchToolOptions
): WebMcpToolDescriptor {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;

  return {
    name: "orchestrate-runtime-sub-agent-batch",
    description:
      "Run a batch of delegated sub-agent instructions with managed spawn/send/wait/close lifecycle. Each result includes a sessionHandle whose sessionId is the primary tracking handle, plus allowedSkillResolution when aliases were supplied.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        threadId: { type: "string" },
        batchRunId: { type: "string" },
        idempotencyKey: { type: "string" },
        resumeFromBatchRunId: { type: "string" },
        executionMode: { type: "string", enum: ["parallel", "sequential"] },
        maxParallel: { type: "number" },
        waitTimeoutMs: { type: "number" },
        waitPollIntervalMs: { type: "number" },
        closeSubAgentSession: { type: "boolean" },
        closeReason: { type: "string" },
        accessMode: { type: "string", enum: ["read-only", "on-request", "full-access"] },
        reasonEffort: { type: "string", enum: ["low", "medium", "high", "xhigh"] },
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
        requiresApproval: { type: "boolean" },
        approvalReason: { type: "string" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              taskKey: { type: "string" },
              dependsOn: { type: "array", items: { type: "string" } },
              maxRetries: { type: "number", enum: [0, 1, 2] },
              onFailure: { type: "string", enum: ["stop", "continue"] },
              workspaceId: { type: "string" },
              threadId: { type: "string" },
              title: { type: "string" },
              instruction: { type: "string" },
              requestId: { type: "string" },
              requiresApproval: { type: "boolean" },
              approvalReason: { type: "string" },
              waitTimeoutMs: { type: "number" },
              waitPollIntervalMs: { type: "number" },
              closeSubAgentSession: { type: "boolean" },
              closeReason: { type: "string" },
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
            required: ["taskKey", "instruction"],
          },
        },
      },
      required: ["tasks"],
    },
    annotations: {
      destructiveHint: true,
      title: "Orchestrate Runtime Sub-Agent Batch",
      taskSupport: "full",
    },
    execute: async (input, agent) => {
      await helpers.confirmWriteAction(
        agent,
        requireUserApproval,
        `Run runtime sub-agent batch in workspace ${snapshot.workspaceName}?`,
        onApprovalRequest
      );

      const spawnSubAgentSession = requireSubAgentControlMethod(
        runtimeControl,
        "spawnSubAgentSession",
        "orchestrate-runtime-sub-agent-batch"
      );
      const sendSubAgentInstruction = requireSubAgentControlMethod(
        runtimeControl,
        "sendSubAgentInstruction",
        "orchestrate-runtime-sub-agent-batch"
      );
      const waitSubAgentSession = requireSubAgentControlMethod(
        runtimeControl,
        "waitSubAgentSession",
        "orchestrate-runtime-sub-agent-batch"
      );
      const closeSubAgentSession =
        typeof runtimeControl.closeSubAgentSession === "function"
          ? runtimeControl.closeSubAgentSession
          : null;

      const taskInputs = toRecordArray(input.tasks);
      if (taskInputs.length === 0) {
        throw new Error("tasks must include at least one item.");
      }
      if (taskInputs.length > 12) {
        throw new Error("tasks supports up to 12 items per batch.");
      }

      const executionMode = normalizeBatchExecutionMode(input.executionMode);
      const defaultWorkspaceId =
        helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
      const explicitBatchRunId = helpers.toNonEmptyString(input.batchRunId);
      const batchRunId = explicitBatchRunId ?? buildBatchRunId();
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey, helpers, batchRunId);
      const resumeFromBatchRunId = helpers.toNonEmptyString(input.resumeFromBatchRunId);
      const journalKey = buildBatchJournalKey(defaultWorkspaceId, idempotencyKey);
      const defaultThreadId = helpers.toNonEmptyString(input.threadId);
      const defaultWaitTimeoutMs = helpers.toPositiveInteger(input.waitTimeoutMs);
      const defaultWaitPollIntervalMs = helpers.toPositiveInteger(input.waitPollIntervalMs);
      const defaultCloseSession =
        typeof input.closeSubAgentSession === "boolean" ? input.closeSubAgentSession : true;
      const defaultCloseReason = helpers.toNonEmptyString(input.closeReason);
      const defaultRequiresApproval =
        typeof input.requiresApproval === "boolean" ? input.requiresApproval : undefined;
      const defaultApprovalReason = helpers.toNonEmptyString(input.approvalReason);
      const defaultCallerModelContext = resolveProviderModelFromInputAndAgent(
        input,
        agent,
        helpers
      );
      const catalogSessionId = helpers.toNonEmptyString(input.catalogSessionId);
      const liveSkillCatalogIndex = await getRuntimeLiveSkillCatalogIndex(runtimeControl, {
        sessionId: catalogSessionId,
      });

      const normalizedTasks: NormalizedBatchTaskInput[] = taskInputs.map((taskInput, index) => {
        const taskKey = getRequiredTaskKey(taskInput, helpers);
        const title = helpers.toNonEmptyString(taskInput.title);
        return {
          index,
          taskKey,
          label: title ?? taskKey,
          instruction: getRequiredInstruction(taskInput, helpers),
          dependsOn: toDependencyKeyList(taskInput.dependsOn, helpers),
          maxRetries: normalizeTaskMaxRetries(taskInput.maxRetries),
          onFailure: normalizeTaskFailurePolicy(taskInput.onFailure),
          input: taskInput,
        };
      });

      const plan = planRuntimeSubAgentBatch({
        executionMode,
        maxParallel: toOptionalInteger(input.maxParallel),
        provider: defaultCallerModelContext.provider,
        modelId: defaultCallerModelContext.modelId,
        tasks: normalizedTasks.map((task) => ({
          index: task.index,
          taskKey: task.taskKey,
          dependsOn: task.dependsOn,
          requiresApproval:
            typeof task.input.requiresApproval === "boolean"
              ? task.input.requiresApproval
              : typeof input.requiresApproval === "boolean"
                ? input.requiresApproval
                : false,
        })),
      });

      const taskByTaskKey = new Map<string, NormalizedBatchTaskInput>();
      for (const task of normalizedTasks) {
        taskByTaskKey.set(task.taskKey, task);
      }
      const existingJournal = batchRunJournalByKey.get(journalKey) ?? null;
      const resumeApplied =
        existingJournal !== null &&
        ((resumeFromBatchRunId !== null && existingJournal.batchRunId === resumeFromBatchRunId) ||
          (resumeFromBatchRunId === null && existingJournal.batchRunId === batchRunId));
      const journal: BatchRunJournalEntry = resumeApplied
        ? {
            ...existingJournal,
            resultsByTaskKey: new Map(existingJournal.resultsByTaskKey),
          }
        : {
            batchRunId,
            idempotencyKey,
            workspaceId: defaultWorkspaceId,
            updatedAt: Date.now(),
            resultsByTaskKey: new Map(),
          };

      const runTaskAttempt = async (
        task: NormalizedBatchTaskInput,
        attempt: number
      ): Promise<BatchTaskAttemptResult> => {
        const taskInput = task.input;
        const shouldClose =
          typeof taskInput.closeSubAgentSession === "boolean"
            ? taskInput.closeSubAgentSession
            : defaultCloseSession;
        const closeReason =
          helpers.toNonEmptyString(taskInput.closeReason) ??
          defaultCloseReason ??
          "webmcp:sub-agent-batch-task-complete";

        let spawnedSessionId: string | null = null;
        const allowedSkillResolution = buildRuntimeAllowedSkillResolution(
          taskInput.allowedSkillIds !== undefined
            ? taskInput.allowedSkillIds
            : input.allowedSkillIds,
          helpers,
          liveSkillCatalogIndex
        );
        try {
          const spawnPayload: JsonRecord = {
            workspaceId: helpers.toNonEmptyString(taskInput.workspaceId) ?? defaultWorkspaceId,
            threadId: helpers.toNonEmptyString(taskInput.threadId) ?? defaultThreadId,
            title: helpers.toNonEmptyString(taskInput.title),
            accessMode:
              helpers.toNonEmptyString(taskInput.accessMode) ??
              helpers.toNonEmptyString(input.accessMode),
            reasonEffort:
              helpers.toNonEmptyString(taskInput.reasonEffort) ??
              helpers.toNonEmptyString(input.reasonEffort),
            provider:
              helpers.toNonEmptyString(taskInput.provider) ?? defaultCallerModelContext.provider,
            modelId:
              helpers.toNonEmptyString(taskInput.modelId) ?? defaultCallerModelContext.modelId,
            scopeProfile:
              helpers.toNonEmptyString(taskInput.scopeProfile) ??
              helpers.toNonEmptyString(input.scopeProfile),
            allowedSkillIds:
              taskInput.allowedSkillIds !== undefined
                ? taskInput.allowedSkillIds
                : input.allowedSkillIds,
            allowNetwork:
              typeof taskInput.allowNetwork === "boolean"
                ? taskInput.allowNetwork
                : input.allowNetwork,
            workspaceReadPaths:
              taskInput.workspaceReadPaths !== undefined
                ? taskInput.workspaceReadPaths
                : input.workspaceReadPaths,
            parentRunId:
              helpers.toNonEmptyString(taskInput.parentRunId) ??
              helpers.toNonEmptyString(input.parentRunId),
          };
          const normalizedSpawnInput = normalizeSharedSubAgentSpawnInput(
            spawnPayload,
            snapshot,
            helpers,
            liveSkillCatalogIndex,
            agent
          );
          validateAllowedRuntimeSkillIds(
            normalizedSpawnInput.allowedSkillIds,
            liveSkillCatalogIndex,
            "orchestrate-runtime-sub-agent-batch"
          );
          const session = await spawnSubAgentSession(normalizedSpawnInput);
          spawnedSessionId = session.sessionId;
          const requiresApproval =
            typeof taskInput.requiresApproval === "boolean"
              ? taskInput.requiresApproval
              : defaultRequiresApproval;
          const approvalReason =
            helpers.toNonEmptyString(taskInput.approvalReason) ?? defaultApprovalReason;
          const dispatch = await sendSubAgentInstruction({
            sessionId: session.sessionId,
            instruction: task.instruction,
            requestId: buildBatchTaskRequestId({
              batchRunId,
              task,
              attempt,
              helpers,
            }),
            requiresApproval,
            approvalReason,
          });
          const wait = await waitSubAgentSession({
            sessionId: session.sessionId,
            timeoutMs: helpers.toPositiveInteger(taskInput.waitTimeoutMs) ?? defaultWaitTimeoutMs,
            pollIntervalMs:
              helpers.toPositiveInteger(taskInput.waitPollIntervalMs) ?? defaultWaitPollIntervalMs,
          });
          let close: unknown = null;
          if (closeSubAgentSession && shouldClose && (wait.done || wait.timedOut)) {
            close = await closeSubAgentSession({
              sessionId: session.sessionId,
              reason: closeReason,
              force: Boolean(wait.timedOut),
            });
          }
          if (wait.timedOut) {
            return {
              ok: false,
              error: `Timed out while waiting for sub-agent session ${session.sessionId}.`,
              timedOut: true,
              fatal: false,
              allowedSkillResolution,
              close,
            };
          }
          return {
            ok: true,
            sessionId: session.sessionId,
            session,
            sessionHandle: buildRuntimeSubAgentSessionHandle(
              wait.session ?? dispatch.session ?? session
            ),
            allowedSkillResolution,
            dispatch,
            wait,
            close,
          };
        } catch (error) {
          let close: unknown = null;
          if (closeSubAgentSession && shouldClose && spawnedSessionId) {
            try {
              close = await closeSubAgentSession({
                sessionId: spawnedSessionId,
                reason: closeReason,
                force: true,
              });
            } catch {
              close = null;
            }
          }
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            timedOut: isTimeoutLikeError(error),
            fatal: isFatalBatchAttemptError(error),
            allowedSkillResolution,
            close,
          };
        }
      };

      const runTaskWithRetries = async (
        task: NormalizedBatchTaskInput
      ): Promise<BatchTaskSuccessResult | BatchTaskFailureResult> => {
        let attempts = 0;
        let retried = 0;
        let finalFailure: BatchTaskAttemptFailure | null = null;
        const maxAttempts = task.maxRetries + 1;

        while (attempts < maxAttempts) {
          attempts += 1;
          const attempt = await runTaskAttempt(task, attempts);
          if (attempt.ok) {
            return {
              index: task.index,
              taskKey: task.taskKey,
              label: task.label,
              dependsOn: task.dependsOn,
              onFailure: task.onFailure,
              status: "succeeded",
              ok: true,
              instruction: task.instruction,
              attempts,
              retried,
              resumed: false,
              timedOut: false,
              sessionId: attempt.sessionId,
              session: attempt.session,
              sessionHandle: attempt.sessionHandle,
              allowedSkillResolution: attempt.allowedSkillResolution,
              dispatch: attempt.dispatch,
              wait: attempt.wait,
              close: attempt.close,
            };
          }
          finalFailure = attempt;
          if (attempt.fatal) {
            break;
          }
          if (attempts < maxAttempts) {
            retried += 1;
          }
        }

        return {
          index: task.index,
          taskKey: task.taskKey,
          label: task.label,
          dependsOn: task.dependsOn,
          onFailure: task.onFailure,
          status: "failed",
          ok: false,
          instruction: task.instruction,
          attempts,
          retried,
          resumed: false,
          timedOut: finalFailure?.timedOut ?? false,
          fatal: finalFailure?.fatal ?? false,
          error: finalFailure?.error ?? "Task failed.",
          allowedSkillResolution: finalFailure?.allowedSkillResolution ?? null,
          close: finalFailure?.close ?? null,
        };
      };

      const toSkippedResult = (
        task: NormalizedBatchTaskInput,
        reason: BatchTaskSkippedResult["reason"],
        blockedBy: string[]
      ): BatchTaskSkippedResult => ({
        index: task.index,
        taskKey: task.taskKey,
        label: task.label,
        dependsOn: task.dependsOn,
        onFailure: task.onFailure,
        status: "skipped",
        ok: false,
        instruction: task.instruction,
        attempts: 0,
        retried: 0,
        resumed: false,
        timedOut: false,
        reason,
        blockedBy,
      });

      const toResumedResult = (result: BatchTaskResult): BatchTaskResult => ({
        ...result,
        resumed: true,
      });

      const resultsByTaskKey = new Map<string, BatchTaskResult>();
      if (resumeApplied) {
        for (const [taskKey, result] of journal.resultsByTaskKey.entries()) {
          resultsByTaskKey.set(taskKey, toResumedResult(result));
        }
      }
      let stopRequested = false;

      for (const wave of plan.waves) {
        if (stopRequested) {
          for (const taskKey of wave) {
            if (resultsByTaskKey.has(taskKey)) {
              continue;
            }
            const task = taskByTaskKey.get(taskKey);
            if (task) {
              resultsByTaskKey.set(taskKey, toSkippedResult(task, "stopped-by-policy", []));
            }
          }
          continue;
        }

        for (const chunk of chunkArray(wave, plan.maxParallel)) {
          const runnableTasks: NormalizedBatchTaskInput[] = [];
          for (const taskKey of chunk) {
            if (resultsByTaskKey.has(taskKey)) {
              continue;
            }
            const task = taskByTaskKey.get(taskKey);
            if (!task) {
              continue;
            }
            const blockedBy = task.dependsOn.filter((dependencyKey) => {
              const dependencyResult = resultsByTaskKey.get(dependencyKey);
              return !dependencyResult || dependencyResult.status !== "succeeded";
            });
            if (blockedBy.length > 0) {
              resultsByTaskKey.set(taskKey, toSkippedResult(task, "dependency-failed", blockedBy));
              continue;
            }
            if (stopRequested) {
              resultsByTaskKey.set(taskKey, toSkippedResult(task, "stopped-by-policy", []));
              continue;
            }
            runnableTasks.push(task);
          }

          const chunkResults = await Promise.all(
            runnableTasks.map((task) => runTaskWithRetries(task))
          );
          for (const result of chunkResults) {
            resultsByTaskKey.set(result.taskKey, result);
            journal.resultsByTaskKey.set(result.taskKey, result);
            if (result.status === "failed" && result.fatal) {
              stopRequested = true;
              continue;
            }
            if (result.status === "failed" && result.onFailure === "stop") {
              stopRequested = true;
            }
          }
          journal.updatedAt = Date.now();
          upsertBatchJournalEntry(journal);
          if (stopRequested) {
            break;
          }
        }

        if (stopRequested) {
          for (const taskKey of wave) {
            if (resultsByTaskKey.has(taskKey)) {
              continue;
            }
            const task = taskByTaskKey.get(taskKey);
            if (task) {
              resultsByTaskKey.set(taskKey, toSkippedResult(task, "stopped-by-policy", []));
            }
          }
        }
      }

      const results: BatchTaskResult[] = normalizedTasks.map((task) => {
        const result = resultsByTaskKey.get(task.taskKey);
        if (result) {
          return result;
        }
        return toSkippedResult(task, "stopped-by-policy", []);
      });
      journal.resultsByTaskKey = new Map(results.map((result) => [result.taskKey, result]));

      const summary = {
        total: results.length,
        succeeded: results.filter((result) => result.status === "succeeded").length,
        failed: results.filter((result) => result.status === "failed").length,
        skipped: results.filter((result) => result.status === "skipped").length,
        resumed: results.filter((result) => result.resumed).length,
        retried: results.reduce((count, result) => count + result.retried, 0),
        timedOut: results.filter((result) => result.timedOut).length,
      };

      journal.updatedAt = Date.now();
      upsertBatchJournalEntry(journal);

      return helpers.buildResponse("Runtime sub-agent batch orchestration completed.", {
        workspaceId: snapshot.workspaceId,
        batchRunId: journal.batchRunId,
        idempotencyKey: journal.idempotencyKey,
        resumeApplied,
        resumeFromBatchRunId,
        executionMode: plan.executionMode,
        plan: {
          executionMode: plan.executionMode,
          maxParallel: plan.maxParallel,
          waves: plan.waves,
          order: plan.order,
          totalWaves: plan.waves.length,
          policy: plan.policy,
        },
        journal: {
          key: buildBatchJournalKey(journal.workspaceId, journal.idempotencyKey),
          batchRunId: journal.batchRunId,
          idempotencyKey: journal.idempotencyKey,
          resumeApplied,
          resumeFromBatchRunId,
          updatedAt: journal.updatedAt,
          trackedTasks: journal.resultsByTaskKey.size,
        },
        summary,
        results,
      });
    },
  };
}

export function __resetRuntimeSubAgentBatchJournalForTests(): void {
  batchRunJournalByKey.clear();
}
