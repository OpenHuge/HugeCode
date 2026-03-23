import {
  CODE_RUNTIME_RPC_METHODS,
  CODE_RUNTIME_RPC_METHOD_LIST,
  type CodeRuntimeRpcCapabilities,
  type CodeRuntimeRpcMethod,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";

export const CODE_RUNTIME_RPC_PREFIX = "code_";
export const NATIVE_RUNTIME_RPC_PREFIX = "native_";

const CODE_RUNTIME_METHOD_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_RPC_METHOD_LIST);

export type NativeRuntimeRpcMethod = `${typeof NATIVE_RUNTIME_RPC_PREFIX}${string}`;

const NATIVE_RUNTIME_RPC_CAPABILITIES_METHOD = "native_rpc_capabilities" as const;

export const NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST = [
  "native_management_snapshot",
  "native_review_comments_list",
  "native_review_comment_upsert",
  "native_review_comment_remove",
  "native_review_comment_set_resolved",
  "native_providers_snapshot",
  "native_providers_connection_probe",
  "native_tools_list",
  "native_tool_policy_upsert",
  "native_tool_set_enabled",
  "native_tool_secret_upsert",
  "native_tool_secret_remove",
  "native_themes_list",
  "native_theme_upsert",
  "native_theme_remove",
  "native_theme_set_active",
  "native_schedules_list",
  "native_schedule_create",
  "native_schedule_update",
  "native_schedule_delete",
  "native_schedule_run_now",
  "native_schedule_cancel_run",
  "native_watchers_list",
  "native_watcher_create",
  "native_watcher_update",
  "native_watcher_delete",
  "native_watcher_set_enabled",
  "native_insights_summary",
  "native_insights_timeseries",
  "native_insights_events",
  "native_server_status",
  "native_server_config_get",
  "native_server_config_set",
  "native_settings_get",
  "native_settings_set",
  "native_voice_config_get",
  "native_voice_config_set",
  "native_voice_hotkey_set",
  "native_state_fabric_snapshot",
  "native_state_fabric_delta",
  "native_state_fabric_diagnostics",
] as const satisfies readonly NativeRuntimeRpcMethod[];

export const NATIVE_RUNTIME_ALIAS_METHOD_LIST: readonly NativeRuntimeRpcMethod[] = [
  NATIVE_RUNTIME_RPC_CAPABILITIES_METHOD,
] as const;

export const NATIVE_RUNTIME_RPC_METHOD_LIST: readonly NativeRuntimeRpcMethod[] = [
  ...new Set<NativeRuntimeRpcMethod>([
    ...NATIVE_RUNTIME_ALIAS_METHOD_LIST,
    ...NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST,
  ]),
].sort((left, right) => left.localeCompare(right));

const NATIVE_RUNTIME_METHOD_SET: ReadonlySet<string> = new Set(NATIVE_RUNTIME_RPC_METHOD_LIST);

export const NATIVE_RUNTIME_EVENT_METHODS = ["native_state_fabric_updated"] as const;

const NATIVE_RUNTIME_CAPABILITY_FEATURES = [
  "native_rpc_namespace_v1",
  "native_state_fabric_v1",
  "native_capability_schema_v2",
] as const;

export type NativeRuntimeEventMethod = (typeof NATIVE_RUNTIME_EVENT_METHODS)[number];

export type NativeStateFabricScope =
  | { kind: "global" }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "thread"; workspaceId: string; threadId: string }
  | { kind: "terminal"; workspaceId: string; sessionId: string }
  | { kind: "skills"; workspaceId?: string | null }
  | { kind: "task"; taskId: string }
  | { kind: "run"; runId: string };

export type NativeStateFabricChange =
  | { kind: "workspaceUpsert"; workspaceId: string }
  | { kind: "workspaceRemove"; workspaceId: string }
  | { kind: "threadUpsert"; workspaceId: string; threadId: string }
  | { kind: "threadRemove"; workspaceId: string; threadId: string }
  | { kind: "threadLiveStatePatched"; workspaceId: string; threadId: string }
  | { kind: "threadLiveHeartbeatObserved"; workspaceId: string; threadId: string }
  | { kind: "threadLiveDetached"; workspaceId: string; threadId: string }
  | { kind: "taskUpsert"; taskId: string; workspaceId?: string | null }
  | { kind: "taskRemove"; taskId: string; workspaceId?: string | null }
  | { kind: "runUpsert"; runId: string; taskId?: string | null; workspaceId?: string | null }
  | { kind: "runRemove"; runId: string; taskId?: string | null; workspaceId?: string | null }
  | { kind: "terminalSessionUpsert"; workspaceId: string; sessionId: string }
  | { kind: "terminalOutputAppended"; workspaceId: string; sessionId: string }
  | { kind: "terminalSessionStatePatched"; workspaceId: string; sessionId: string }
  | { kind: "skillsCatalogPatched"; workspaceId?: string | null }
  | { kind: "skillsWatcherStatePatched"; workspaceId?: string | null }
  | { kind: "skillsFingerprintPatched"; workspaceId?: string | null }
  | { kind: "runtimeCapabilitiesPatched" };

export type NativeStateFabricEnvelope = {
  revision: number;
  emittedAt: number;
  scopeHints: NativeStateFabricScope[];
  change: NativeStateFabricChange;
};

export type NativeStateFabricSnapshot = {
  revision: number;
  scope: NativeStateFabricScope;
  state: Record<string, unknown>;
};

export type NativeStateFabricDelta = {
  baseRevision: number;
  revision: number;
  scope: NativeStateFabricScope;
  changes: NativeStateFabricEnvelope[];
};

export type NativeStateFabricResyncRequired = {
  requestedRevision: number;
  latestRevision: number;
  oldestAvailableRevision: number | null;
  scope: NativeStateFabricScope;
};

export type NativeStateFabricDiagnostics = {
  revision: number;
  oldestAvailableRevision: number | null;
  retainedChangeCount: number;
  retainedChangeBytes?: number;
  projectionKeys?: string[];
};

export type NativeRuntimeRpcCapabilities = Omit<
  CodeRuntimeRpcCapabilities,
  "methods" | "methodSetHash"
> & {
  namespace: "native";
  methods: NativeRuntimeRpcMethod[];
  methodSetHash: string;
  eventMethods: NativeRuntimeEventMethod[];
  methodSets?: {
    aliasNativeMethods: NativeRuntimeRpcMethod[];
    nativeOnlyMethods: NativeRuntimeRpcMethod[];
  };
  capabilities?: {
    nativeCapabilitySchemaVersion?: "v2" | string;
    uiLayers?: {
      sidebar: boolean;
      timeline: boolean;
      composer: boolean;
      managementCenter: boolean;
      reviewPanel: boolean;
      utilityPanel: boolean;
    };
    voice?: {
      vad: boolean;
      transcription: boolean;
      globalHotkey: boolean;
    };
    workflow?: {
      workMode: boolean;
      parallelTasks: boolean;
      approvals: boolean;
      resume: boolean;
    };
    tooling?: {
      plugins: boolean;
      tools: boolean;
      skills: boolean;
    };
    fallback?: {
      threadLive: "polling";
      runtimeOffline: "degraded";
    };
  };
};

function trimMethod(method: string): string {
  return method.trim();
}

export function toNativeRuntimeRpcMethod(method: string): NativeRuntimeRpcMethod {
  const normalized = trimMethod(method);
  if (normalized.startsWith(NATIVE_RUNTIME_RPC_PREFIX)) {
    return normalized as NativeRuntimeRpcMethod;
  }
  if (normalized.startsWith(CODE_RUNTIME_RPC_PREFIX)) {
    return `${NATIVE_RUNTIME_RPC_PREFIX}${normalized.slice(CODE_RUNTIME_RPC_PREFIX.length)}`;
  }
  return `${NATIVE_RUNTIME_RPC_PREFIX}${normalized}`;
}

export function toCodeRuntimeRpcMethod(method: string): CodeRuntimeRpcMethod | null {
  const normalized = trimMethod(method);

  if (CODE_RUNTIME_METHOD_SET.has(normalized)) {
    return normalized as CodeRuntimeRpcMethod;
  }

  if (!normalized.startsWith(NATIVE_RUNTIME_RPC_PREFIX)) {
    return null;
  }

  const codeMethod = `${CODE_RUNTIME_RPC_PREFIX}${normalized.slice(NATIVE_RUNTIME_RPC_PREFIX.length)}`;
  if (!CODE_RUNTIME_METHOD_SET.has(codeMethod)) {
    return null;
  }
  return codeMethod as CodeRuntimeRpcMethod;
}

export function isNativeRuntimeRpcMethod(method: string): boolean {
  return NATIVE_RUNTIME_METHOD_SET.has(trimMethod(method));
}

export function isCodeRuntimeRpcMethod(method: string): boolean {
  return CODE_RUNTIME_METHOD_SET.has(trimMethod(method));
}

export function toNativeRuntimeCapabilities(
  capabilities: CodeRuntimeRpcCapabilities
): NativeRuntimeRpcCapabilities {
  const aliasNativeMethods = capabilities.methods
    .filter((method) => method === CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES)
    .map((method) => toNativeRuntimeRpcMethod(method))
    .sort((left, right) => left.localeCompare(right));
  const features = [
    ...new Set([...capabilities.features, ...NATIVE_RUNTIME_CAPABILITY_FEATURES]),
  ].sort((left, right) => left.localeCompare(right));
  const methods = [
    ...new Set<NativeRuntimeRpcMethod>([
      ...aliasNativeMethods,
      ...NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST,
    ]),
  ].sort((left, right) => left.localeCompare(right));

  return {
    ...capabilities,
    features,
    namespace: "native",
    methods,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    eventMethods: [...NATIVE_RUNTIME_EVENT_METHODS],
    methodSets: {
      aliasNativeMethods,
      nativeOnlyMethods: [...NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST],
    },
    capabilities: {
      nativeCapabilitySchemaVersion: "v2",
      uiLayers: {
        sidebar: true,
        timeline: true,
        composer: true,
        managementCenter: true,
        reviewPanel: true,
        utilityPanel: true,
      },
      voice: {
        vad: true,
        transcription: true,
        globalHotkey: true,
      },
      workflow: {
        workMode: true,
        parallelTasks: true,
        approvals: true,
        resume: true,
      },
      tooling: {
        plugins: false,
        tools: true,
        skills: false,
      },
      fallback: {
        threadLive: "polling",
        runtimeOffline: "degraded",
      },
    },
  };
}

export type NativeRpcMethodPair = {
  codeMethod: CodeRuntimeRpcMethod;
  nativeMethod: NativeRuntimeRpcMethod;
};

export const NATIVE_RUNTIME_METHOD_MAP: readonly NativeRpcMethodPair[] =
  CODE_RUNTIME_RPC_METHOD_LIST.filter(
    (method) => method === CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES
  ).map((method) => ({
    codeMethod: method,
    nativeMethod: toNativeRuntimeRpcMethod(method),
  }));
