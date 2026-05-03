import type {
  AgentTaskStartRequest,
  ModelPoolEntry,
  RuntimeBackendSummary,
  TurnInterruptRequest,
} from "@ku0/code-runtime-host-contract";
import type {
  HugeRouterCommercialServiceSnapshot,
  HugeRouterRouteTokenIssueRequest,
  HugeRouterRouteTokenIssueResponse,
} from "@ku0/code-runtime-host-contract/codeRuntimeRpc";
import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
} from "@ku0/code-runtime-host-contract";
import type { HugeCodeRuntimeBridge } from "@ku0/code-t3-runtime-adapter";

type RuntimeBridgeGlobal = Partial<HugeCodeRuntimeBridge>;
type RuntimeRpcInvoker = <Result>(
  method: string,
  params: Record<string, unknown>
) => Promise<Result>;
type DesktopHostBridgeGlobal = {
  core?: {
    invoke?<Result>(command: string, payload?: Record<string, unknown>): Promise<Result>;
  };
};
type RuntimeRpcEnvelope<Result> =
  | {
      ok: true;
      result: Result;
    }
  | {
      error?: {
        message?: string;
      };
      ok: false;
    };

declare global {
  interface Window {
    __HUGECODE_T3_RUNTIME__?: RuntimeBridgeGlobal;
    hugeCodeDesktopHost?: DesktopHostBridgeGlobal;
  }
}

function compatibilityBackend(
  backendId: string,
  displayName: string,
  capability: string,
  summary: string,
  connected: boolean
): RuntimeBackendSummary {
  return {
    backendId,
    displayName,
    capabilities: [capability, "code"],
    maxConcurrency: 1,
    costTier: "local",
    latencyClass: "local",
    rolloutState: "current",
    status: connected ? "active" : "disabled",
    healthy: connected,
    healthScore: connected ? 0.7 : 0,
    failures: 0,
    queueDepth: 0,
    runningTasks: 0,
    createdAt: 0,
    updatedAt: 0,
    lastHeartbeatAt: 0,
    backendKind: "native",
    origin: "runtime-native",
    readiness: {
      state: connected ? "attention" : "blocked",
      summary,
      reasons: [connected ? "dev_compatibility_bridge" : "runtime_bridge_unavailable"],
      authState: "unknown",
    },
    operability: {
      state: connected ? "attention" : "blocked",
      placementEligible: connected,
      summary,
      reasons: [connected ? "dev_compatibility_bridge" : "runtime_bridge_unavailable"],
    },
  };
}

function fallbackBackends(connected: boolean) {
  const summary = connected
    ? "Standalone Vite compatibility bridge is active for UI testing. The desktop shell provides real execution."
    : "HugeCode runtime bridge is not connected yet. Start through the desktop shell or runtime gateway.";
  return [
    compatibilityBackend("local-codex-cli", "Local Codex CLI", "codex", summary, connected),
    compatibilityBackend(
      "local-claude-code-cli",
      "Local Claude Code CLI",
      "claude",
      summary,
      connected
    ),
  ];
}

function fallbackModels(): ModelPoolEntry[] {
  return [
    {
      id: "gpt-5.4",
      displayName: "GPT-5.4",
      provider: "openai",
      pool: "codex",
      source: "fallback",
      available: true,
      supportsReasoning: true,
      supportsVision: true,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning", "vision"],
    },
    {
      id: "gpt-5.3-codex",
      displayName: "GPT-5.3 Codex",
      provider: "openai",
      pool: "codex",
      source: "fallback",
      available: true,
      supportsReasoning: true,
      supportsVision: true,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning", "vision"],
    },
    {
      id: "claude-sonnet-4.5",
      displayName: "Claude Sonnet 4.5",
      provider: "anthropic",
      pool: "claude",
      source: "fallback",
      available: true,
      supportsReasoning: true,
      supportsVision: false,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning"],
    },
    {
      id: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      provider: "anthropic",
      pool: "claude",
      source: "fallback",
      available: true,
      supportsReasoning: true,
      supportsVision: false,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning"],
    },
  ];
}

function buildTurnSendPayload(request: AgentTaskStartRequest): Record<string, unknown> {
  const prompt =
    request.steps.find((step) => typeof step.input === "string" && step.input.trim().length > 0)
      ?.input ??
    request.title ??
    "";
  const requestId = request.requestId ?? `t3-turn-${Date.now()}`;
  const threadId = request.threadId ?? `t3-${requestId}`;
  return {
    payload: {
      workspaceId: request.workspaceId,
      threadId,
      requestId,
      content: prompt,
      contextPrefix: null,
      provider: request.provider ?? null,
      modelId: request.modelId ?? null,
      reasonEffort: request.reasonEffort ?? null,
      serviceTier: null,
      missionMode: null,
      executionProfileId: request.executionProfileId ?? "runtime-default",
      preferredBackendIds: request.preferredBackendIds ?? null,
      accessMode: request.accessMode ?? "read-only",
      executionMode: "local-cli",
      codexBin: null,
      codexArgs: null,
      queue: false,
      attachments: [],
      collaborationMode: "chat",
    },
  };
}

function buildTurnInterruptPayload(request: TurnInterruptRequest): Record<string, unknown> {
  return {
    ...request,
    turnId: request.turnId ?? null,
    reason: request.reason ?? null,
  };
}

export function createHugeCodeT3RuntimeBridgeFromInvoker(
  invoke: RuntimeRpcInvoker
): HugeCodeRuntimeBridge {
  return {
    listBackends() {
      return invoke<RuntimeBackendSummary[]>(
        CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    listModels() {
      return invoke<ModelPoolEntry[]>(
        CODE_RUNTIME_RPC_METHODS.MODELS_POOL,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    readHugeRouterCommercialService() {
      return invoke<HugeRouterCommercialServiceSnapshot | null>(
        CODE_RUNTIME_RPC_METHODS.HUGEROUTER_COMMERCIAL_SERVICE_READ,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    issueHugeRouterRouteToken(request: HugeRouterRouteTokenIssueRequest = {}) {
      return invoke<HugeRouterRouteTokenIssueResponse>(
        CODE_RUNTIME_RPC_METHODS.HUGEROUTER_ROUTE_TOKEN_ISSUE,
        request as Record<string, unknown>
      );
    },
    startAgentTask(request: AgentTaskStartRequest) {
      return invoke(CODE_RUNTIME_RPC_METHODS.TURN_SEND, buildTurnSendPayload(request));
    },
    interruptTurn(turnId: string | null, reason?: string | null) {
      const request: TurnInterruptRequest = {
        turnId,
        reason: reason ?? null,
      };
      return invoke<boolean>(CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT, {
        payload: buildTurnInterruptPayload(request),
      });
    },
    approveRequest(requestId: string, approved: boolean) {
      return invoke(CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2, {
        requestId,
        kind: null,
        status: approved ? "approved" : "rejected",
        reason: null,
      });
    },
  };
}

function createDesktopRuntimeInvoker(desktopHost: DesktopHostBridgeGlobal): RuntimeRpcInvoker {
  const invoke = desktopHost.core?.invoke;
  if (!invoke) {
    throw new Error("HugeCode desktop host invoke bridge is unavailable.");
  }
  return (method, params) => invoke(method, params);
}

function createDesktopRuntimeBridge(desktopHost: DesktopHostBridgeGlobal): HugeCodeRuntimeBridge {
  return createHugeCodeT3RuntimeBridgeFromInvoker(createDesktopRuntimeInvoker(desktopHost));
}

function createRuntimeGatewayInvoker(endpoint: string): RuntimeRpcInvoker {
  return (method, params) => invokeRuntimeGateway(endpoint, method, params);
}

export function createHugeCodeT3RuntimeBridgeFromGatewayEndpoint(
  endpoint: string
): HugeCodeRuntimeBridge {
  return createHugeCodeT3RuntimeBridgeFromInvoker(createRuntimeGatewayInvoker(endpoint));
}

type RuntimeBridgeAttempt<Result> = {
  run: () => Promise<Result>;
  shouldContinue?: (error: unknown) => boolean;
};

async function firstRuntimeBridgeResult<Result>(
  attempts: readonly RuntimeBridgeAttempt<Result>[],
  fallback: () => Promise<Result> | Result
): Promise<Result> {
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (error) {
      if (!attempt.shouldContinue?.(error)) {
        throw error;
      }
    }
  }
  return fallback();
}

function shouldContinueFromDesktopToGateway(
  runtimeGatewayBridge: HugeCodeRuntimeBridge | null,
  error: unknown
) {
  return Boolean(runtimeGatewayBridge) && isMissingDesktopRuntimeHandler(error);
}

function shouldContinueFromGatewayToDevFallback(error: unknown) {
  if (!import.meta.env.DEV) {
    return false;
  }
  return error instanceof Error;
}

function buildDevRouteTokenResponse(
  request: HugeRouterRouteTokenIssueRequest = {}
): HugeRouterRouteTokenIssueResponse {
  const now = Date.now();
  const envKey = request.envKey?.trim() || "HUGEROUTER_ROUTE_TOKEN";
  return {
    summary: {
      envKey,
      expiresAt: null,
      lastFour: "t3v1",
      lastIssuedAt: now,
      scopes: request.scopes ?? [
        "route:codex",
        "route:claude",
        "provider:any-relay",
        "provider:hugerouter-commercial",
      ],
      status: "active",
      tokenId: `dev-route-token-${now}`,
    },
    token: "dev_hugerouter_route_token_redacted",
  };
}

async function invokeRuntimeGateway<Result>(
  endpoint: string,
  method: string,
  params: Record<string, unknown>
): Promise<Result> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ method, params }),
  });
  if (!response.ok) {
    throw new Error(`Runtime gateway ${method} failed with HTTP ${response.status}.`);
  }
  const envelope = (await response.json()) as RuntimeRpcEnvelope<Result>;
  if (!envelope.ok) {
    throw new Error(envelope.error?.message ?? `Runtime gateway ${method} rejected request.`);
  }
  return envelope.result;
}

function resolveRuntimeGatewayEndpoint() {
  const configuredEndpoint = import.meta.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }
  return import.meta.env.DEV ? "http://127.0.0.1:8788/rpc" : null;
}

function createRuntimeGatewayBridge(endpoint: string): HugeCodeRuntimeBridge {
  return createHugeCodeT3RuntimeBridgeFromGatewayEndpoint(endpoint);
}

function isMissingDesktopRuntimeHandler(error: unknown) {
  return error instanceof Error && error.message.includes("No handler registered");
}

export function createHugeCodeT3RuntimeBridge(): HugeCodeRuntimeBridge {
  const runtimeBridge = window.__HUGECODE_T3_RUNTIME__;
  const desktopHostBridge = window.hugeCodeDesktopHost;
  const desktopRuntimeBridge = desktopHostBridge?.core?.invoke
    ? createDesktopRuntimeBridge(desktopHostBridge)
    : null;
  const runtimeGatewayEndpoint = resolveRuntimeGatewayEndpoint();
  const runtimeGatewayBridge = runtimeGatewayEndpoint
    ? createRuntimeGatewayBridge(runtimeGatewayEndpoint)
    : null;
  const devCompatibilityMode =
    import.meta.env.DEV && !runtimeBridge && !desktopRuntimeBridge && !runtimeGatewayBridge;
  return {
    async listBackends() {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.listBackends ? [{ run: () => runtimeBridge.listBackends!() }] : []),
          ...(desktopRuntimeBridge
            ? [
                {
                  run: () => desktopRuntimeBridge.listBackends(),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge
            ? [
                {
                  run: () => runtimeGatewayBridge.listBackends(),
                  shouldContinue: shouldContinueFromGatewayToDevFallback,
                },
              ]
            : []),
        ],
        () => fallbackBackends(devCompatibilityMode)
      );
    },
    async listModels() {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.listModels ? [{ run: () => runtimeBridge.listModels!() }] : []),
          ...(desktopRuntimeBridge
            ? [
                {
                  run: () => desktopRuntimeBridge.listModels(),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge
            ? [
                {
                  run: () => runtimeGatewayBridge.listModels(),
                  shouldContinue: shouldContinueFromGatewayToDevFallback,
                },
              ]
            : []),
        ],
        () => fallbackModels()
      );
    },
    async readHugeRouterCommercialService() {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.readHugeRouterCommercialService
            ? [{ run: () => runtimeBridge.readHugeRouterCommercialService!() }]
            : []),
          ...(desktopRuntimeBridge?.readHugeRouterCommercialService
            ? [
                {
                  run: () => desktopRuntimeBridge.readHugeRouterCommercialService!(),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge?.readHugeRouterCommercialService
            ? [
                {
                  run: () => runtimeGatewayBridge.readHugeRouterCommercialService!(),
                  shouldContinue: shouldContinueFromGatewayToDevFallback,
                },
              ]
            : []),
        ],
        () => null
      );
    },
    async issueHugeRouterRouteToken(request: HugeRouterRouteTokenIssueRequest = {}) {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.issueHugeRouterRouteToken
            ? [{ run: () => runtimeBridge.issueHugeRouterRouteToken!(request) }]
            : []),
          ...(desktopRuntimeBridge?.issueHugeRouterRouteToken
            ? [
                {
                  run: () => desktopRuntimeBridge.issueHugeRouterRouteToken!(request),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge?.issueHugeRouterRouteToken
            ? [
                {
                  run: () => runtimeGatewayBridge.issueHugeRouterRouteToken!(request),
                  shouldContinue: shouldContinueFromGatewayToDevFallback,
                },
              ]
            : []),
        ],
        () => {
          if (devCompatibilityMode || import.meta.env.DEV) {
            return buildDevRouteTokenResponse(request);
          }
          throw new Error("HugeRouter route token service is not connected.");
        }
      );
    },
    async startAgentTask(request: AgentTaskStartRequest) {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.startAgentTask
            ? [{ run: () => runtimeBridge.startAgentTask!(request) }]
            : []),
          ...(desktopRuntimeBridge
            ? [
                {
                  run: () => desktopRuntimeBridge.startAgentTask(request),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge
            ? [{ run: () => runtimeGatewayBridge.startAgentTask(request) }]
            : []),
        ],
        () => {
          if (devCompatibilityMode) {
            return {
              accepted: true,
              compatibilityMode: true,
              message: "Started through the standalone Vite compatibility bridge.",
              request,
              taskId: `dev-compat-${Date.now()}`,
            };
          }
          throw new Error(
            `HugeCode runtime bridge is not connected. Cannot launch ${request.title ?? "task"}.`
          );
        }
      );
    },
    async interruptTurn(turnId: string | null, reason?: string | null) {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.interruptTurn
            ? [{ run: () => runtimeBridge.interruptTurn!(turnId, reason) }]
            : []),
          ...(desktopRuntimeBridge
            ? [
                {
                  run: () => desktopRuntimeBridge.interruptTurn(turnId, reason),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge
            ? [{ run: () => runtimeGatewayBridge.interruptTurn(turnId, reason) }]
            : []),
        ],
        () => {
          if (devCompatibilityMode) {
            return { accepted: true, compatibilityMode: true, reason, turnId };
          }
          throw new Error("HugeCode runtime bridge is not connected. Cannot interrupt the task.");
        }
      );
    },
    async approveRequest(requestId: string, approved: boolean) {
      return firstRuntimeBridgeResult(
        [
          ...(runtimeBridge?.approveRequest
            ? [{ run: () => runtimeBridge.approveRequest!(requestId, approved) }]
            : []),
          ...(desktopRuntimeBridge
            ? [
                {
                  run: () => desktopRuntimeBridge.approveRequest(requestId, approved),
                  shouldContinue: (error: unknown) =>
                    shouldContinueFromDesktopToGateway(runtimeGatewayBridge, error),
                },
              ]
            : []),
          ...(runtimeGatewayBridge
            ? [{ run: () => runtimeGatewayBridge.approveRequest(requestId, approved) }]
            : []),
        ],
        () => {
          if (devCompatibilityMode) {
            return { accepted: true, approved, compatibilityMode: true, requestId };
          }
          throw new Error(
            `HugeCode runtime bridge is not connected. Cannot ${approved ? "approve" : "reject"} ${requestId}.`
          );
        }
      );
    },
  };
}
