import {
  CODE_RUNTIME_RPC_METHODS,
  type OAuthAccountSummary,
  type CodeRuntimeRpcRequestPayloadByMethod,
  type CodeRuntimeRpcResponsePayloadByMethod,
  type KernelProjectionBootstrapRequest,
  type KernelProjectionBootstrapResponse,
  type KernelProjectionDelta,
  type KernelProjectionScope,
  type KernelProjectionSubscriptionRequest,
  type RuntimeCompositionProfile,
  type RuntimeCompositionProfileSummaryV2,
  type RuntimeCompositionResolveV2Response,
  type RuntimeCompositionSnapshotPublishResponse,
} from "@ku0/code-runtime-host-contract";
import {
  readRuntimeCompositionSettingsForWorkspace,
  writeRuntimeCompositionSettingsForWorkspace,
  type RuntimeCompositionSettingsEntry,
} from "@ku0/code-platform-interfaces";
import { invokeWebRuntimeRawAttempt } from "@ku0/code-runtime-client/runtimeClientWebHttpTransport";
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
import { createWorkspaceClientRuntimeMissionControlSurfaceBindings } from "./missionControlBindings";

type UnknownRecord = Record<string, unknown>;

const runtimeModeListeners = new Set<() => void>();
let runtimeModeStorageSubscriptions = 0;
const OAUTH_BINDING_POLL_INTERVAL_MS = 1_000;
const OAUTH_BINDING_TIMEOUT_MS = 120_000;

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

function readOAuthAccountTimestamp(account: OAuthAccountSummary): number {
  return Math.max(account.updatedAt ?? 0, account.createdAt ?? 0);
}

function hasCodexOauthBindingAfter(
  accounts: readonly OAuthAccountSummary[],
  baselineUpdatedAt: number
): boolean {
  return accounts.some(
    (account) =>
      account.provider === "codex" && readOAuthAccountTimestamp(account) > baselineUpdatedAt
  );
}

async function waitForBrowserCodexOauthBinding(
  workspaceId: string,
  baselineUpdatedAt: number
): Promise<boolean> {
  const deadline = Date.now() + OAUTH_BINDING_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    const accounts =
      (await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST, {
        provider: "codex",
      })) ?? [];
    if (hasCodexOauthBindingAfter(accounts, baselineUpdatedAt)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, OAUTH_BINDING_POLL_INTERVAL_MS));
  }

  await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL, {
    workspaceId,
  }).catch(() => undefined);
  return false;
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
  return invokeWebRuntimeRawAttempt<CodeRuntimeRpcResponsePayloadByMethod[M]>(
    profile.httpBaseUrl,
    String(method),
    params,
    undefined,
    {
      authToken: profile.authToken,
    }
  );
}

export async function probeBrowserWorkspaceRuntimeTarget(
  target: DiscoveredLocalRuntimeGatewayTarget,
  probeTimeoutMs: number
): Promise<boolean> {
  try {
    await invokeWebRuntimeRawAttempt(
      target.httpBaseUrl,
      CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
      {},
      probeTimeoutMs
    );
    return true;
  } catch {
    return false;
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

async function readBrowserWorkspaceClientAppSettingsRecord() {
  return ((await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET, {})) ??
    {}) as Record<string, unknown>;
}

async function updateBrowserWorkspaceClientAppSettingsRecord(settings: Record<string, unknown>) {
  return ((await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE, {
    payload: settings,
  })) ?? settings) as Record<string, unknown>;
}

async function readBrowserWorkspaceClientCompositionSettings(workspaceId: string) {
  const appSettings = await readBrowserWorkspaceClientAppSettingsRecord();
  return readRuntimeCompositionSettingsForWorkspace(appSettings, workspaceId);
}

async function updateBrowserWorkspaceClientCompositionSettings(
  workspaceId: string,
  settings: RuntimeCompositionSettingsEntry
) {
  const appSettings = await readBrowserWorkspaceClientAppSettingsRecord();
  const updated = writeRuntimeCompositionSettingsForWorkspace(appSettings, workspaceId, settings);
  const saved = await updateBrowserWorkspaceClientAppSettingsRecord(updated);
  return readRuntimeCompositionSettingsForWorkspace(saved, workspaceId);
}

export function createBrowserWorkspaceClientRuntimeBindings(): WorkspaceClientRuntimeBindings {
  const missionControlSurface = createWorkspaceClientRuntimeMissionControlSurfaceBindings({
    bootstrapKernelProjection: bootstrapBrowserWorkspaceClientKernelProjection,
    readMissionControlSnapshot: async () =>
      await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1, {}),
  });

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
      importCodexAuthJson: async (input) =>
        await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_AUTH_JSON_IMPORT,
          input
        ),
      runLogin: async (workspaceId, options) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START, {
          workspaceId,
          forceOAuth: options.forceOAuth,
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
          (
            workspace: CodeRuntimeRpcResponsePayloadByMethod[typeof CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST][number]
          ) => ({
            id: workspace.id,
            name: workspace.displayName,
            connected: workspace.connected,
          })
        ),
    },
    missionControl: missionControlSurface.missionControl,
    kernelProjection: {
      bootstrap: bootstrapBrowserWorkspaceClientKernelProjection,
      subscribe: subscribeBrowserWorkspaceClientKernelProjection,
    },
    agentControl: {
      prepareRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2, input),
      startRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_START_V2, input),
      cancelRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2, input),
      resumeRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2, input),
      interveneRuntimeRun: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2, input),
      submitRuntimeJobApprovalDecision: async (input) =>
        await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL,
          input
        ),
    },
    subAgents: {
      spawn: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN, input),
      send: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SEND, input),
      wait: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT, input),
      status: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS, input),
      interrupt: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT, input),
      close: async (input) =>
        await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE, input),
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
    review: missionControlSurface.review,
    composition: {
      listProfilesV2: async (workspaceId) =>
        ((await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_LIST_V2,
          {
            workspaceId,
          }
        )) ?? []) as RuntimeCompositionProfileSummaryV2[],
      getProfileV2: async (workspaceId, profileId) =>
        ((await invokeBrowserWorkspaceRuntime(CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_GET_V2, {
          workspaceId,
          profileId,
        })) ?? null) as RuntimeCompositionProfile | null,
      resolveV2: async (input) =>
        (await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_RESOLVE_V2,
          input
        )) as RuntimeCompositionResolveV2Response,
      publishSnapshotV1: async (input) =>
        (await invokeBrowserWorkspaceRuntime(
          CODE_RUNTIME_RPC_METHODS.COMPOSITION_SNAPSHOT_PUBLISH_V1,
          input
        )) as RuntimeCompositionSnapshotPublishResponse,
      getSettings: readBrowserWorkspaceClientCompositionSettings,
      updateSettings: updateBrowserWorkspaceClientCompositionSettings,
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
      waitForOauthBinding: waitForBrowserCodexOauthBinding,
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
