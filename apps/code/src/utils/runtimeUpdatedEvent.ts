import type { AppServerEvent } from "../types";
import { isRuntimeLocalWorkspaceId } from "./runtimeWorkspaceIds";
import { getAppServerParams, getAppServerRawMethod } from "./appServerEvents";

export type RuntimeUpdatedEvent = {
  event: AppServerEvent;
  params: Record<string, unknown>;
  scope: string[];
  reason: string;
  eventWorkspaceId: string;
  paramsWorkspaceId: string | null;
  isWorkspaceLocalEvent: boolean;
};

const LEGACY_RUNTIME_UPDATED_REASON_MAP = Object.freeze({
  code_runtime_run_start: "code_runtime_run_start_v2",
  code_runtime_run_cancel: "code_runtime_run_cancel_v2",
  code_runtime_run_resume: "code_runtime_run_resume_v2",
  code_runtime_run_intervene: "code_runtime_run_intervene_v2",
  code_runtime_run_subscribe: "code_runtime_run_subscribe_v2",
} satisfies Record<string, string>);

function normalizeRuntimeUpdatedScope(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    ),
  ];
}

function pushScope(scopes: Set<string>, scope: string): void {
  const trimmed = scope.trim();
  if (trimmed.length > 0) {
    scopes.add(trimmed);
  }
}

export function toOptionalWorkspaceId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNativeStateFabricScope(params: Record<string, unknown>): string[] {
  const scopes = new Set<string>();
  for (const scope of normalizeRuntimeUpdatedScope(params.scope)) {
    pushScope(scopes, scope);
  }
  const scopeKind =
    toOptionalWorkspaceId(params.scopeKind) ?? toOptionalWorkspaceId(params.scope_kind);
  const changeKind =
    toOptionalWorkspaceId(params.changeKind) ?? toOptionalWorkspaceId(params.change_kind);

  switch (scopeKind) {
    case "global":
      pushScope(scopes, "bootstrap");
      break;
    case "workspace":
      pushScope(scopes, "bootstrap");
      pushScope(scopes, "workspaces");
      break;
    case "thread":
      pushScope(scopes, "threads");
      break;
    case "task":
    case "run":
      pushScope(scopes, "agents");
      break;
    case "terminal":
      pushScope(scopes, "terminal");
      break;
    case "skills":
      pushScope(scopes, "skills");
      break;
    default:
      break;
  }

  switch (changeKind) {
    case "workspaceUpsert":
    case "workspaceRemove":
      pushScope(scopes, "bootstrap");
      pushScope(scopes, "workspaces");
      break;
    case "threadUpsert":
    case "threadRemove":
    case "threadLiveStatePatched":
    case "threadLiveHeartbeatObserved":
    case "threadLiveDetached":
      pushScope(scopes, "threads");
      break;
    case "taskUpsert":
    case "taskRemove":
    case "runUpsert":
    case "runRemove":
      pushScope(scopes, "agents");
      break;
    case "terminalSessionUpsert":
    case "terminalOutputAppended":
    case "terminalSessionStatePatched":
      pushScope(scopes, "terminal");
      break;
    case "skillsCatalogPatched":
    case "skillsWatcherStatePatched":
    case "skillsFingerprintPatched":
      pushScope(scopes, "skills");
      break;
    case "runtimeCapabilitiesPatched":
      pushScope(scopes, "bootstrap");
      pushScope(scopes, "models");
      pushScope(scopes, "oauth");
      break;
    default:
      break;
  }

  return [...scopes];
}

export function parseRuntimeUpdatedEvent(event: AppServerEvent): RuntimeUpdatedEvent | null {
  const method = getAppServerRawMethod(event);
  if (method !== "runtime/updated" && method !== "native_state_fabric_updated") {
    return null;
  }
  const params = getAppServerParams(event);
  const eventWorkspaceId = toOptionalWorkspaceId(event.workspace_id) ?? "";
  const paramsWorkspaceId =
    toOptionalWorkspaceId(params.workspaceId) ?? toOptionalWorkspaceId(params.workspace_id);
  const rawReason =
    method === "runtime/updated"
      ? (toOptionalWorkspaceId(params.reason) ?? "")
      : (toOptionalWorkspaceId(params.changeKind) ??
        toOptionalWorkspaceId(params.change_kind) ??
        toOptionalWorkspaceId(params.reason) ??
        "native_state_fabric_updated");
  return {
    event,
    params,
    scope:
      method === "runtime/updated"
        ? normalizeRuntimeUpdatedScope(params.scope)
        : normalizeNativeStateFabricScope(params),
    reason: LEGACY_RUNTIME_UPDATED_REASON_MAP[rawReason] ?? rawReason,
    eventWorkspaceId,
    paramsWorkspaceId,
    isWorkspaceLocalEvent: isRuntimeLocalWorkspaceId(eventWorkspaceId),
  };
}

export function runtimeUpdatedEventMatchesWorkspace(
  runtimeUpdatedEvent: RuntimeUpdatedEvent,
  workspaceId: string | null
): boolean {
  if (!workspaceId) {
    return false;
  }
  if (runtimeUpdatedEvent.eventWorkspaceId === workspaceId) {
    return true;
  }
  if (runtimeUpdatedEvent.paramsWorkspaceId === workspaceId) {
    return true;
  }
  if (runtimeUpdatedEvent.isWorkspaceLocalEvent) {
    return (
      runtimeUpdatedEvent.paramsWorkspaceId === null ||
      runtimeUpdatedEvent.paramsWorkspaceId === workspaceId
    );
  }
  return false;
}
