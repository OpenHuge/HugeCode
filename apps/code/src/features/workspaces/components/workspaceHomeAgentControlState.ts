import type {
  AgentIntentPriority,
  AgentIntentState,
} from "../../../application/runtime/types/webMcpBridge";
import type { WorkspaceAgentControlPersistedState } from "../../../types";

type LegacyStoredAgentControlState = {
  version?: number;
  intent?: unknown;
  webMcpEnabled?: unknown;
  readOnlyMode?: unknown;
  requireUserApproval?: unknown;
  webMcpAutoExecuteCalls?: unknown;
  webMcpConsoleMode?: unknown;
};

export type WebMcpConsoleMode = "basic" | "advanced";

export type WorkspaceAgentControlPersistedControls = {
  readOnlyMode: boolean;
  requireUserApproval: boolean;
  webMcpAutoExecuteCalls: boolean;
};

export type CachedAgentControlState = {
  version: 7;
  intent: AgentIntentState;
  webMcpEnabled: boolean;
  webMcpConsoleMode: WebMcpConsoleMode;
  lastKnownPersistedControls: WorkspaceAgentControlPersistedControls;
};

const STORAGE_PREFIX = "workspace-home-agent-control";

export const INTENT_PRIORITY_OPTIONS: Array<{ value: AgentIntentPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const DEFAULT_INTENT: AgentIntentState = {
  objective: "",
  constraints: "",
  successCriteria: "",
  deadline: null,
  priority: "medium",
  managerNotes: "",
};

export const DEFAULT_PERSISTED_AGENT_CONTROLS: WorkspaceAgentControlPersistedControls = {
  readOnlyMode: false,
  requireUserApproval: true,
  webMcpAutoExecuteCalls: true,
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeWebMcpConsoleMode(value: unknown): WebMcpConsoleMode {
  return value === "advanced" ? "advanced" : "basic";
}

function parseIntent(value: unknown): AgentIntentState | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  return {
    objective: String(record.objective ?? ""),
    constraints: String(record.constraints ?? ""),
    successCriteria: String(record.successCriteria ?? ""),
    deadline:
      typeof record.deadline === "string" && record.deadline.trim().length > 0
        ? record.deadline
        : null,
    priority: ["low", "medium", "high", "critical"].includes(String(record.priority))
      ? (record.priority as AgentIntentPriority)
      : "medium",
    managerNotes: String(record.managerNotes ?? ""),
  };
}

function normalizePersistedControls(value: unknown): WorkspaceAgentControlPersistedControls | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }
  return {
    readOnlyMode:
      typeof record.readOnlyMode === "boolean"
        ? record.readOnlyMode
        : DEFAULT_PERSISTED_AGENT_CONTROLS.readOnlyMode,
    requireUserApproval:
      typeof record.requireUserApproval === "boolean"
        ? record.requireUserApproval
        : DEFAULT_PERSISTED_AGENT_CONTROLS.requireUserApproval,
    webMcpAutoExecuteCalls:
      typeof record.webMcpAutoExecuteCalls === "boolean"
        ? record.webMcpAutoExecuteCalls
        : DEFAULT_PERSISTED_AGENT_CONTROLS.webMcpAutoExecuteCalls,
  };
}

export function resolvePersistedAgentControls(
  value: WorkspaceAgentControlPersistedState | null | undefined
): WorkspaceAgentControlPersistedControls {
  return {
    readOnlyMode:
      typeof value?.readOnlyMode === "boolean"
        ? value.readOnlyMode
        : DEFAULT_PERSISTED_AGENT_CONTROLS.readOnlyMode,
    requireUserApproval:
      typeof value?.requireUserApproval === "boolean"
        ? value.requireUserApproval
        : DEFAULT_PERSISTED_AGENT_CONTROLS.requireUserApproval,
    webMcpAutoExecuteCalls:
      typeof value?.webMcpAutoExecuteCalls === "boolean"
        ? value.webMcpAutoExecuteCalls
        : DEFAULT_PERSISTED_AGENT_CONTROLS.webMcpAutoExecuteCalls,
  };
}

function buildCachedState(
  intent: AgentIntentState,
  webMcpEnabled: boolean,
  webMcpConsoleMode: WebMcpConsoleMode,
  lastKnownPersistedControls: WorkspaceAgentControlPersistedControls
): CachedAgentControlState {
  return {
    version: 7,
    intent,
    webMcpEnabled,
    webMcpConsoleMode,
    lastKnownPersistedControls,
  };
}

export function toDateValue(value: string | null): string {
  return value ?? "";
}

export function normalizeDateInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatRuntimeTimestamp(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
}

export function readCachedState(workspaceId: string): CachedAgentControlState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `${STORAGE_PREFIX}:${workspaceId}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = toRecord(JSON.parse(raw)) as LegacyStoredAgentControlState | null;
    if (!parsed) {
      return null;
    }

    const intent = parseIntent(parsed.intent);
    if (!intent) {
      return null;
    }

    const lastKnownPersistedControls = normalizePersistedControls(
      (parsed as Record<string, unknown>).lastKnownPersistedControls
    ) ?? {
      readOnlyMode: parsed.readOnlyMode === true,
      requireUserApproval: parsed.requireUserApproval !== false,
      webMcpAutoExecuteCalls: parsed.webMcpAutoExecuteCalls !== false,
    };

    return buildCachedState(
      intent,
      parsed.webMcpEnabled !== false,
      normalizeWebMcpConsoleMode(parsed.webMcpConsoleMode),
      lastKnownPersistedControls
    );
  } catch {
    return null;
  }
}

export function writeCachedState(workspaceId: string, payload: CachedAgentControlState) {
  if (typeof window === "undefined") {
    return;
  }

  const key = `${STORAGE_PREFIX}:${workspaceId}`;
  window.localStorage.setItem(key, JSON.stringify(payload));
}
