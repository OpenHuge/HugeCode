import { useEffect, useRef } from "react";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import {
  readRuntimeErrorCode,
  readRuntimeErrorMessage,
} from "../../../application/runtime/ports/runtimeErrorClassifier";
import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import type {
  ApprovalRequest,
  AppServerEvent,
  DynamicToolCallRequest,
  RequestUserInputRequest,
} from "../../../types";
import type { SupportedAppServerMethod } from "../../../utils/appServerEvents";
import {
  getAppServerParams,
  getAppServerRawMethod,
  getAppServerRequestId,
  isApprovalRequestMethod,
  isSupportedAppServerMethod,
} from "../../../utils/appServerEvents";
import { resolveRateLimitsByLimitIdMap } from "../../../utils/rateLimits";

type AgentDelta = {
  workspaceId: string;
  threadId: string;
  itemId: string;
  delta: string;
  turnId?: string;
  stepIndex?: number;
  transient?: boolean;
};

type AgentCompleted = {
  workspaceId: string;
  threadId: string;
  itemId: string;
  text: string;
};

type ThreadCompactedPayload = {
  threadId: string;
  turnId: string;
};

type McpServerOauthLoginCompletedPayload = {
  name: string;
  success: boolean;
  error: string | null;
};

type ModelReroutedPayload = {
  threadId: string;
  turnId: string;
  fromModel: string;
  toModel: string;
  reason: string | null;
};

type DeprecationNoticePayload = {
  summary: string;
  details: string | null;
};

type ConfigWarningPosition = {
  line: number;
  column: number;
};

type ConfigWarningRange = {
  start: ConfigWarningPosition;
  end: ConfigWarningPosition;
};

type ConfigWarningPayload = {
  summary: string;
  details: string | null;
  path: string | null;
  range: ConfigWarningRange | null;
};

type FuzzyFileSearchSessionFile = {
  root: string;
  path: string;
  fileName: string;
  score: number;
  indices: number[] | null;
};

type FuzzyFileSearchSessionUpdatedPayload = {
  sessionId: string;
  query: string;
  files: FuzzyFileSearchSessionFile[];
};

type FuzzyFileSearchSessionCompletedPayload = {
  sessionId: string;
  query: string | null;
};

type WindowsWorldWritableWarningPayload = {
  samplePaths: string[];
  extraCount: number;
  failedScan: boolean;
};

type WindowsSandboxSetupCompletedPayload = {
  mode: string;
  success: boolean;
  error: string | null;
};

export type ChatgptAuthTokensRefreshRequest = {
  workspace_id: string;
  request_id: number | string;
  params: {
    reason: string;
    previous_account_id: string | null;
    chatgpt_workspace_id?: string | null;
  };
};

type SessionConfiguredPayload = {
  sessionId: string;
  model: string;
  reasoningEffort: string | null;
  historyLogId: string | number | bigint | null;
  historyEntryCount: number;
  initialMessages: Record<string, unknown>[] | null;
  rolloutPath: string;
};

const TURN_THREAD_CONTEXT_MAX_ENTRIES = 512;

function rememberTurnThreadContext(
  store: Map<string, string>,
  turnIdRaw: string,
  threadIdRaw: string
): void {
  const turnId = turnIdRaw.trim();
  const threadId = threadIdRaw.trim();
  if (!turnId || !threadId) {
    return;
  }
  if (store.has(turnId)) {
    store.delete(turnId);
  }
  store.set(turnId, threadId);
  while (store.size > TURN_THREAD_CONTEXT_MAX_ENTRIES) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    store.delete(oldestKey);
  }
}

function resolveThreadIdFromParams(
  params: Record<string, unknown>,
  turnThreadContext: Map<string, string>
): string {
  const directThreadId = String(params.threadId ?? params.thread_id ?? "").trim();
  if (directThreadId) {
    return directThreadId;
  }
  const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
  if (!turnId) {
    return "";
  }
  return turnThreadContext.get(turnId)?.trim() ?? "";
}

type AppServerEventHandlers = {
  onWorkspaceConnected?: (workspaceId: string) => void;
  onThreadStarted?: (workspaceId: string, thread: Record<string, unknown>) => void;
  onThreadNameUpdated?: (
    workspaceId: string,
    payload: { threadId: string; threadName: string | null }
  ) => void;
  onBackgroundThreadAction?: (workspaceId: string, threadId: string, action: string) => void;
  onApprovalRequest?: (request: ApprovalRequest) => void;
  onApprovalResolved?: (
    workspaceId: string,
    payload: {
      approvalId: string;
      threadId: string;
      turnId: string;
      status: "approved" | "rejected" | "interrupted" | "resolved";
    }
  ) => void;
  onThreadStatusChanged?: (
    workspaceId: string,
    payload: { threadId: string; status: Record<string, unknown> | string | null }
  ) => void;
  onThreadArchived?: (workspaceId: string, threadId: string) => void;
  onThreadUnarchived?: (workspaceId: string, threadId: string) => void;
  onThreadCompacted?: (workspaceId: string, payload: ThreadCompactedPayload) => void;
  onRequestUserInput?: (request: RequestUserInputRequest) => void;
  onToolCallRequest?: (request: DynamicToolCallRequest) => void;
  onAgentMessageDelta?: (event: AgentDelta) => void;
  onAgentMessageCompleted?: (event: AgentCompleted) => void;
  onRawResponseItemCompleted?: (
    workspaceId: string,
    payload: { threadId: string; turnId: string; item: Record<string, unknown> }
  ) => void;
  onMcpToolCallProgress?: (
    workspaceId: string,
    payload: { threadId: string; turnId: string; itemId: string; message: string }
  ) => void;
  onAppServerEvent?: (event: AppServerEvent) => void;
  onTurnStarted?: (workspaceId: string, threadId: string, turnId: string) => void;
  onTurnCompleted?: (workspaceId: string, threadId: string, turnId: string) => void;
  onTurnError?: (
    workspaceId: string,
    threadId: string,
    turnId: string,
    payload: { message: string; code?: string; willRetry: boolean }
  ) => void;
  onTurnPlanUpdated?: (
    workspaceId: string,
    threadId: string,
    turnId: string,
    payload: { explanation: unknown; plan: unknown }
  ) => void;
  onItemStarted?: (workspaceId: string, threadId: string, item: Record<string, unknown>) => void;
  onItemUpdated?: (workspaceId: string, threadId: string, item: Record<string, unknown>) => void;
  onItemCompleted?: (workspaceId: string, threadId: string, item: Record<string, unknown>) => void;
  onReasoningSummaryDelta?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    delta: string
  ) => void;
  onReasoningSummaryBoundary?: (workspaceId: string, threadId: string, itemId: string) => void;
  onReasoningTextDelta?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    delta: string
  ) => void;
  onPlanDelta?: (workspaceId: string, threadId: string, itemId: string, delta: string) => void;
  onCommandOutputDelta?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    delta: string
  ) => void;
  onTerminalInteraction?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    stdin: string
  ) => void;
  onFileChangeOutputDelta?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    delta: string
  ) => void;
  onTurnDiffUpdated?: (workspaceId: string, threadId: string, diff: string) => void;
  onThreadTokenUsageUpdated?: (
    workspaceId: string,
    threadId: string,
    tokenUsage: Record<string, unknown> | null
  ) => void;
  onAccountRateLimitsUpdated?: (workspaceId: string, rateLimits: Record<string, unknown>) => void;
  onAccountUpdated?: (workspaceId: string, authMode: string | null) => void;
  onAccountLoginCompleted?: (
    workspaceId: string,
    payload: { loginId: string | null; success: boolean; error: string | null }
  ) => void;
  onSessionConfigured?: (workspaceId: string, payload: SessionConfiguredPayload) => void;
  onChatgptAuthTokensRefreshRequest?: (request: ChatgptAuthTokensRefreshRequest) => void;
  onMcpServerOauthLoginCompleted?: (
    workspaceId: string,
    payload: McpServerOauthLoginCompletedPayload
  ) => void;
  onModelRerouted?: (workspaceId: string, payload: ModelReroutedPayload) => void;
  onDeprecationNotice?: (workspaceId: string, payload: DeprecationNoticePayload) => void;
  onConfigWarning?: (workspaceId: string, payload: ConfigWarningPayload) => void;
  onFuzzyFileSearchSessionUpdated?: (
    workspaceId: string,
    payload: FuzzyFileSearchSessionUpdatedPayload
  ) => void;
  onFuzzyFileSearchSessionCompleted?: (
    workspaceId: string,
    payload: FuzzyFileSearchSessionCompletedPayload
  ) => void;
  onWindowsWorldWritableWarning?: (
    workspaceId: string,
    payload: WindowsWorldWritableWarningPayload
  ) => void;
  onWindowsSandboxSetupCompleted?: (
    workspaceId: string,
    payload: WindowsSandboxSetupCompletedPayload
  ) => void;
};

export const METHODS_ROUTED_IN_USE_APP_SERVER_EVENTS = [
  "account/chatgptAuthTokens/refresh",
  "account/login/completed",
  "account/rateLimits/updated",
  "account/updated",
  "authStatusChange",
  "error",
  "item/agentMessage/delta",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/completed",
  "item/fileChange/outputDelta",
  "item/mcpToolCall/progress",
  "item/plan/delta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/textDelta",
  "item/started",
  "item/updated",
  "item/tool/call",
  "item/tool/requestUserInput",
  "rawResponseItem/completed",
  "runtime/approvalResolved",
  "thread/archived",
  "thread/compacted",
  "thread/name/updated",
  "thread/started",
  "thread/status/changed",
  "thread/tokenUsage/updated",
  "thread/unarchived",
  "turn/completed",
  "turn/diff/updated",
  "turn/plan/updated",
  "turn/started",
  "mcpServer/oauthLogin/completed",
  "loginChatGptComplete",
  "model/rerouted",
  "sessionConfigured",
  "deprecationNotice",
  "configWarning",
  "fuzzyFileSearch/sessionUpdated",
  "fuzzyFileSearch/sessionCompleted",
  "windows/worldWritableWarning",
  "windowsSandbox/setupCompleted",
] as const satisfies readonly SupportedAppServerMethod[];

export function useAppServerEvents(handlers: AppServerEventHandlers) {
  // Use ref to keep handlers current without triggering re-subscription
  const handlersRef = useRef(handlers);
  const turnThreadContextRef = useRef<Map<string, string>>(new Map());

  // Update ref on every render to always have latest handlers
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const unlistenRuntimeUpdated = subscribeScopedRuntimeUpdatedEvents(
      { scopes: ["oauth", "workspaces"] },
      ({ eventWorkspaceId, isWorkspaceLocalEvent, scope }) => {
        const currentHandlers = handlersRef.current;
        if (scope.includes("workspaces") && !isWorkspaceLocalEvent) {
          currentHandlers.onWorkspaceConnected?.(eventWorkspaceId);
        }
        if (scope.includes("oauth") && !isWorkspaceLocalEvent) {
          currentHandlers.onAccountUpdated?.(eventWorkspaceId, null);
        }
      }
    );

    const unlisten = subscribeAppServerEvents((payload) => {
      const currentHandlers = handlersRef.current;
      currentHandlers.onAppServerEvent?.(payload);

      const { workspace_id } = payload;
      const method = getAppServerRawMethod(payload);
      if (!method) {
        return;
      }
      const params = getAppServerParams(payload);

      const requestId = getAppServerRequestId(payload);
      const hasRequestId = requestId !== null;

      if (isApprovalRequestMethod(method) && hasRequestId) {
        currentHandlers.onApprovalRequest?.({
          workspace_id,
          request_id: requestId as string | number,
          method,
          params,
        });
        return;
      }

      if (!isSupportedAppServerMethod(method)) {
        return;
      }

      if (method === "runtime/approvalResolved") {
        const approvalId = String(params.approvalId ?? params.approval_id ?? "").trim();
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        const rawStatus = String(params.status ?? params.decision ?? "")
          .trim()
          .toLowerCase();
        const status =
          rawStatus === "approved" || rawStatus === "accepted"
            ? "approved"
            : rawStatus === "rejected" || rawStatus === "declined"
              ? "rejected"
              : rawStatus === "interrupted" ||
                  rawStatus === "cancelled" ||
                  rawStatus === "canceled" ||
                  rawStatus === "aborted"
                ? "interrupted"
                : "resolved";
        if (approvalId) {
          currentHandlers.onApprovalResolved?.(workspace_id, {
            approvalId,
            threadId,
            turnId,
            status,
          });
        }
        return;
      }

      if (method === "item/tool/requestUserInput" && hasRequestId) {
        const questionsRaw = Array.isArray(params.questions) ? params.questions : [];
        const questions = questionsRaw
          .map((entry) => {
            const question = entry as Record<string, unknown>;
            const optionsRaw = Array.isArray(question.options) ? question.options : [];
            const options = optionsRaw
              .map((option) => {
                const record = option as Record<string, unknown>;
                const label = String(record.label ?? "").trim();
                const description = String(record.description ?? "").trim();
                if (!label && !description) {
                  return null;
                }
                return { label, description };
              })
              .filter((option): option is { label: string; description: string } =>
                Boolean(option)
              );
            return {
              id: String(question.id ?? "").trim(),
              header: String(question.header ?? ""),
              question: String(question.question ?? ""),
              isOther: Boolean(question.isOther ?? question.is_other),
              isSecret: Boolean(question.isSecret ?? question.is_secret),
              options: options.length ? options : undefined,
            };
          })
          .filter((question) => question.id);
        currentHandlers.onRequestUserInput?.({
          workspace_id,
          request_id: requestId as string | number,
          params: {
            thread_id: String(params.threadId ?? params.thread_id ?? ""),
            turn_id: String(params.turnId ?? params.turn_id ?? ""),
            item_id: String(params.itemId ?? params.item_id ?? ""),
            questions,
          },
        });
        return;
      }

      if (method === "item/tool/call" && hasRequestId) {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        const callId = String(params.callId ?? params.call_id ?? "").trim();
        const tool = String(params.tool ?? "").trim();
        if (!threadId || !turnId || !callId || !tool) {
          return;
        }
        currentHandlers.onToolCallRequest?.({
          workspace_id: workspace_id,
          request_id: requestId as string | number,
          params: {
            thread_id: threadId,
            turn_id: turnId,
            call_id: callId,
            tool,
            arguments: params.arguments ?? null,
          },
        });
        return;
      }

      if (method === "item/agentMessage/delta") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && turnId) {
          rememberTurnThreadContext(turnThreadContextRef.current, turnId, threadId);
        }
        const stepIndexRaw = params.stepIndex ?? params.step_index;
        const parsedStepIndex =
          typeof stepIndexRaw === "number"
            ? stepIndexRaw
            : typeof stepIndexRaw === "string" && stepIndexRaw.trim().length > 0
              ? Number(stepIndexRaw)
              : null;
        const stepIndex =
          parsedStepIndex !== null && Number.isFinite(parsedStepIndex)
            ? parsedStepIndex
            : undefined;
        const transientRaw = params.transient;
        const transient =
          typeof transientRaw === "boolean"
            ? transientRaw
            : typeof transientRaw === "string"
              ? (() => {
                  const normalized = transientRaw.trim().toLowerCase();
                  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
                    return true;
                  }
                  if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
                    return false;
                  }
                  return undefined;
                })()
              : undefined;
        if (threadId && itemId && delta) {
          currentHandlers.onAgentMessageDelta?.({
            workspaceId: workspace_id,
            threadId,
            ...(turnId ? { turnId } : {}),
            itemId,
            ...(stepIndex !== undefined ? { stepIndex } : {}),
            ...(transient !== undefined ? { transient } : {}),
            delta,
          });
        }
        return;
      }

      if (method === "turn/started") {
        const turn = params.turn as Record<string, unknown> | undefined;
        const threadId = String(
          params.threadId ?? params.thread_id ?? turn?.threadId ?? turn?.thread_id ?? ""
        );
        const turnId = String(turn?.id ?? params.turnId ?? params.turn_id ?? "");
        if (threadId && turnId) {
          rememberTurnThreadContext(turnThreadContextRef.current, turnId, threadId);
        }
        if (threadId) {
          currentHandlers.onTurnStarted?.(workspace_id, threadId, turnId);
        }
        return;
      }

      if (method === "thread/started") {
        const thread = (params.thread as Record<string, unknown> | undefined) ?? null;
        const threadId = String(thread?.id ?? "");
        if (thread && threadId) {
          currentHandlers.onThreadStarted?.(workspace_id, thread);
        }
        return;
      }

      if (method === "thread/status/changed") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const statusRaw = params.status ?? null;
        const status =
          statusRaw && typeof statusRaw === "object" && !Array.isArray(statusRaw)
            ? (statusRaw as Record<string, unknown>)
            : typeof statusRaw === "string"
              ? statusRaw
              : null;
        if (threadId) {
          currentHandlers.onThreadStatusChanged?.(workspace_id, { threadId, status });
        }
        return;
      }

      if (method === "thread/archived") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        if (threadId) {
          currentHandlers.onThreadArchived?.(workspace_id, threadId);
          currentHandlers.onBackgroundThreadAction?.(workspace_id, threadId, "hide");
        }
        return;
      }

      if (method === "thread/unarchived") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        if (threadId) {
          currentHandlers.onThreadUnarchived?.(workspace_id, threadId);
        }
        return;
      }

      if (method === "thread/compacted") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        if (threadId && turnId) {
          currentHandlers.onThreadCompacted?.(workspace_id, { threadId, turnId });
        }
        return;
      }

      if (method === "thread/name/updated") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const threadNameRaw = params.threadName ?? params.thread_name ?? null;
        const threadName =
          typeof threadNameRaw === "string" && threadNameRaw.trim().length > 0
            ? threadNameRaw.trim()
            : null;
        if (threadId) {
          currentHandlers.onThreadNameUpdated?.(workspace_id, { threadId, threadName });
        }
        return;
      }

      if (method === "error") {
        const turn = params.turn as Record<string, unknown> | undefined;
        const turnId = String(turn?.id ?? params.turnId ?? params.turn_id ?? "").trim();
        const directThreadId = String(
          params.threadId ?? params.thread_id ?? turn?.threadId ?? turn?.thread_id ?? ""
        ).trim();
        const threadId =
          directThreadId ||
          (turnId ? (turnThreadContextRef.current.get(turnId)?.trim() ?? "") : "");
        const error = (params.error as Record<string, unknown> | undefined) ?? {};
        const messageText = readRuntimeErrorMessage(error) ?? "";
        const errorCode = readRuntimeErrorCode(error) ?? undefined;
        const willRetry = Boolean(params.willRetry ?? params.will_retry);
        if (threadId) {
          currentHandlers.onTurnError?.(workspace_id, threadId, turnId, {
            message: messageText,
            code: errorCode,
            willRetry,
          });
        }
        if (turnId && !willRetry) {
          turnThreadContextRef.current.delete(turnId);
        }
        return;
      }

      if (method === "turn/completed") {
        const turn = params.turn as Record<string, unknown> | undefined;
        const threadId = String(
          params.threadId ?? params.thread_id ?? turn?.threadId ?? turn?.thread_id ?? ""
        );
        const turnId = String(turn?.id ?? params.turnId ?? params.turn_id ?? "").trim();
        if (threadId && turnId) {
          rememberTurnThreadContext(turnThreadContextRef.current, turnId, threadId);
        }
        if (threadId) {
          currentHandlers.onTurnCompleted?.(workspace_id, threadId, turnId);
        }
        if (turnId) {
          turnThreadContextRef.current.delete(turnId);
        }
        return;
      }

      if (method === "turn/plan/updated") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const turnId = String(params.turnId ?? params.turn_id ?? "");
        if (threadId) {
          currentHandlers.onTurnPlanUpdated?.(workspace_id, threadId, turnId, {
            explanation: params.explanation,
            plan: params.plan,
          });
        }
        return;
      }

      if (method === "turn/diff/updated") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const diff = String(params.diff ?? "");
        if (threadId && diff) {
          currentHandlers.onTurnDiffUpdated?.(workspace_id, threadId, diff);
        }
        return;
      }

      if (method === "thread/tokenUsage/updated") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const tokenUsage =
          (params.tokenUsage as Record<string, unknown> | null | undefined) ??
          (params.token_usage as Record<string, unknown> | null | undefined);
        if (threadId && tokenUsage !== undefined) {
          currentHandlers.onThreadTokenUsageUpdated?.(workspace_id, threadId, tokenUsage);
        }
        return;
      }

      if (method === "account/rateLimits/updated") {
        const rateLimits =
          (params.rateLimits as Record<string, unknown> | undefined) ??
          (params.rate_limits as Record<string, unknown> | undefined);
        if (rateLimits) {
          currentHandlers.onAccountRateLimitsUpdated?.(workspace_id, rateLimits);
          return;
        }
        const rateLimitsByLimitId = resolveRateLimitsByLimitIdMap(params);
        if (rateLimitsByLimitId) {
          currentHandlers.onAccountRateLimitsUpdated?.(workspace_id, {
            rate_limits_by_limit_id: rateLimitsByLimitId,
          });
        }
        return;
      }

      if (method === "account/updated") {
        const authModeRaw = params.authMode ?? params.auth_mode ?? null;
        const authMode =
          typeof authModeRaw === "string" && authModeRaw.trim().length > 0 ? authModeRaw : null;
        currentHandlers.onAccountUpdated?.(workspace_id, authMode);
        return;
      }

      if (method === "authStatusChange") {
        const authModeRaw = params.authMethod ?? params.auth_method ?? null;
        const authMode =
          typeof authModeRaw === "string" && authModeRaw.trim().length > 0 ? authModeRaw : null;
        currentHandlers.onAccountUpdated?.(workspace_id, authMode);
        return;
      }

      if (method === "account/login/completed") {
        const loginIdRaw = params.loginId ?? params.login_id ?? null;
        const loginId =
          typeof loginIdRaw === "string" && loginIdRaw.trim().length > 0 ? loginIdRaw : null;
        const success = Boolean(params.success);
        const errorRaw = params.error ?? null;
        const error = typeof errorRaw === "string" && errorRaw.trim().length > 0 ? errorRaw : null;
        currentHandlers.onAccountLoginCompleted?.(workspace_id, {
          loginId,
          success,
          error,
        });
        return;
      }

      if (method === "loginChatGptComplete") {
        const loginIdRaw = params.loginId ?? params.login_id ?? null;
        const loginId =
          typeof loginIdRaw === "string" && loginIdRaw.trim().length > 0 ? loginIdRaw : null;
        const success = Boolean(params.success);
        const errorRaw = params.error ?? null;
        const error = typeof errorRaw === "string" && errorRaw.trim().length > 0 ? errorRaw : null;
        currentHandlers.onAccountLoginCompleted?.(workspace_id, {
          loginId,
          success,
          error,
        });
        return;
      }

      if (method === "sessionConfigured") {
        const sessionId = String(params.sessionId ?? params.session_id ?? "").trim();
        const model = String(params.model ?? "").trim();
        const rolloutPath = String(params.rolloutPath ?? params.rollout_path ?? "").trim();
        const reasoningEffortRaw = params.reasoningEffort ?? params.reasoning_effort ?? null;
        const reasoningEffort =
          typeof reasoningEffortRaw === "string" && reasoningEffortRaw.trim().length > 0
            ? reasoningEffortRaw
            : null;
        const historyLogIdRaw = params.historyLogId ?? params.history_log_id ?? null;
        const historyLogId =
          typeof historyLogIdRaw === "string" ||
          typeof historyLogIdRaw === "number" ||
          typeof historyLogIdRaw === "bigint"
            ? historyLogIdRaw
            : null;
        const historyEntryCountRaw = params.historyEntryCount ?? params.history_entry_count ?? 0;
        const historyEntryCountValue =
          typeof historyEntryCountRaw === "number"
            ? historyEntryCountRaw
            : typeof historyEntryCountRaw === "string" && historyEntryCountRaw.trim().length > 0
              ? Number(historyEntryCountRaw)
              : 0;
        const historyEntryCount = Number.isFinite(historyEntryCountValue)
          ? Math.max(0, Math.trunc(historyEntryCountValue))
          : 0;
        const initialMessagesRaw = params.initialMessages ?? params.initial_messages;
        const initialMessages = Array.isArray(initialMessagesRaw)
          ? initialMessagesRaw
              .filter((entry): entry is Record<string, unknown> =>
                Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
              )
              .map((entry) => entry)
          : null;

        if (sessionId && model && rolloutPath) {
          currentHandlers.onSessionConfigured?.(workspace_id, {
            sessionId,
            model,
            reasoningEffort,
            historyLogId,
            historyEntryCount,
            initialMessages,
            rolloutPath,
          });
        }
        return;
      }

      if (method === "account/chatgptAuthTokens/refresh" && hasRequestId) {
        const reasonRaw = params.reason ?? null;
        const reason =
          typeof reasonRaw === "string" && reasonRaw.trim().length > 0 ? reasonRaw : "unauthorized";
        const previousAccountIdRaw = params.previousAccountId ?? params.previous_account_id ?? null;
        const previousAccountId =
          typeof previousAccountIdRaw === "string" && previousAccountIdRaw.trim().length > 0
            ? previousAccountIdRaw
            : null;
        const chatgptWorkspaceIdRaw =
          params.chatgptWorkspaceId ??
          params.chatgpt_workspace_id ??
          params.workspaceId ??
          params.workspace_id ??
          null;
        const chatgptWorkspaceId =
          typeof chatgptWorkspaceIdRaw === "string" && chatgptWorkspaceIdRaw.trim().length > 0
            ? chatgptWorkspaceIdRaw
            : null;
        currentHandlers.onChatgptAuthTokensRefreshRequest?.({
          workspace_id,
          request_id: requestId as string | number,
          params: {
            reason,
            previous_account_id: previousAccountId,
            chatgpt_workspace_id: chatgptWorkspaceId,
          },
        });
        return;
      }

      if (method === "mcpServer/oauthLogin/completed") {
        const name = String(params.name ?? "").trim();
        const success = Boolean(params.success);
        const errorRaw = params.error ?? null;
        const error = typeof errorRaw === "string" && errorRaw.trim().length > 0 ? errorRaw : null;
        if (name) {
          currentHandlers.onMcpServerOauthLoginCompleted?.(workspace_id, {
            name,
            success,
            error,
          });
        }
        return;
      }

      if (method === "model/rerouted") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        const fromModel = String(params.fromModel ?? params.from_model ?? "").trim();
        const toModel = String(params.toModel ?? params.to_model ?? "").trim();
        const reasonRaw = params.reason ?? null;
        const reason =
          typeof reasonRaw === "string" && reasonRaw.trim().length > 0 ? reasonRaw : null;
        if (threadId && turnId && fromModel && toModel) {
          currentHandlers.onModelRerouted?.(workspace_id, {
            threadId,
            turnId,
            fromModel,
            toModel,
            reason,
          });
        }
        return;
      }

      if (method === "deprecationNotice") {
        const summary = String(params.summary ?? "").trim();
        const detailsRaw = params.details ?? null;
        const details =
          typeof detailsRaw === "string" && detailsRaw.trim().length > 0 ? detailsRaw : null;
        if (summary) {
          currentHandlers.onDeprecationNotice?.(workspace_id, { summary, details });
        }
        return;
      }

      if (method === "configWarning") {
        const summary = String(params.summary ?? "").trim();
        const detailsRaw = params.details ?? null;
        const details =
          typeof detailsRaw === "string" && detailsRaw.trim().length > 0 ? detailsRaw : null;
        const pathRaw = params.path ?? null;
        const path = typeof pathRaw === "string" && pathRaw.trim().length > 0 ? pathRaw : null;
        const rangeRaw = params.range;
        let range: ConfigWarningRange | null = null;
        if (rangeRaw && typeof rangeRaw === "object" && !Array.isArray(rangeRaw)) {
          const rangeRecord = rangeRaw as Record<string, unknown>;
          const startRaw = rangeRecord.start;
          const endRaw = rangeRecord.end;
          if (
            startRaw &&
            typeof startRaw === "object" &&
            !Array.isArray(startRaw) &&
            endRaw &&
            typeof endRaw === "object" &&
            !Array.isArray(endRaw)
          ) {
            const startRecord = startRaw as Record<string, unknown>;
            const endRecord = endRaw as Record<string, unknown>;
            const startLine = Number(startRecord.line);
            const startColumn = Number(startRecord.column);
            const endLine = Number(endRecord.line);
            const endColumn = Number(endRecord.column);
            if (
              Number.isFinite(startLine) &&
              Number.isFinite(startColumn) &&
              Number.isFinite(endLine) &&
              Number.isFinite(endColumn)
            ) {
              range = {
                start: { line: startLine, column: startColumn },
                end: { line: endLine, column: endColumn },
              };
            }
          }
        }
        if (summary) {
          currentHandlers.onConfigWarning?.(workspace_id, {
            summary,
            details,
            path,
            range,
          });
        }
        return;
      }

      if (method === "fuzzyFileSearch/sessionUpdated") {
        const sessionId = String(params.sessionId ?? params.session_id ?? "").trim();
        const query = String(params.query ?? "").trim();
        const filesRaw = Array.isArray(params.files) ? params.files : [];
        const files = filesRaw
          .map((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
              return null;
            }
            const file = entry as Record<string, unknown>;
            const root = String(file.root ?? "").trim();
            const path = String(file.path ?? "").trim();
            const fileName = String(file.fileName ?? file.file_name ?? "").trim();
            const scoreRaw = file.score;
            const scoreValue =
              typeof scoreRaw === "number"
                ? scoreRaw
                : typeof scoreRaw === "string" && scoreRaw.trim().length > 0
                  ? Number(scoreRaw)
                  : null;
            const score = scoreValue !== null && Number.isFinite(scoreValue) ? scoreValue : 0;
            const indicesRaw = Array.isArray(file.indices) ? file.indices : null;
            const indices = indicesRaw
              ? indicesRaw
                  .map((index) =>
                    typeof index === "number" && Number.isFinite(index) ? index : null
                  )
                  .filter((index): index is number => index !== null)
              : null;
            if (!root || !path || !fileName) {
              return null;
            }
            return { root, path, fileName, score, indices };
          })
          .filter((entry): entry is FuzzyFileSearchSessionFile => Boolean(entry));

        if (sessionId && query) {
          currentHandlers.onFuzzyFileSearchSessionUpdated?.(workspace_id, {
            sessionId,
            query,
            files,
          });
        }
        return;
      }

      if (method === "fuzzyFileSearch/sessionCompleted") {
        const sessionId = String(params.sessionId ?? params.session_id ?? "").trim();
        const queryRaw = params.query ?? null;
        const query = typeof queryRaw === "string" && queryRaw.trim().length > 0 ? queryRaw : null;
        if (sessionId) {
          currentHandlers.onFuzzyFileSearchSessionCompleted?.(workspace_id, { sessionId, query });
        }
        return;
      }

      if (method === "windows/worldWritableWarning") {
        const samplePathsRaw = Array.isArray(params.samplePaths)
          ? params.samplePaths
          : Array.isArray(params.sample_paths)
            ? params.sample_paths
            : [];
        const samplePaths = samplePathsRaw
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0);
        const extraCountRaw = params.extraCount ?? params.extra_count ?? 0;
        const extraCountValue =
          typeof extraCountRaw === "number"
            ? extraCountRaw
            : typeof extraCountRaw === "string" && extraCountRaw.trim().length > 0
              ? Number(extraCountRaw)
              : 0;
        const extraCount = Number.isFinite(extraCountValue)
          ? Math.max(0, Math.trunc(extraCountValue))
          : 0;
        const failedScanRaw = params.failedScan ?? params.failed_scan;
        const failedScan =
          typeof failedScanRaw === "boolean"
            ? failedScanRaw
            : typeof failedScanRaw === "string"
              ? ["true", "1", "yes", "on", "enabled"].includes(failedScanRaw.trim().toLowerCase())
              : false;
        currentHandlers.onWindowsWorldWritableWarning?.(workspace_id, {
          samplePaths,
          extraCount,
          failedScan,
        });
        return;
      }

      if (method === "windowsSandbox/setupCompleted") {
        const mode = String(params.mode ?? "").trim();
        const success = Boolean(params.success);
        const errorRaw = params.error ?? null;
        const error = typeof errorRaw === "string" && errorRaw.trim().length > 0 ? errorRaw : null;
        if (mode) {
          currentHandlers.onWindowsSandboxSetupCompleted?.(workspace_id, {
            mode,
            success,
            error,
          });
        }
        return;
      }

      if (method === "item/completed") {
        const threadId = resolveThreadIdFromParams(params, turnThreadContextRef.current);
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          currentHandlers.onItemCompleted?.(workspace_id, threadId, item);
        }
        if (threadId && item?.type === "agentMessage") {
          const itemId = String(item.id ?? "");
          const text = String(item.text ?? "");
          if (itemId) {
            currentHandlers.onAgentMessageCompleted?.({
              workspaceId: workspace_id,
              threadId,
              itemId,
              text,
            });
          }
        }
        return;
      }

      if (method === "item/started") {
        const threadId = resolveThreadIdFromParams(params, turnThreadContextRef.current);
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          currentHandlers.onItemStarted?.(workspace_id, threadId, item);
        }
        return;
      }

      if (method === "item/updated") {
        const threadId = resolveThreadIdFromParams(params, turnThreadContextRef.current);
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          currentHandlers.onItemUpdated?.(workspace_id, threadId, item);
        }
        return;
      }

      if (method === "rawResponseItem/completed") {
        const threadId = resolveThreadIdFromParams(params, turnThreadContextRef.current);
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && turnId && item) {
          currentHandlers.onRawResponseItemCompleted?.(workspace_id, {
            threadId,
            turnId,
            item,
          });
        }
        return;
      }

      if (method === "item/mcpToolCall/progress") {
        const threadId = String(params.threadId ?? params.thread_id ?? "").trim();
        const turnId = String(params.turnId ?? params.turn_id ?? "").trim();
        const itemId = String(params.itemId ?? params.item_id ?? "").trim();
        const message = String(params.message ?? "").trim();
        if (threadId && turnId && itemId && message) {
          currentHandlers.onMcpToolCallProgress?.(workspace_id, {
            threadId,
            turnId,
            itemId,
            message,
          });
        }
        return;
      }

      if (method === "item/reasoning/summaryTextDelta") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          currentHandlers.onReasoningSummaryDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/reasoning/summaryPartAdded") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        if (threadId && itemId) {
          currentHandlers.onReasoningSummaryBoundary?.(workspace_id, threadId, itemId);
        }
        return;
      }

      if (method === "item/reasoning/textDelta") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          currentHandlers.onReasoningTextDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/plan/delta") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          currentHandlers.onPlanDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/commandExecution/outputDelta") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          currentHandlers.onCommandOutputDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/commandExecution/terminalInteraction") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const stdin = String(params.stdin ?? "");
        if (threadId && itemId) {
          currentHandlers.onTerminalInteraction?.(workspace_id, threadId, itemId, stdin);
        }
        return;
      }

      if (method === "item/fileChange/outputDelta") {
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          currentHandlers.onFileChangeOutputDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }
    });

    return () => {
      unlistenRuntimeUpdated();
      unlisten();
    };
  }, []);
}
