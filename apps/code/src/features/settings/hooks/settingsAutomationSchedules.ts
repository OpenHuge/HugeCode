import type { RuntimeAutomationScheduleRecord } from "../../../application/runtime/ports/runtimeAutomationSchedules";
import type {
  SettingsAutomationScheduleDraft,
  SettingsAutomationScheduleSummary,
} from "../components/sections/SettingsAutomationSection";

function normalizeScheduleText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeScheduleNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeScheduleBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

export function readScheduleText(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = normalizeScheduleText(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function readScheduleNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = normalizeScheduleNumber(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function readScheduleBoolean(record: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = normalizeScheduleBoolean(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function readScheduleObject(
  record: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function readScheduleStringArray(record: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) {
      continue;
    }
    const normalized = value
      .map((entry) => normalizeScheduleText(entry))
      .filter((entry): entry is string => Boolean(entry));
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function resolveAutomationBackendId(schedule: RuntimeAutomationScheduleRecord): string | null {
  const directBackendId = readScheduleText(
    schedule,
    "backendId",
    "backend_id",
    "preferredBackendId",
    "preferred_backend_id"
  );
  if (directBackendId) {
    return directBackendId;
  }
  return (
    readScheduleStringArray(schedule, "preferredBackendIds", "preferred_backend_ids")[0] ?? null
  );
}

function formatAutomationCadence(schedule: RuntimeAutomationScheduleRecord): string {
  return (
    readScheduleText(
      schedule,
      "cadenceLabel",
      "cadence_label",
      "cadence",
      "humanCadence",
      "human_cadence",
      "cronExpression",
      "cron_expression",
      "cron"
    ) ?? "Awaiting cadence"
  );
}

function normalizeAutomationScheduleStatus(
  schedule: RuntimeAutomationScheduleRecord
): SettingsAutomationScheduleSummary["status"] {
  if (schedule.enabled === false) {
    return "paused";
  }
  const blockingReason = readScheduleText(schedule, "blockingReason", "blockReason", "lastError");
  if (blockingReason) {
    return "blocked";
  }
  const status = readScheduleText(schedule, "status")?.toLowerCase();
  if (status === "running") {
    return "running";
  }
  if (status === "paused" || status === "cancelled") {
    return "paused";
  }
  if (status === "blocked" || status === "failed") {
    return "blocked";
  }
  return "active";
}

export function mapNativeScheduleToDraft(
  schedule: RuntimeAutomationScheduleRecord,
  defaultBackendId: string | null
): SettingsAutomationScheduleDraft {
  const autonomyRequest = readScheduleObject(schedule, "autonomyRequest", "autonomy_request") ?? {};
  const wakePolicy = readScheduleObject(autonomyRequest, "wakePolicy", "wake_policy") ?? {};
  const researchPolicy =
    readScheduleObject(autonomyRequest, "researchPolicy", "research_policy") ?? {};
  const queueBudget = readScheduleObject(autonomyRequest, "queueBudget", "queue_budget") ?? {};
  return {
    name: readScheduleText(schedule, "name") ?? schedule.id,
    prompt: readScheduleText(schedule, "prompt", "taskPrompt", "instructions") ?? "",
    workspaceId: readScheduleText(schedule, "workspaceId", "workspace_id") ?? "",
    cadence: formatAutomationCadence(schedule),
    backendId: resolveAutomationBackendId(schedule) ?? defaultBackendId ?? "",
    reviewProfileId: readScheduleText(schedule, "reviewProfileId", "review_profile_id") ?? "",
    validationPresetId:
      readScheduleText(schedule, "validationPresetId", "validation_preset_id") ?? "",
    enabled: schedule.enabled !== false,
    autonomyProfile:
      readScheduleText(schedule, "autonomyProfile", "autonomy_profile") ??
      readScheduleText(autonomyRequest, "autonomyProfile", "autonomy_profile") ??
      "night_operator",
    sourceScope:
      readScheduleText(schedule, "sourceScope", "source_scope") ??
      readScheduleText(autonomyRequest, "sourceScope", "source_scope") ??
      "workspace_graph",
    wakePolicy:
      readScheduleText(
        schedule,
        "wakePolicy",
        "wake_policy",
        "wakePolicyMode",
        "wake_policy_mode"
      ) ??
      readScheduleText(wakePolicy, "mode") ??
      "auto_queue",
    researchPolicy:
      readScheduleText(schedule, "researchPolicy", "research_policy") ??
      readScheduleText(researchPolicy, "mode") ??
      "repository_only",
    queueBudget: String(
      readScheduleNumber(schedule, "queueBudget", "queue_budget") ??
        readScheduleNumber(queueBudget, "maxQueuedActions", "max_queued_actions") ??
        2
    ),
    safeFollowUp:
      readScheduleBoolean(schedule, "safeFollowUp", "safe_follow_up") ??
      readScheduleBoolean(wakePolicy, "safeFollowUp", "safe_follow_up") ??
      true,
  };
}

function sanitizeExistingScheduleRecord(
  existing?: RuntimeAutomationScheduleRecord | null
): Record<string, unknown> {
  if (!existing) {
    return {};
  }
  const sanitized: Record<string, unknown> = { ...existing };
  for (const key of [
    "currentTaskStatus",
    "current_task_status",
    "lastTriggeredTaskStatus",
    "last_triggered_task_status",
    "reviewActionability",
    "review_actionability",
    "reviewActionabilityState",
    "reviewPackId",
    "review_pack_id",
    "reviewPackSummary",
    "review_pack_summary",
    "missionLinkage",
    "mission_linkage",
    "taskSource",
    "task_source",
  ]) {
    delete sanitized[key];
  }
  return sanitized;
}

export function buildNativeSchedulePayload(
  draft: SettingsAutomationScheduleDraft,
  existing?: RuntimeAutomationScheduleRecord | null
): Record<string, unknown> {
  const existingBase = sanitizeExistingScheduleRecord(existing);
  const backendId = normalizeScheduleText(draft.backendId);
  const workspaceId = normalizeScheduleText(draft.workspaceId);
  const cadence = normalizeScheduleText(draft.cadence);
  const reviewProfileId = normalizeScheduleText(draft.reviewProfileId);
  const validationPresetId = normalizeScheduleText(draft.validationPresetId);
  const autonomyProfile = normalizeScheduleText(draft.autonomyProfile) ?? "night_operator";
  const sourceScope = normalizeScheduleText(draft.sourceScope) ?? "workspace_graph";
  const wakePolicyMode = normalizeScheduleText(draft.wakePolicy) ?? "auto_queue";
  const researchPolicyMode = normalizeScheduleText(draft.researchPolicy) ?? "repository_only";
  const queueBudget =
    normalizeScheduleNumber(draft.queueBudget) ??
    normalizeScheduleNumber(existing?.queueBudget) ??
    2;
  const existingStatus = readScheduleText(existing ?? {}, "status");

  return {
    ...existingBase,
    name: normalizeScheduleText(draft.name) ?? existing?.name ?? "Scheduled automation",
    prompt: normalizeScheduleText(draft.prompt) ?? "",
    workspaceId,
    cadenceLabel: cadence,
    cadence,
    cron: cadence,
    preferredBackendId: backendId,
    preferredBackendIds: backendId ? [backendId] : [],
    reviewProfileId,
    validationPresetId,
    autonomyProfile,
    sourceScope,
    wakePolicy: wakePolicyMode,
    researchPolicy: researchPolicyMode,
    queueBudget,
    safeFollowUp: draft.safeFollowUp,
    autonomyRequest: {
      autonomyProfile,
      sourceScope,
      queueBudget: {
        maxQueuedActions: queueBudget,
        maxAutoContinuations: queueBudget,
      },
      wakePolicy: {
        mode: wakePolicyMode,
        safeFollowUp: draft.safeFollowUp,
        allowAutomaticContinuation: draft.enabled,
        allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
        stopGates: [
          "destructive_change_requires_review",
          "dependency_change_requires_review",
          "validation_failure_requires_review",
        ],
        queueBudget: {
          maxQueuedActions: queueBudget,
          maxAutoContinuations: queueBudget,
        },
      },
      researchPolicy: {
        mode: researchPolicyMode,
        allowNetworkAnalysis: researchPolicyMode !== "repository_only",
        requireCitations: true,
        allowPrivateContextStage: researchPolicyMode === "staged",
      },
    },
    enabled: draft.enabled,
    triggerSourceLabel:
      readScheduleText(existing ?? {}, "triggerSourceLabel", "trigger_source_label") ?? "schedule",
    status:
      draft.enabled === false
        ? "paused"
        : existingStatus === "paused" || existingStatus === "cancelled"
          ? "idle"
          : (existingStatus ?? "idle"),
  };
}

export function mapNativeScheduleToSummary(
  schedule: RuntimeAutomationScheduleRecord,
  backendOptions: Array<{ id: string; label: string }>
): SettingsAutomationScheduleSummary {
  const autonomyRequest = readScheduleObject(schedule, "autonomyRequest", "autonomy_request") ?? {};
  const wakePolicy = readScheduleObject(autonomyRequest, "wakePolicy", "wake_policy") ?? {};
  const researchPolicy =
    readScheduleObject(autonomyRequest, "researchPolicy", "research_policy") ?? {};
  const queueBudget = readScheduleObject(autonomyRequest, "queueBudget", "queue_budget") ?? {};
  const backendId = resolveAutomationBackendId(schedule);
  const backendLabel =
    readScheduleText(
      schedule,
      "backendLabel",
      "backend_label",
      "preferredBackendLabel",
      "preferred_backend_label"
    ) ??
    (backendId
      ? (backendOptions.find((option) => option.id === backendId)?.label ?? backendId)
      : null);

  return {
    id: schedule.id,
    name: readScheduleText(schedule, "name") ?? schedule.id,
    prompt: readScheduleText(schedule, "prompt", "taskPrompt", "instructions") ?? "",
    workspaceId: readScheduleText(schedule, "workspaceId", "workspace_id") ?? null,
    cadenceLabel: formatAutomationCadence(schedule),
    status: normalizeAutomationScheduleStatus(schedule),
    nextRunAtMs: readScheduleNumber(
      schedule,
      "nextRunAtMs",
      "nextRunAt",
      "next_run_at_ms",
      "next_run_at"
    ),
    lastRunAtMs: readScheduleNumber(
      schedule,
      "lastRunAtMs",
      "lastRunAt",
      "last_run_at_ms",
      "last_run_at",
      "lastActionAt",
      "last_action_at"
    ),
    lastOutcomeLabel:
      readScheduleText(schedule, "lastOutcomeLabel", "lastOutcome", "lastResult", "status") ?? null,
    backendId,
    backendLabel,
    reviewProfileId: readScheduleText(schedule, "reviewProfileId", "review_profile_id") ?? null,
    reviewProfileLabel:
      readScheduleText(schedule, "reviewProfileLabel", "review_profile_label") ?? null,
    validationPresetId:
      readScheduleText(schedule, "validationPresetId", "validation_preset_id") ?? null,
    validationPresetLabel:
      readScheduleText(schedule, "validationPresetLabel", "validation_preset_label") ?? null,
    triggerSourceLabel:
      readScheduleText(schedule, "triggerSourceLabel", "trigger_source_label") ?? "schedule",
    blockingReason:
      readScheduleText(schedule, "blockingReason", "blockReason", "lastError") ?? null,
    safeFollowUp:
      readScheduleBoolean(schedule, "safeFollowUp", "safe_follow_up") ??
      readScheduleBoolean(wakePolicy, "safeFollowUp", "safe_follow_up"),
    autonomyProfile:
      readScheduleText(schedule, "autonomyProfile", "autonomy_profile") ??
      readScheduleText(autonomyRequest, "autonomyProfile", "autonomy_profile") ??
      null,
    sourceScope:
      readScheduleText(schedule, "sourceScope", "source_scope") ??
      readScheduleText(autonomyRequest, "sourceScope", "source_scope") ??
      null,
    wakePolicy:
      readScheduleText(
        schedule,
        "wakePolicy",
        "wake_policy",
        "wakePolicyMode",
        "wake_policy_mode"
      ) ??
      readScheduleText(wakePolicy, "mode") ??
      null,
    researchPolicy:
      readScheduleText(schedule, "researchPolicy", "research_policy") ??
      readScheduleText(researchPolicy, "mode") ??
      null,
    queueBudget:
      readScheduleNumber(schedule, "queueBudget", "queue_budget") ??
      readScheduleNumber(queueBudget, "maxQueuedActions", "max_queued_actions"),
    currentTaskId: readScheduleText(schedule, "currentTaskId", "current_task_id") ?? null,
    currentTaskStatus:
      readScheduleText(schedule, "currentTaskStatus", "current_task_status") ?? null,
    currentRunId: readScheduleText(schedule, "currentRunId", "current_run_id") ?? null,
    lastTriggeredTaskId:
      readScheduleText(schedule, "lastTriggeredTaskId", "last_triggered_task_id") ?? null,
    lastTriggeredTaskStatus:
      readScheduleText(schedule, "lastTriggeredTaskStatus", "last_triggered_task_status") ?? null,
    lastTriggeredRunId:
      readScheduleText(schedule, "lastTriggeredRunId", "last_triggered_run_id") ?? null,
    reviewPackId: readScheduleText(schedule, "reviewPackId", "review_pack_id") ?? null,
    reviewActionabilityState:
      readScheduleText(
        readScheduleObject(schedule, "reviewActionability", "review_actionability") ?? {},
        "state"
      ) ?? null,
  };
}
