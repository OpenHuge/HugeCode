import { recordSentryMetric } from "../features/shared/sentry";
import { logger } from "./logger";

type LegacyLifecycleUsageInput = {
  method: string;
  workspaceId?: string | null;
  threadId?: string | null;
  source?: string | null;
  executionMode?: string | null;
  missionMode?: string | null;
};

type LegacyEventTranslationInput = {
  eventKind: string;
  translatedMethod: string;
  workspaceId?: string | null;
  threadId?: string | null;
};

const loggedLegacyUsageKeys = new Set<string>();

function normalizeTelemetryValue(value: string | null | undefined, fallback = "unknown"): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function logLegacyUsageOnce(key: string, message: string, context: Record<string, unknown>) {
  if (loggedLegacyUsageKeys.has(key)) {
    return;
  }
  loggedLegacyUsageKeys.add(key);
  logger.warn(message, context);
}

export function recordLegacyLifecycleUsage(input: LegacyLifecycleUsageInput): void {
  const method = normalizeTelemetryValue(input.method);
  const source = normalizeTelemetryValue(input.source, "compat_unspecified");
  const workspaceId = normalizeTelemetryValue(input.workspaceId);
  const threadId = normalizeTelemetryValue(input.threadId);
  const executionMode = normalizeTelemetryValue(input.executionMode);
  const missionMode = normalizeTelemetryValue(input.missionMode, "none");

  recordSentryMetric("runtime_legacy_lifecycle_usage", 1, {
    attributes: {
      method,
      source,
      workspace_id: workspaceId,
      thread_id: threadId,
      execution_mode: executionMode,
      mission_mode: missionMode,
    },
  });

  logLegacyUsageOnce(
    `${method}:${source}:${executionMode}:${missionMode}`,
    "[runtime-legacy] Compatibility-only lifecycle surface used.",
    {
      method,
      source,
      workspaceId,
      threadId,
      executionMode,
      missionMode,
    }
  );
}

export function recordLegacyEventTranslationUsage(input: LegacyEventTranslationInput): void {
  const eventKind = normalizeTelemetryValue(input.eventKind);
  const translatedMethod = normalizeTelemetryValue(input.translatedMethod);
  const workspaceId = normalizeTelemetryValue(input.workspaceId);
  const threadId = normalizeTelemetryValue(input.threadId);

  recordSentryMetric("runtime_legacy_event_translation", 1, {
    attributes: {
      event_kind: eventKind,
      translated_method: translatedMethod,
      workspace_id: workspaceId,
      thread_id: threadId,
    },
  });

  logLegacyUsageOnce(
    `event:${eventKind}:${translatedMethod}`,
    "[runtime-legacy] Compatibility event translation used.",
    {
      eventKind,
      translatedMethod,
      workspaceId,
      threadId,
    }
  );
}

export function __resetRuntimeLegacyLifecycleTelemetryForTests(): void {
  loggedLegacyUsageKeys.clear();
}
