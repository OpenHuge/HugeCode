import { useCallback, useMemo, useRef } from "react";
import { sendNotification } from "../../../application/runtime/ports/desktopNotifications";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { DebugEntry } from "../../../types";
import { useAppServerEvents } from "../../app/hooks/useAppServerEvents";

const DEFAULT_MIN_DURATION_MS = 60_000; // 1 minute
const MAX_BODY_LENGTH = 200;
const MIN_NOTIFICATION_SPACING_MS = 1500;

type SystemNotificationOptions = {
  enabled: boolean;
  isWindowFocused: boolean;
  minDurationMs?: number;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onThreadNotificationSent?: (workspaceId: string, threadId: string) => void;
  onDebug?: (entry: DebugEntry) => void;
};

function buildThreadKey(workspaceId: string, threadId: string) {
  return `${workspaceId}:${threadId}`;
}

function buildTurnKey(workspaceId: string, turnId: string) {
  return `${workspaceId}:${turnId}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatTurnRouteSummary(payload: {
  routedProvider?: string | null;
  routedModelId?: string | null;
  executionMode?: string | null;
  recoveredFromStaleResume?: boolean | null;
}): string | null {
  const providerLabel = (() => {
    switch ((payload.routedProvider ?? "").trim().toLowerCase()) {
      case "claude_code_local":
        return "Claude Code Local";
      case "anthropic":
      case "claude":
      case "claude_code":
        return "Claude";
      case "openai":
      case "codex":
        return "Codex";
      case "google":
      case "gemini":
        return "Gemini";
      default:
        return payload.routedProvider?.trim() || null;
    }
  })();

  const locationLabel =
    payload.routedProvider?.trim().toLowerCase() === "claude_code_local"
      ? "Local"
      : payload.executionMode === "local-cli"
        ? "Local"
        : "Cloud";

  const fragments = [
    providerLabel,
    payload.routedModelId?.trim() || null,
    locationLabel,
    payload.recoveredFromStaleResume ? "session recreated" : null,
  ].filter((value): value is string => Boolean(value));

  return fragments.length > 0 ? fragments.join(" · ") : null;
}

export function useAgentSystemNotifications({
  enabled,
  isWindowFocused,
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  getWorkspaceName,
  onThreadNotificationSent,
  onDebug,
}: SystemNotificationOptions) {
  const turnStartById = useRef(new Map<string, number>());
  const turnStartByThread = useRef(new Map<string, number>());
  const lastNotifiedAtByThread = useRef(new Map<string, number>());
  const lastNotifiedAtByEvent = useRef(new Map<string, number>());
  const lastMessageByThread = useRef(new Map<string, string>());

  const notify = useCallback(
    async (
      title: string,
      body: string,
      label: "success" | "error",
      extra?: Record<string, unknown>
    ) => {
      try {
        await sendNotification(title, body, {
          autoCancel: true,
          extra,
        });
        onDebug?.({
          id: `${Date.now()}-client-notification-${label}`,
          timestamp: Date.now(),
          source: "client",
          label: `notification/${label}`,
          payload: { title, body },
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-notification-error`,
          timestamp: Date.now(),
          source: "error",
          label: "notification/error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [onDebug]
  );

  const consumeDuration = useCallback((workspaceId: string, threadId: string, turnId: string) => {
    const threadKey = buildThreadKey(workspaceId, threadId);
    let startedAt: number | undefined;

    if (turnId) {
      const turnKey = buildTurnKey(workspaceId, turnId);
      startedAt = turnStartById.current.get(turnKey);
      turnStartById.current.delete(turnKey);
    }

    if (startedAt === undefined) {
      startedAt = turnStartByThread.current.get(threadKey);
    }

    if (startedAt !== undefined) {
      turnStartByThread.current.delete(threadKey);
      return Date.now() - startedAt;
    }

    return null;
  }, []);

  const recordStartIfMissing = useCallback((workspaceId: string, threadId: string) => {
    const threadKey = buildThreadKey(workspaceId, threadId);
    if (!turnStartByThread.current.has(threadKey)) {
      turnStartByThread.current.set(threadKey, Date.now());
    }
  }, []);

  const shouldNotify = useCallback(
    (durationMs: number | null, threadKey: string) => {
      if (durationMs === null) {
        return false;
      }
      if (!enabled) {
        return false;
      }
      if (durationMs < minDurationMs) {
        return false;
      }
      if (isWindowFocused) {
        return false;
      }
      const lastNotifiedAt = lastNotifiedAtByThread.current.get(threadKey);
      if (lastNotifiedAt && Date.now() - lastNotifiedAt < MIN_NOTIFICATION_SPACING_MS) {
        return false;
      }
      lastNotifiedAtByThread.current.set(threadKey, Date.now());
      return true;
    },
    [enabled, isWindowFocused, minDurationMs]
  );

  const shouldEmitWarningEvent = useCallback((eventKey: string) => {
    const lastNotifiedAt = lastNotifiedAtByEvent.current.get(eventKey);
    if (lastNotifiedAt && Date.now() - lastNotifiedAt < MIN_NOTIFICATION_SPACING_MS) {
      return false;
    }
    lastNotifiedAtByEvent.current.set(eventKey, Date.now());
    return true;
  }, []);

  const notifyWarning = useCallback(
    (
      eventKey: string,
      title: string,
      body: string,
      type: string,
      extra: Record<string, unknown>
    ) => {
      if (!shouldEmitWarningEvent(eventKey)) {
        return;
      }

      pushErrorToast({
        title,
        message: body,
      });

      if (!enabled || isWindowFocused) {
        return;
      }

      void notify(title, body, "error", {
        kind: "system_warning",
        type,
        ...extra,
      });
    },
    [enabled, isWindowFocused, notify, shouldEmitWarningEvent]
  );

  const getNotificationContent = useCallback(
    (workspaceId: string, threadId: string, fallbackBody: string) => {
      const title = getWorkspaceName?.(workspaceId) ?? "Agent Complete";
      const threadKey = buildThreadKey(workspaceId, threadId);
      const lastMessage = lastMessageByThread.current.get(threadKey);
      const body = lastMessage ? truncateText(lastMessage, MAX_BODY_LENGTH) : fallbackBody;
      return { title, body };
    },
    [getWorkspaceName]
  );

  const handleTurnStarted = useCallback((workspaceId: string, threadId: string, turnId: string) => {
    const startedAt = Date.now();
    const threadKey = buildThreadKey(workspaceId, threadId);
    turnStartByThread.current.set(threadKey, startedAt);
    lastMessageByThread.current.delete(threadKey);
    if (turnId) {
      turnStartById.current.set(buildTurnKey(workspaceId, turnId), startedAt);
    }
  }, []);

  const handleTurnCompleted = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: {
        routedProvider?: string | null;
        routedModelId?: string | null;
        executionMode?: string | null;
        recoveredFromStaleResume?: boolean | null;
      }
    ) => {
      const durationMs = consumeDuration(workspaceId, threadId, turnId);
      const threadKey = buildThreadKey(workspaceId, threadId);
      if (!shouldNotify(durationMs, threadKey)) {
        return;
      }
      const routeSummary = formatTurnRouteSummary(payload);
      const { title, body } = getNotificationContent(
        workspaceId,
        threadId,
        routeSummary
          ? `Your agent has finished its task via ${routeSummary}.`
          : "Your agent has finished its task."
      );
      onThreadNotificationSent?.(workspaceId, threadId);
      void notify(title, body, "success", {
        kind: "thread",
        workspaceId,
        threadId,
        routedProvider: payload.routedProvider ?? null,
        routedModelId: payload.routedModelId ?? null,
        executionMode: payload.executionMode ?? null,
        recoveredFromStaleResume: payload.recoveredFromStaleResume ?? null,
      });
      lastMessageByThread.current.delete(threadKey);
    },
    [consumeDuration, getNotificationContent, notify, onThreadNotificationSent, shouldNotify]
  );

  const handleTurnError = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: { message: string; willRetry: boolean }
    ) => {
      if (payload.willRetry) {
        return;
      }
      const durationMs = consumeDuration(workspaceId, threadId, turnId);
      const threadKey = buildThreadKey(workspaceId, threadId);
      if (!shouldNotify(durationMs, threadKey)) {
        return;
      }
      const title = getWorkspaceName?.(workspaceId) ?? "Agent Error";
      const body = payload.message || "An error occurred.";
      onThreadNotificationSent?.(workspaceId, threadId);
      void notify(title, truncateText(body, MAX_BODY_LENGTH), "error", {
        kind: "thread",
        workspaceId,
        threadId,
      });
      lastMessageByThread.current.delete(threadKey);
    },
    [consumeDuration, getWorkspaceName, notify, onThreadNotificationSent, shouldNotify]
  );

  const handleItemStarted = useCallback(
    (workspaceId: string, threadId: string) => {
      recordStartIfMissing(workspaceId, threadId);
    },
    [recordStartIfMissing]
  );

  const handleAgentMessageDelta = useCallback(
    (event: { workspaceId: string; threadId: string }) => {
      recordStartIfMissing(event.workspaceId, event.threadId);
    },
    [recordStartIfMissing]
  );

  const handleAgentMessageCompleted = useCallback(
    (event: { workspaceId: string; threadId: string; text: string }) => {
      const threadKey = buildThreadKey(event.workspaceId, event.threadId);
      // Store the message text for use in turn completion notification
      if (event.text) {
        lastMessageByThread.current.set(threadKey, event.text);
      }
      const durationMs = consumeDuration(event.workspaceId, event.threadId, "");
      if (!shouldNotify(durationMs, threadKey)) {
        return;
      }
      const { title, body } = getNotificationContent(
        event.workspaceId,
        event.threadId,
        "Your agent has finished its task."
      );
      onThreadNotificationSent?.(event.workspaceId, event.threadId);
      void notify(title, body, "success", {
        kind: "thread",
        workspaceId: event.workspaceId,
        threadId: event.threadId,
      });
      lastMessageByThread.current.delete(threadKey);
    },
    [consumeDuration, getNotificationContent, notify, onThreadNotificationSent, shouldNotify]
  );

  const handleModelRerouted = useCallback(
    (
      workspaceId: string,
      payload: {
        threadId: string;
        turnId: string;
        fromModel: string;
        toModel: string;
        reason: string | null;
      }
    ) => {
      const eventKey = `model-rerouted:${workspaceId}:${payload.threadId}:${payload.turnId}:${payload.toModel}`;
      const workspaceName = getWorkspaceName?.(workspaceId);
      const title = workspaceName ? `Model rerouted — ${workspaceName}` : "Model rerouted";
      const reasonSuffix = payload.reason ? ` (${payload.reason})` : "";
      const body = truncateText(
        `Switched from ${payload.fromModel} to ${payload.toModel}${reasonSuffix}.`,
        MAX_BODY_LENGTH
      );
      notifyWarning(eventKey, title, body, "model_rerouted", {
        workspaceId,
        threadId: payload.threadId,
        turnId: payload.turnId,
      });
    },
    [getWorkspaceName, notifyWarning]
  );

  const handleConfigWarning = useCallback(
    (
      workspaceId: string,
      payload: {
        summary: string;
        details: string | null;
        path: string | null;
      }
    ) => {
      const eventKey = `config-warning:${workspaceId}:${payload.path ?? ""}:${payload.summary}`;
      const workspaceName = getWorkspaceName?.(workspaceId);
      const title = workspaceName ? `Config warning — ${workspaceName}` : "Config warning";
      const bodyParts = [payload.summary];
      if (payload.path) {
        bodyParts.push(payload.path);
      } else if (payload.details) {
        bodyParts.push(payload.details);
      }
      notifyWarning(
        eventKey,
        title,
        truncateText(bodyParts.join(" · "), MAX_BODY_LENGTH),
        "config_warning",
        {
          workspaceId,
          path: payload.path,
        }
      );
    },
    [getWorkspaceName, notifyWarning]
  );

  const handleDeprecationNotice = useCallback(
    (
      workspaceId: string,
      payload: {
        summary: string;
        details: string | null;
      }
    ) => {
      const eventKey = `deprecation:${workspaceId}:${payload.summary}`;
      const workspaceName = getWorkspaceName?.(workspaceId);
      const title = workspaceName ? `Deprecation notice — ${workspaceName}` : "Deprecation notice";
      const body = truncateText(
        payload.details ? `${payload.summary} · ${payload.details}` : payload.summary,
        MAX_BODY_LENGTH
      );
      notifyWarning(eventKey, title, body, "deprecation_notice", {
        workspaceId,
      });
    },
    [getWorkspaceName, notifyWarning]
  );

  const handleWindowsWorldWritableWarning = useCallback(
    (
      workspaceId: string,
      payload: {
        samplePaths: string[];
        extraCount: number;
        failedScan: boolean;
      }
    ) => {
      const sample = payload.samplePaths[0] ?? "";
      const eventKey = `windows-world-writable:${workspaceId}:${sample}:${payload.extraCount}:${payload.failedScan}`;
      const workspaceName = getWorkspaceName?.(workspaceId);
      const title = workspaceName
        ? `Windows security warning — ${workspaceName}`
        : "Windows security warning";
      const sampleSuffix = sample ? ` ${sample}` : "";
      const extraSuffix =
        payload.extraCount > 0
          ? ` (+${payload.extraCount} more)`
          : payload.failedScan
            ? " (scan incomplete)"
            : "";
      const body = truncateText(
        `World-writable paths detected:${sampleSuffix}${extraSuffix}`,
        MAX_BODY_LENGTH
      );
      notifyWarning(eventKey, title, body, "windows_world_writable_warning", {
        workspaceId,
        failedScan: payload.failedScan,
      });
    },
    [getWorkspaceName, notifyWarning]
  );

  const handleWindowsSandboxSetupCompleted = useCallback(
    (
      workspaceId: string,
      payload: {
        mode: string;
        success: boolean;
        error: string | null;
      }
    ) => {
      if (payload.success) {
        return;
      }
      const eventKey = `windows-sandbox-setup:${workspaceId}:${payload.mode}:${payload.error ?? ""}`;
      const workspaceName = getWorkspaceName?.(workspaceId);
      const title = workspaceName
        ? `Windows sandbox setup failed — ${workspaceName}`
        : "Windows sandbox setup failed";
      const body = truncateText(payload.error || `Mode: ${payload.mode}`, MAX_BODY_LENGTH);
      notifyWarning(eventKey, title, body, "windows_sandbox_setup_failed", {
        workspaceId,
        mode: payload.mode,
      });
    },
    [getWorkspaceName, notifyWarning]
  );

  const handleMcpServerOauthLoginCompleted = useCallback(
    (
      workspaceId: string,
      payload: {
        name: string;
        success: boolean;
        error: string | null;
      }
    ) => {
      if (payload.success) {
        return;
      }
      const eventKey = `mcp-oauth-failed:${workspaceId}:${payload.name}:${payload.error ?? ""}`;
      const workspaceName = getWorkspaceName?.(workspaceId);
      const title = workspaceName ? `MCP OAuth failed — ${workspaceName}` : "MCP OAuth failed";
      const body = truncateText(
        payload.error ? `${payload.name}: ${payload.error}` : payload.name,
        MAX_BODY_LENGTH
      );
      notifyWarning(eventKey, title, body, "mcp_oauth_login_failed", {
        workspaceId,
        serverName: payload.name,
      });
    },
    [getWorkspaceName, notifyWarning]
  );

  const handlers = useMemo(
    () => ({
      onTurnStarted: handleTurnStarted,
      onTurnCompleted: handleTurnCompleted,
      onTurnError: handleTurnError,
      onItemStarted: handleItemStarted,
      onAgentMessageDelta: handleAgentMessageDelta,
      onAgentMessageCompleted: handleAgentMessageCompleted,
      onModelRerouted: handleModelRerouted,
      onConfigWarning: handleConfigWarning,
      onDeprecationNotice: handleDeprecationNotice,
      onWindowsWorldWritableWarning: handleWindowsWorldWritableWarning,
      onWindowsSandboxSetupCompleted: handleWindowsSandboxSetupCompleted,
      onMcpServerOauthLoginCompleted: handleMcpServerOauthLoginCompleted,
    }),
    [
      handleAgentMessageCompleted,
      handleAgentMessageDelta,
      handleConfigWarning,
      handleDeprecationNotice,
      handleItemStarted,
      handleMcpServerOauthLoginCompleted,
      handleModelRerouted,
      handleTurnCompleted,
      handleTurnError,
      handleTurnStarted,
      handleWindowsSandboxSetupCompleted,
      handleWindowsWorldWritableWarning,
    ]
  );

  useAppServerEvents(handlers);
}
