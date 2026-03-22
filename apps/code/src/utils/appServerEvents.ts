import type { AppServerEvent } from "../types";

export const SUPPORTED_APP_SERVER_METHODS = [
  "app/list/updated",
  "account/login/completed",
  "account/rateLimits/updated",
  "account/chatgptAuthTokens/refresh",
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
  "native_state_fabric_updated",
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
] as const;

export type SupportedAppServerMethod = (typeof SUPPORTED_APP_SERVER_METHODS)[number];

export const METHODS_HANDLED_OUTSIDE_USE_APP_SERVER_EVENTS = [
  "app/list/updated",
  "native_state_fabric_updated",
] as const satisfies readonly SupportedAppServerMethod[];

const SUPPORTED_METHOD_SET = new Set<string>(SUPPORTED_APP_SERVER_METHODS);

function getAppServerMessageObject(event: AppServerEvent): Record<string, unknown> | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const message = (event as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }
  return message as Record<string, unknown>;
}

export function getAppServerRawMethod(event: AppServerEvent): string | null {
  const message = getAppServerMessageObject(event);
  if (!message) {
    return null;
  }
  const method = message.method;
  if (typeof method !== "string") {
    return null;
  }
  const trimmed = method.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isSupportedAppServerMethod(method: string): method is SupportedAppServerMethod {
  return SUPPORTED_METHOD_SET.has(method);
}

export function getAppServerParams(event: AppServerEvent): Record<string, unknown> {
  const message = getAppServerMessageObject(event);
  if (!message) {
    return {};
  }
  const params = message.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }
  return params as Record<string, unknown>;
}

export function getAppServerRequestId(event: AppServerEvent): string | number | null {
  const message = getAppServerMessageObject(event);
  if (!message) {
    return null;
  }
  const requestId = message.id;
  if (typeof requestId === "number" || typeof requestId === "string") {
    return requestId;
  }
  return null;
}

export function isApprovalRequestMethod(method: string): boolean {
  return method.endsWith("requestApproval");
}

export function isSkillsUpdateAvailableEvent(event: AppServerEvent): boolean {
  if (getAppServerRawMethod(event) !== "native_state_fabric_updated") {
    return false;
  }
  const params = getAppServerParams(event);
  return (params.scopeKind ?? params.scope_kind) === "skills";
}

export function isNativeStateFabricUpdatedEvent(event: AppServerEvent): boolean {
  return getAppServerRawMethod(event) === "native_state_fabric_updated";
}

export function isAppListUpdatedEvent(event: AppServerEvent): boolean {
  return getAppServerRawMethod(event) === "app/list/updated";
}
