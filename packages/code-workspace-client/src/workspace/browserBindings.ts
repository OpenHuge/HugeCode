import {
  CODE_RUNTIME_RPC_METHODS,
  type CodeRuntimeRpcRequestPayloadByMethod,
  type CodeRuntimeRpcResponsePayloadByMethod,
  type HugeCodeMissionControlSnapshot,
  type KernelJob,
  type KernelProjectionBootstrapRequest,
  type KernelProjectionBootstrapResponse,
  type KernelProjectionDelta,
  type KernelProjectionScope,
  type KernelProjectionSubscriptionRequest,
  type RuntimeRunInterventionAck,
  type RuntimeRunInterventionRequest,
  type RuntimeRunRecordV2,
  type RuntimeRunResumeAck,
} from "@ku0/code-runtime-host-contract";
import {
  buildManualWebRuntimeGatewayProfile,
  detectBrowserRuntimeConnectionState,
  discoverLocalRuntimeGatewayTargets as discoverLocalRuntimeGatewayTargetsShared,
  MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY,
  readStoredWebRuntimeGatewayProfile,
  saveStoredWebRuntimeGatewayProfile,
  type ConfiguredWebRuntimeGatewayProfile,
} from "@ku0/shared/runtimeGatewayBrowser";
import { toSafeExternalUrl } from "@ku0/shared";
import { WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY } from "@ku0/shared/runtimeGatewayEnv";
import type {
  DiscoveredLocalRuntimeGatewayTarget,
  ManualWebRuntimeGatewayTarget,
  WorkspaceClientHostBindings,
  WorkspaceClientRuntimeBindings,
  WorkspaceClientRuntimeGatewayBindings,
  WorkspaceClientRuntimeMode,
} from "./bindings";
import { buildSharedMissionControlSummary } from "../workspace-shell/sharedMissionControlSummary";

type UnknownRecord = Record<string, unknown>;

const runtimeModeListeners = new Set<() => void>();
let runtimeModeStorageSubscriptions = 0;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readConfiguredWebRuntimeGatewayEndpoint(): string | null {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const nodeLikeGlobal = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const raw =
    env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] ??
    nodeLikeGlobal.process?.env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function deriveWebRuntimeGatewayWebSocketUrl(httpBaseUrl: string): string | null {
  try {
    const endpoint = new URL(httpBaseUrl);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    endpoint.pathname = endpoint.pathname.endsWith("/rpc")
      ? `${endpoint.pathname.slice(0, -4)}/ws`
      : endpoint.pathname.endsWith("/")
        ? `${endpoint.pathname}ws`
        : `${endpoint.pathname}/ws`;
    endpoint.search = "";
    endpoint.hash = "";
    return endpoint.toString();
  } catch {
    return null;
  }
}

function readConfiguredWebRuntimeGatewayProfile(): ConfiguredWebRuntimeGatewayProfile | null {
  const configuredEndpoint = readConfiguredWebRuntimeGatewayEndpoint();
  if (!configuredEndpoint) {
    return null;
  }
  return {
    httpBaseUrl: configuredEndpoint,
    wsBaseUrl: deriveWebRuntimeGatewayWebSocketUrl(configuredEndpoint),
    authToken: null,
    enabled: true,
  };
}

function readActiveWebRuntimeGatewayProfile(): ConfiguredWebRuntimeGatewayProfile | null {
  const storedProfile = readStoredWebRuntimeGatewayProfile();
  if (storedProfile?.enabled && storedProfile.httpBaseUrl) {
    return storedProfile;
  }
  return readConfiguredWebRuntimeGatewayProfile();
}

function emitRuntimeModeChange() {
  for (const listener of runtimeModeListeners) {
    listener();
  }
}

function handleRuntimeModeStorageChange(event: StorageEvent) {
  if (event.key !== null && event.key !== MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY) {
    return;
  }
  emitRuntimeModeChange();
}

function parseKernelProjectionDelta(payload: unknown): KernelProjectionDelta | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }
  const deltaCandidate =
    record.type === "kernel.projection.delta" && isRecord(record.delta)
      ? record.delta
      : record.type === "kernel.projection.delta"
        ? record
        : null;
  if (!deltaCandidate) {
    return null;
  }
  const revision =
    typeof deltaCandidate.revision === "number" && Number.isFinite(deltaCandidate.revision)
      ? deltaCandidate.revision
      : 0;
  const scopes = Array.isArray(deltaCandidate.scopes)
    ? deltaCandidate.scopes.filter(
        (scope): scope is KernelProjectionScope => typeof scope === "string" && scope.length > 0
      )
    : [];
  const ops = Array.isArray(deltaCandidate.ops)
    ? deltaCandidate.ops.filter((op): op is KernelProjectionDelta["ops"][number] => isRecord(op))
    : [];
  if (ops.length === 0) {
    return null;
  }
  return {
    revision,
    scopes,
    ops: ops.map((op) => ({
      type:
        op.type === "replace" ||
        op.type === "upsert" ||
        op.type === "remove" ||
        op.type === "patch" ||
        op.type === "resync_required"
          ? op.type
          : "resync_required",
      scope: typeof op.scope === "string" ? (op.scope as KernelProjectionScope) : "mission_control",
      key: typeof op.key === "string" ? op.key : null,
      value: op.value,
      patch: isRecord(op.patch) ? op.patch : null,
      revision: typeof op.revision === "number" ? op.revision : null,
      reason: typeof op.reason === "string" ? op.reason : null,
    })),
  };
}

function readRuntimeRunId(record: RuntimeRunRecordV2): string {
  const missionRunRecord = record.missionRun as { runId?: string | null };
  return (
    missionRunRecord.runId?.trim() ||
    record.missionRun.id?.trim() ||
    record.run.taskId?.trim() ||
    record.run.runSummary?.id?.trim() ||
    ""
  );
}

function toKernelExecutionProfile(record: RuntimeRunRecordV2): KernelJob["executionProfile"] {
  const distributed = record.run.executionMode === "distributed";
  return {
    placement: distributed ? "remote" : "local",
    interactivity: distributed ? "background" : "interactive",
    isolation: distributed ? "container_sandbox" : "host",
    network: record.run.accessMode === "read-only" ? "restricted" : "default",
    authority: distributed ? "service" : "user",
  };
}

function toKernelContinuation(record: RuntimeRunRecordV2): KernelJob["continuation"] {
  const continuation = record.missionRun.continuation ?? null;
  const reviewPack = record.reviewPack;
  const resumeSupported =
    record.run.checkpointState?.resumeReady === true || continuation?.pathKind === "resume";

  return {
    checkpointId: record.run.checkpointId ?? record.missionRun.checkpoint?.checkpointId ?? null,
    resumeSupported,
    recovered: record.run.recovered === true || record.missionRun.checkpoint?.recovered === true,
    reviewActionability:
      continuation?.reviewActionability ??
      reviewPack?.actionability ??
      record.missionRun.actionability ??
      null,
    takeover: reviewPack?.takeoverBundle ?? record.missionRun.takeoverBundle ?? null,
    missionLinkage: reviewPack?.missionLinkage ?? record.missionRun.missionLinkage ?? null,
    publishHandoff: reviewPack?.publishHandoff ?? record.missionRun.publishHandoff ?? null,
    summary:
      continuation?.summary ??
      reviewPack?.takeoverBundle?.summary ??
      reviewPack?.publishHandoff?.summary ??
      record.missionRun.takeoverBundle?.summary ??
      record.missionRun.publishHandoff?.summary ??
      null,
  };
}

function toKernelJob(record: RuntimeRunRecordV2): KernelJob {
  return {
    id: readRuntimeRunId(record),
    workspaceId: record.run.workspaceId,
    threadId: record.run.threadId ?? record.missionRun.lineage?.threadId ?? null,
    title: record.run.title ?? record.missionRun.title ?? null,
    status: record.run.status,
    provider:
      record.run.provider ??
      record.run.routedProvider ??
      record.missionRun.routing?.provider ??
      null,
    modelId: record.run.modelId ?? record.run.routedModelId ?? null,
    backendId:
      record.run.backendId ??
      record.missionRun.routing?.backendId ??
      record.missionRun.placement?.resolvedBackendId ??
      null,
    preferredBackendIds:
      record.run.preferredBackendIds ?? record.missionRun.placement?.requestedBackendIds ?? null,
    executionProfile: toKernelExecutionProfile(record),
    createdAt: record.run.createdAt,
    updatedAt: record.run.updatedAt,
    startedAt: record.run.startedAt ?? record.missionRun.startedAt ?? null,
    completedAt: record.run.completedAt ?? record.missionRun.finishedAt ?? null,
    continuation: toKernelContinuation(record),
    metadata: {
      canonicalMethod: "code_runtime_run_subscribe_v2",
      runId: record.missionRun.id ?? readRuntimeRunId(record),
      reviewPackId: record.reviewPack?.id ?? record.missionRun.reviewPackId ?? null,
    },
  };
}

function toRuntimeRunResumeAck(record: RuntimeRunRecordV2): RuntimeRunResumeAck {
  return {
    accepted: true,
    runId: readRuntimeRunId(record),
    status: record.run.status,
    code: null,
    message: "Runtime run resumed.",
    recovered: record.run.recovered ?? null,
    checkpointId: record.run.checkpointId ?? null,
    traceId: record.run.traceId ?? null,
    updatedAt: record.run.updatedAt ?? null,
  };
}

function toRuntimeRunInterventionAck(
  request: RuntimeRunInterventionRequest,
  record: RuntimeRunRecordV2
): RuntimeRunInterventionAck {
  const runId = readRuntimeRunId(record);
  const spawnedRunId = runId !== request.runId ? runId : null;
  return {
    accepted: true,
    action: request.action,
    runId,
    status: record.run.status,
    outcome: spawnedRunId ? "spawned" : "submitted",
    spawnedRunId,
    checkpointId: record.run.checkpointId ?? null,
  };
}

function readMissionControlProjectionSlice(
  bootstrap: KernelProjectionBootstrapResponse
): HugeCodeMissionControlSnapshot | null {
  const missionControl = bootstrap.slices.mission_control;
  return missionControl && typeof missionControl === "object"
    ? (missionControl as HugeCodeMissionControlSnapshot)
    : null;
}

function openBrowserExternalUrl(url: string, popup: Window | null = null) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl || typeof window === "undefined") {
    return;
  }
  if (popup) {
    popup.location.replace(safeUrl);
    popup.focus?.();
    return;
  }
  const opened = window.open(safeUrl, "_blank", "noopener,noreferrer");
  opened?.focus?.();
}

export function readBrowserWorkspaceClientRuntimeMode(): WorkspaceClientRuntimeMode {
  return detectBrowserRuntimeConnectionState(readStoredWebRuntimeGatewayProfile());
}

export function subscribeBrowserWorkspaceClientRuntimeMode(listener: () => void) {
  runtimeModeListeners.add(listener);
  if (runtimeModeStorageSubscriptions === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", handleRuntimeModeStorageChange);
  }
  runtimeModeStorageSubscriptions += 1;
  return () => {
    runtimeModeListeners.delete(listener);
    runtimeModeStorageSubscriptions = Math.max(0, runtimeModeStorageSubscriptions - 1);
    if (runtimeModeStorageSubscriptions === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleRuntimeModeStorageChange);
    }
  };
}

export async function invokeBrowserWorkspaceRuntime<
  M extends keyof CodeRuntimeRpcRequestPayloadByMethod &
    keyof CodeRuntimeRpcResponsePayloadByMethod,
>(method: M, params: CodeRuntimeRpcRequestPayloadByMethod[M]) {
  const profile = readActiveWebRuntimeGatewayProfile();
  if (!profile?.httpBaseUrl) {
    throw new Error("Web runtime gateway is unavailable.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (profile.authToken) {
    headers["x-code-runtime-auth-token"] = profile.authToken;
  }

  const response = await fetch(profile.httpBaseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`Web runtime gateway ${String(method)} failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as {
    ok?: boolean;
    result?: CodeRuntimeRpcResponsePayloadByMethod[M];
    error?: { message?: string };
  };
  if (!body.ok) {
    throw new Error(
      body.error?.message ?? `Web runtime gateway ${String(method)} rejected request.`
    );
  }
  return body.result as CodeRuntimeRpcResponsePayloadByMethod[M];
}

export async function probeBrowserWorkspaceRuntimeTarget(
  target: DiscoveredLocalRuntimeGatewayTarget,
  probeTimeoutMs: number
): Promise<boolean> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, probeTimeoutMs);

  try {
    const response = await fetch(target.httpBaseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        method: CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        params: {},
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverBrowserWorkspaceClientRuntimeGatewayTargets(): Promise<
  DiscoveredLocalRuntimeGatewayTarget[]
> {
  return discoverLocalRuntimeGatewayTargetsShared({
    probeTarget: probeBrowserWorkspaceRuntimeTarget,
  });
}

export function configureBrowserWorkspaceClientManualRuntimeGatewayTarget(
  target: ManualWebRuntimeGatewayTarget
) {
  const profile = buildManualWebRuntimeGatewayProfile(target);
  saveStoredWebRuntimeGatewayProfile(profile);
  emitRuntimeModeChange();
}

export function createBrowserWorkspaceClientRuntimeGatewayBindings(): WorkspaceClientRuntimeGatewayBindings {
  return {
    readRuntimeMode: readBrowserWorkspaceClientRuntimeMode,
    subscribeRuntimeMode: subscribeBrowserWorkspaceClientRuntimeMode,
    discoverLocalRuntimeGatewayTargets: discoverBrowserWorkspaceClientRuntimeGatewayTargets,
    configureManualWebRuntimeGatewayTarget:
      configureBrowserWorkspaceClientManualRuntimeGatewayTarget,
  };
}

export async function bootstrapBrowserWorkspaceClientKernelProjection(
  request?: KernelProjectionBootstrapRequest
): Promise<KernelProjectionBootstrapResponse> {
  return invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3, {
    scopes: request?.scopes ? [...new Set(request.scopes)] : undefined,
  });
}

export function subscribeBrowserWorkspaceClientKernelProjection(
  request: KernelProjectionSubscriptionRequest,
  listener: (delta: KernelProjectionDelta) => void
): () => void {
  const profile = readActiveWebRuntimeGatewayProfile();
  const websocketUrl = profile?.wsBaseUrl;
  if (!websocketUrl || typeof WebSocket !== "function") {
    return () => undefined;
  }

  let socket: WebSocket | null = new WebSocket(websocketUrl);
  let disposed = false;

  const teardownSocket = () => {
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {
      // Ignore close failures during teardown.
    }
    socket = null;
  };

  socket.onopen = () => {
    if (!socket || disposed) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: "kernel.projection.subscribe",
        id: `workspace-client-kernel-projection-${Date.now()}`,
        params: {
          scopes: [...new Set(request.scopes)],
          lastRevision: request.lastRevision ?? null,
          subscriberConfig: request.subscriberConfig ?? null,
        },
      })
    );
  };
  socket.onmessage = (event) => {
    if (typeof event.data !== "string") {
      return;
    }
    try {
      const delta = parseKernelProjectionDelta(JSON.parse(event.data) as unknown);
      if (delta) {
        listener(delta);
      }
    } catch {
      // Ignore malformed websocket payloads and keep the last known projection state.
    }
  };
  socket.onerror = () => {
    teardownSocket();
  };
  socket.onclose = () => {
    teardownSocket();
  };

  return () => {
    disposed = true;
    teardownSocket();
  };
}

export function createBrowserWorkspaceClientRuntimeBindings(): WorkspaceClientRuntimeBindings {
  return {
    surface: "shared-workspace-client",
    settings: {
      getAppSettings: async () =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET, {})) ?? {},
      updateAppSettings: async (settings) =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE, {
          payload: settings,
        })) ?? {},
      syncRuntimeGatewayProfileFromAppSettings: () => undefined,
    },
    oauth: {
      listAccounts: async (provider) =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST, {
          provider: provider ?? null,
        })) ?? [],
      listPools: async (provider) =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_POOLS_LIST, {
          provider: provider ?? null,
        })) ?? [],
      listPoolMembers: async (poolId) =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_LIST, {
          poolId,
        })) ?? [],
      getPrimaryAccount: async (provider) =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET, {
          provider,
        })) ?? null,
      setPrimaryAccount: async (input) =>
        await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET,
          input
        ),
      applyPool: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_APPLY, input),
      bindPoolAccount: async (input) =>
        await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_ACCOUNT_BIND,
          input
        ),
      runLogin: async () => ({
        authUrl: "",
        immediateSuccess: false,
      }),
      getAccountInfo: async () => null,
      getProvidersCatalog: async () =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.PROVIDERS_CATALOG, {})) ?? [],
    },
    models: {
      getModelList: async () =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.MODELS_POOL, {})) ?? [],
      getConfigModel: async () => null,
    },
    workspaceCatalog: {
      listWorkspaces: async () =>
        (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST, {})).map(
          (workspace) => ({
            id: workspace.id,
            name: workspace.displayName,
            connected: workspace.connected,
          })
        ),
    },
    missionControl: {
      readMissionControlSnapshot: async () => {
        try {
          const bootstrap = await bootstrapBrowserWorkspaceClientKernelProjection({
            scopes: ["mission_control"],
          });
          const missionControl = readMissionControlProjectionSlice(bootstrap);
          if (missionControl) {
            return missionControl;
          }
        } catch {
          // Fall through to snapshot v1 when projection bootstrap is unavailable.
        }
        return await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1,
          {}
        );
      },
      // Keep first-party UI summary generation on the snapshot-backed canonical continuation facade.
      // `mission_control_summary_v1` remains a compatibility RPC until external callers migrate.
      readMissionControlSummary: async (activeWorkspaceId) =>
        buildSharedMissionControlSummary(
          await (async () => {
            try {
              const bootstrap = await bootstrapBrowserWorkspaceClientKernelProjection({
                scopes: ["mission_control"],
              });
              const missionControl = readMissionControlProjectionSlice(bootstrap);
              if (missionControl) {
                return missionControl;
              }
            } catch {
              // Fall through to snapshot v1 when projection bootstrap is unavailable.
            }
            return await invokeBrowserWorkspaceRuntime(
              CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1,
              {}
            );
          })(),
          activeWorkspaceId
        ),
    },
    kernelProjection: {
      bootstrap: bootstrapBrowserWorkspaceClientKernelProjection,
      subscribe: subscribeBrowserWorkspaceClientKernelProjection,
    },
    agentControl: {
      prepareRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2, input),
      startRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_START_V2, input),
      cancelRuntimeJob: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3, input),
      resumeRuntimeJob: async (input) =>
        toRuntimeRunResumeAck(
          await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2, input)
        ),
      interveneRuntimeJob: async (input) =>
        toRuntimeRunInterventionAck(
          input,
          await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2, input)
        ),
      subscribeRuntimeJob: async (input) =>
        ((record) => (record ? toKernelJob(record) : null))(
          await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2, input)
        ),
      listRuntimeJobs: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.KERNEL_JOBS_LIST_V2, input),
      submitRuntimeJobApprovalDecision: async (input) =>
        await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL,
          input
        ),
    },
    threads: {
      listThreads: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.THREADS_LIST, input),
      createThread: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.THREAD_CREATE, input),
      resumeThread: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.THREAD_RESUME, input),
      archiveThread: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.THREAD_ARCHIVE, input),
    },
    git: {
      listChanges: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_CHANGES_LIST, input),
      readDiff: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_DIFF_READ, input),
      listBranches: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_BRANCHES_LIST, input),
      createBranch: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CREATE, input),
      checkoutBranch: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CHECKOUT, input),
      readLog: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_LOG, input),
      stageChange: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_STAGE_CHANGE, input),
      stageAll: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_STAGE_ALL, input),
      unstageChange: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_UNSTAGE_CHANGE, input),
      revertChange: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_REVERT_CHANGE, input),
      commit: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.GIT_COMMIT, input),
    },
    workspaceFiles: {
      listWorkspaceFileEntries: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST, input),
      readWorkspaceFile: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ, input),
    },
    review: {
      listReviewPacks: async () => {
        try {
          const bootstrap = await bootstrapBrowserWorkspaceClientKernelProjection({
            scopes: ["mission_control"],
          });
          const missionControl = readMissionControlProjectionSlice(bootstrap);
          if (missionControl) {
            return missionControl.reviewPacks;
          }
        } catch {
          // Fall through to snapshot v1 when projection bootstrap is unavailable.
        }
        return (
          await invokeBrowserWorkspaceRuntime(
            CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1,
            {}
          )
        ).reviewPacks;
      },
    },
  };
}

export function createBrowserWorkspaceClientHostBindings(): WorkspaceClientHostBindings {
  return {
    platform: "web",
    intents: {
      openOauthAuthorizationUrl: async (url, popup) => {
        openBrowserExternalUrl(url, popup);
      },
      createOauthPopupWindow: () => {
        if (typeof window === "undefined" || typeof window.open !== "function") {
          return null;
        }
        return window.open("about:blank", "_blank");
      },
      waitForOauthBinding: async () => false,
    },
    notifications: {
      testSound: () => undefined,
      testSystemNotification: () => undefined,
    },
    shell: {
      platformHint: "web",
    },
  };
}
