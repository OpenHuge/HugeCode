import type {
  OAuthAccountSummary,
  OAuthCodexLoginCancelResponse,
  OAuthCodexLoginStartResponse,
  OAuthProviderId,
  OAuthUsageRefreshMode,
} from "./runtimeClient";
import { createWebRuntimeOauthPersistenceUnavailableError } from "./tauriOauthBridgeWebRuntime";

type JsonRecord = Record<string, unknown>;

export type CodexLoginResult = {
  loginId: string;
  authUrl: string;
  raw?: unknown;
  immediateSuccess?: boolean;
};

export type CodexLoginOptions = {
  forceOAuth?: boolean;
};

type CancelCodexLoginResult = OAuthCodexLoginCancelResponse & { raw?: unknown };

type RuntimeClientCodexLoginBridge = {
  oauthCodexLoginStart(request: {
    workspaceId: string;
    forceOAuth?: boolean;
  }): Promise<OAuthCodexLoginStartResponse>;
  oauthCodexLoginCancel(request: { workspaceId: string }): Promise<OAuthCodexLoginCancelResponse>;
};

export type CodexLoginDeps = {
  webRuntimeRpcEndpointEnvKey: string;
  isTauri(): boolean;
  isRecord(value: unknown): value is JsonRecord;
  normalizeNullableText(value: unknown): string | null;
  listOAuthAccounts(
    provider: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode }
  ): Promise<OAuthAccountSummary[]>;
  pickPreferredOAuthAccount(
    accounts: OAuthAccountSummary[],
    provider?: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  accountHasRoutingCredential(account: OAuthAccountSummary): boolean;
  createMockOauthEntityId(prefix: string): string;
  resolveWebRuntimeControlEndpoint(path: string): string | null;
  runWebRuntimeOAuthRequest<Result>(key: string, request: () => Promise<Result>): Promise<Result>;
  awaitWebRuntimeWithFallbackTimeout<Result>(
    request: (signal: AbortSignal | undefined) => Promise<Result>,
    label: string
  ): Promise<Result>;
  verifyWorkspaceBinding(workspaceId: string): Promise<boolean>;
  clearWebRuntimeOauthCooldown(): void;
  markWebRuntimeOauthCooldown(error: unknown, label: string): void;
  getRuntimeClient(): RuntimeClientCodexLoginBridge;
};

const WEB_RUNTIME_CODEX_OAUTH_START_PATH = "/oauth/codex/start";
const WEB_RUNTIME_CODEX_OAUTH_CANCEL_PATH = "/oauth/codex/cancel";

function readResponseErrorMessage(
  deps: Pick<CodexLoginDeps, "isRecord" | "normalizeNullableText">,
  payload: unknown
): string | null {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!deps.isRecord(payload)) {
    return null;
  }
  const directMessage = deps.normalizeNullableText(payload.message);
  if (directMessage) {
    return directMessage;
  }
  const errorRecord = deps.isRecord(payload.error) ? payload.error : null;
  return deps.normalizeNullableText(errorRecord?.message);
}

async function readResponsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      const trimmed = text.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }
}

function normalizeCodexAuthUrl(rawAuthUrl: string): string {
  const trimmed = rawAuthUrl.trim();
  if (!trimmed) {
    return trimmed;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (
    parsed.hostname !== "auth.openai.com" ||
    (parsed.pathname !== "/oauth/authorize" && parsed.pathname !== "/api/oauth/oauth2/auth")
  ) {
    return parsed.toString();
  }
  if (parsed.pathname === "/api/oauth/oauth2/auth") {
    parsed.pathname = "/oauth/authorize";
  }
  return parsed.toString();
}

async function startCodexWebRuntimeOauth(
  deps: Pick<
    CodexLoginDeps,
    | "isRecord"
    | "normalizeNullableText"
    | "resolveWebRuntimeControlEndpoint"
    | "webRuntimeRpcEndpointEnvKey"
  >,
  workspaceId: string,
  signal?: AbortSignal
): Promise<CodexLoginResult> {
  const endpoint = deps.resolveWebRuntimeControlEndpoint(WEB_RUNTIME_CODEX_OAUTH_START_PATH);
  if (!endpoint) {
    throw new Error(
      `Missing runtime endpoint configuration for web OAuth. Set ${deps.webRuntimeRpcEndpointEnvKey}.`
    );
  }
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is unavailable in this runtime; cannot start web OAuth.");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ workspaceId }),
    signal,
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(
      readResponseErrorMessage(deps, payload) ??
        `Codex OAuth start request failed with status ${response.status}.`
    );
  }
  if (!deps.isRecord(payload)) {
    throw new Error("Codex OAuth start response is invalid.");
  }
  const loginId = deps.normalizeNullableText(payload.loginId ?? payload.login_id);
  const rawAuthUrl = deps.normalizeNullableText(payload.authUrl ?? payload.auth_url);
  const authUrl = rawAuthUrl ? normalizeCodexAuthUrl(rawAuthUrl) : null;
  if (!loginId || !authUrl) {
    throw new Error("Codex OAuth start response missing loginId or authUrl.");
  }
  return {
    loginId,
    authUrl,
    raw: payload,
  };
}

async function cancelCodexWebRuntimeOauth(
  deps: Pick<
    CodexLoginDeps,
    "isRecord" | "normalizeNullableText" | "resolveWebRuntimeControlEndpoint"
  >,
  workspaceId: string,
  signal?: AbortSignal
): Promise<CancelCodexLoginResult> {
  const endpoint = deps.resolveWebRuntimeControlEndpoint(WEB_RUNTIME_CODEX_OAUTH_CANCEL_PATH);
  if (!endpoint || typeof fetch !== "function") {
    throw createWebRuntimeOauthPersistenceUnavailableError("codex oauth cancel");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ workspaceId }),
    signal,
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw createWebRuntimeOauthPersistenceUnavailableError("codex oauth cancel", payload);
  }
  if (!deps.isRecord(payload)) {
    throw createWebRuntimeOauthPersistenceUnavailableError("codex oauth cancel");
  }
  const status = deps.normalizeNullableText(payload.status);
  return {
    canceled: payload.canceled !== false,
    status: status ?? "canceled",
    raw: payload,
  };
}

export async function runCodexLoginWithDeps(
  deps: CodexLoginDeps,
  workspaceId: string,
  options: CodexLoginOptions = {}
): Promise<CodexLoginResult> {
  if (!deps.isTauri()) {
    const codexAccounts = await deps.listOAuthAccounts("codex");
    const usableExisting = deps.pickPreferredOAuthAccount(
      codexAccounts.filter(
        (account) => account.status === "enabled" && deps.accountHasRoutingCredential(account)
      ),
      "codex"
    );
    const durableWorkspaceBindingVerified =
      usableExisting && options.forceOAuth !== true
        ? await deps.verifyWorkspaceBinding(workspaceId).catch(() => false)
        : false;
    if (usableExisting && durableWorkspaceBindingVerified && options.forceOAuth !== true) {
      return {
        loginId: deps.createMockOauthEntityId("codex-login"),
        authUrl: "",
        immediateSuccess: true,
        raw: {
          mode: "runtime-gateway-web",
          source: "existing-account",
          durableWorkspaceBindingVerified: true,
        },
      };
    }
    try {
      const started = await deps.runWebRuntimeOAuthRequest(`codex_login_start:${workspaceId}`, () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) => startCodexWebRuntimeOauth(deps, workspaceId, signal),
          "codex oauth"
        )
      );
      deps.clearWebRuntimeOauthCooldown();
      return started;
    } catch (error) {
      deps.markWebRuntimeOauthCooldown(error, "codex oauth start");
      throw error;
    }
  }
  const started = await deps.getRuntimeClient().oauthCodexLoginStart({
    workspaceId,
    forceOAuth: options.forceOAuth === true,
  });
  return {
    ...started,
    authUrl: started.authUrl ? normalizeCodexAuthUrl(started.authUrl) : started.authUrl,
  };
}

export async function cancelCodexLoginWithDeps(
  deps: CodexLoginDeps,
  workspaceId: string
): Promise<CancelCodexLoginResult> {
  if (!deps.isTauri()) {
    try {
      const canceled = await deps.runWebRuntimeOAuthRequest(
        `codex_login_cancel:${workspaceId}`,
        () =>
          deps.awaitWebRuntimeWithFallbackTimeout(
            (signal) => cancelCodexWebRuntimeOauth(deps, workspaceId, signal),
            "codex oauth cancel"
          )
      );
      deps.clearWebRuntimeOauthCooldown();
      return canceled;
    } catch (error) {
      deps.markWebRuntimeOauthCooldown(error, "codex oauth cancel");
      throw createWebRuntimeOauthPersistenceUnavailableError("codex oauth cancel", error);
    }
  }
  return deps.getRuntimeClient().oauthCodexLoginCancel({
    workspaceId,
  });
}
