import { getConfiguredWebRuntimeGatewayProfile } from "./runtimeWebGatewayConfig";

export const WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY = "VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT";
export const WEB_RUNTIME_GATEWAY_EVENTS_ENDPOINT_ENV_KEY =
  "VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT";
export const WEB_RUNTIME_GATEWAY_WS_ENDPOINT_ENV_KEY = "VITE_CODE_RUNTIME_GATEWAY_WEB_WS_ENDPOINT";
export const WEB_RUNTIME_GATEWAY_AUTH_TOKEN_ENV_KEY = "VITE_CODE_RUNTIME_GATEWAY_WEB_AUTH_TOKEN";

export const WEB_RUNTIME_AUTH_TOKEN_HEADER = "x-code-runtime-auth-token";

export function resolveRuntimeEnvString(name: string): string | null {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const nodeLikeGlobal = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const raw = env?.[name] ?? nodeLikeGlobal.process?.env?.[name];

  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export function resolveWebRuntimeEndpoint(): string | null {
  return (
    getConfiguredWebRuntimeGatewayProfile()?.httpBaseUrl ??
    resolveRuntimeEnvString(WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY)
  );
}

export function resolveWebRuntimeEventsEndpointFromEnv(): string | null {
  return resolveRuntimeEnvString(WEB_RUNTIME_GATEWAY_EVENTS_ENDPOINT_ENV_KEY);
}

export function resolveWebRuntimeWsEndpointFromEnv(): string | null {
  return (
    getConfiguredWebRuntimeGatewayProfile()?.wsBaseUrl ??
    resolveRuntimeEnvString(WEB_RUNTIME_GATEWAY_WS_ENDPOINT_ENV_KEY)
  );
}

function resolveWebRuntimeAuthTokenFromEnv(): string | null {
  return resolveRuntimeEnvString(WEB_RUNTIME_GATEWAY_AUTH_TOKEN_ENV_KEY);
}

function readRuntimeAuthTokenFromEndpoint(endpoint: string | null): string | null {
  if (!endpoint) {
    return null;
  }
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return null;
  }
  if (/^wss?:\/\//i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const token = parsed.searchParams.get("token")?.trim();
      return token && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  }

  const hashIndex = trimmed.indexOf("#");
  const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex < 0) {
    return null;
  }
  const params = new URLSearchParams(withoutHash.slice(queryIndex + 1));
  const token = params.get("token")?.trim();
  return token && token.length > 0 ? token : null;
}

export function resolveWebRuntimeAuthToken(rpcEndpoint: string | null): string | null {
  return (
    resolveWebRuntimeAuthTokenFromEnv() ??
    getConfiguredWebRuntimeGatewayProfile()?.authToken ??
    readRuntimeAuthTokenFromEndpoint(rpcEndpoint)
  );
}

export function appendRuntimeAuthTokenQuery(endpoint: string, authToken: string | null): string {
  if (!authToken) {
    return endpoint;
  }
  if (/^wss?:\/\//i.test(endpoint) || /^https?:\/\//i.test(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      const existing = parsed.searchParams.get("token")?.trim();
      if (existing && existing.length > 0) {
        return parsed.toString();
      }
      parsed.searchParams.set("token", authToken);
      return parsed.toString();
    } catch {
      void 0;
    }
  }

  const hashIndex = endpoint.indexOf("#");
  const hash = hashIndex >= 0 ? endpoint.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? endpoint.slice(0, hashIndex) : endpoint;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  const existing = params.get("token")?.trim();
  if (!existing) {
    params.set("token", authToken);
  }
  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;
}

export function stripEndpointQueryAndHash(endpoint: string): string {
  const trimmed = endpoint.trim();
  return trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
}

export function resolveTransportEndpointFromPath(
  baseEndpoint: string,
  endpointPath: string
): string | null {
  const path = endpointPath.trim();
  if (!path) {
    return null;
  }
  if (/^wss?:\/\//i.test(path) || /^https?:\/\//i.test(path)) {
    return path;
  }

  const strippedBase = stripEndpointQueryAndHash(baseEndpoint);
  if (/^https?:\/\//i.test(strippedBase)) {
    try {
      const baseUrl = new URL(strippedBase);
      const resolvedUrl = new URL(path, baseUrl);
      resolvedUrl.search = "";
      resolvedUrl.hash = "";
      return resolvedUrl.toString();
    } catch {
      return null;
    }
  }

  if (path.startsWith("/")) {
    return path;
  }

  if (strippedBase.endsWith("/")) {
    return `${strippedBase}${path}`;
  }

  const lastSlash = strippedBase.lastIndexOf("/");
  if (lastSlash >= 0) {
    return `${strippedBase.slice(0, lastSlash + 1)}${path}`;
  }

  return path;
}

export function toWebSocketEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  const locationOrigin =
    typeof globalThis.location?.origin === "string" ? globalThis.location.origin.trim() : "";
  if (locationOrigin.length > 0) {
    try {
      const parsed = new URL(trimmed, locationOrigin);
      parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function resolveWebRuntimeControlEndpoint(path: string): string | null {
  const rpcEndpoint = resolveWebRuntimeEndpoint();
  if (!rpcEndpoint) {
    return null;
  }

  const cleanPath = path.trim();
  if (!cleanPath.startsWith("/")) {
    return null;
  }

  const strippedRpcEndpoint = stripEndpointQueryAndHash(rpcEndpoint);
  if (/^https?:\/\//i.test(strippedRpcEndpoint)) {
    try {
      const endpointUrl = new URL(strippedRpcEndpoint);
      endpointUrl.pathname = cleanPath;
      endpointUrl.search = "";
      endpointUrl.hash = "";
      return endpointUrl.toString();
    } catch {
      return null;
    }
  }

  return cleanPath;
}
