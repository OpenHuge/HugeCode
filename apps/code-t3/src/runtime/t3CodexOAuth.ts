import {
  CODE_RUNTIME_RPC_METHODS,
  type OAuthCodexAuthJsonImportResponse,
  type OAuthCodexLoginCancelResponse,
  type OAuthCodexLoginStartResponse,
} from "@ku0/code-runtime-host-contract";

export type T3CodexOAuthOpenMode = "local_default_browser" | "browser_window";

export type T3CodexOAuthLoginOpenResult = {
  login: OAuthCodexLoginStartResponse;
  openMode: T3CodexOAuthOpenMode | null;
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

function normalizeOAuthAuthorizationUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveT3RuntimeGatewayEndpoint() {
  const configuredEndpoint = import.meta.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }
  return import.meta.env.DEV ? "http://127.0.0.1:8788/rpc" : null;
}

async function invokeT3RuntimeGateway<Result>(
  method: string,
  params: Record<string, unknown>
): Promise<Result> {
  const endpoint = resolveT3RuntimeGatewayEndpoint();
  if (!endpoint) {
    throw new Error("Runtime gateway is unavailable for Codex OAuth.");
  }

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

export function startT3CodexOAuthLogin(workspaceId: string) {
  return invokeT3RuntimeGateway<OAuthCodexLoginStartResponse>(
    CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START,
    {
      workspaceId,
      forceOAuth: true,
    }
  );
}

async function openT3UrlInLocalDefaultBrowser(url: string): Promise<boolean> {
  const safeUrl = normalizeOAuthAuthorizationUrl(url);
  if (!safeUrl) {
    return false;
  }
  const openExternalUrl =
    typeof window === "undefined" ? null : window.hugeCodeDesktopHost?.shell?.openExternalUrl;
  if (!openExternalUrl) {
    return false;
  }
  const result = await openExternalUrl(safeUrl);
  return result !== false;
}

function openT3UrlInBrowserWindow(url: string): boolean {
  const safeUrl = normalizeOAuthAuthorizationUrl(url);
  if (!safeUrl || typeof window === "undefined" || typeof window.open !== "function") {
    return false;
  }
  const opened = window.open(safeUrl, "_blank", "noopener,noreferrer");
  opened?.focus?.();
  return Boolean(opened);
}

export async function startT3CodexOAuthLoginInLocalDefaultBrowser(
  workspaceId: string
): Promise<T3CodexOAuthLoginOpenResult> {
  const login = await startT3CodexOAuthLogin(workspaceId);
  if (login.immediateSuccess || !login.authUrl.trim()) {
    return {
      login,
      openMode: null,
    };
  }

  if (await openT3UrlInLocalDefaultBrowser(login.authUrl)) {
    return {
      login,
      openMode: "local_default_browser",
    };
  }

  if (openT3UrlInBrowserWindow(login.authUrl)) {
    return {
      login,
      openMode: "browser_window",
    };
  }

  return {
    login,
    openMode: null,
  };
}

export function cancelT3CodexOAuthLogin(workspaceId: string) {
  return invokeT3RuntimeGateway<OAuthCodexLoginCancelResponse>(
    CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL,
    {
      workspaceId,
    }
  );
}

export function importT3CodexAuthJson(authJson: string, sourceLabel?: string | null) {
  return invokeT3RuntimeGateway<OAuthCodexAuthJsonImportResponse>(
    CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_AUTH_JSON_IMPORT,
    {
      authJson,
      sourceLabel: sourceLabel ?? null,
    }
  );
}
