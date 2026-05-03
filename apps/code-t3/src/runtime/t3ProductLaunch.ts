export type T3ProductLanguage = "en" | "zh";

export type T3ProductTransportMode = "hugerouter" | "private-network";

export type T3ProductRelayKind = "hugerouter" | "openai-compatible" | "tailscale";

export type T3ProductSharePayload = {
  version: 1;
  product: "t3code";
  locale: T3ProductLanguage;
  transport: T3ProductTransportMode;
  relayKind: T3ProductRelayKind;
  relayBaseUrl: string;
  inviteCode: string;
  routeTokenEnvKey: string;
  modelAlias: string;
};

export type T3ProductRouteReadiness = {
  embeddedCodex: boolean;
  localCodex: boolean;
  localClaude: boolean;
  arbitraryRelay: boolean;
  hugeRouterConnected: boolean;
  shareReady: boolean;
};

export const T3_PRODUCT_SHARE_PREFIX = "T3CODE-SHARE-v1.";

const BLOCKED_SHARE_KEYS = [
  "apiKey",
  "accessToken",
  "refreshToken",
  "password",
  "cookie",
  "secret",
] as const;

function requiredText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function normalizeHttpsOrPrivateUrl(value: string) {
  const rawUrl = requiredText(value, "relayBaseUrl");
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("relayBaseUrl must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("relayBaseUrl must not include embedded credentials.");
  }
  if (parsed.protocol === "http:" && !isPrivateNetworkHost(parsed.hostname)) {
    throw new Error("plain-http relayBaseUrl is only allowed on private network hosts.");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/u, "") || "/";
  return parsed.toString().replace(/\/$/u, "");
}

function isPrivateNetworkHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("100.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./u.test(normalized)
  );
}

function encodeSharePayload(payload: T3ProductSharePayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeSharePayload(encoded: string) {
  const normalized = encoded.replace(/-/gu, "+").replace(/_/gu, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function assertNoBlockedShareKeys(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const key of BLOCKED_SHARE_KEYS) {
    if (new RegExp(`"${key}"\\s*:`, "iu").test(serialized)) {
      throw new Error(`share payload must not include ${key}.`);
    }
  }
}

export function normalizeT3ProductSharePayload(
  input: Omit<T3ProductSharePayload, "version" | "product"> &
    Partial<Pick<T3ProductSharePayload, "version" | "product">>
): T3ProductSharePayload {
  const payload: T3ProductSharePayload = {
    inviteCode: requiredText(input.inviteCode, "inviteCode"),
    locale: input.locale === "zh" ? "zh" : "en",
    modelAlias: requiredText(input.modelAlias, "modelAlias"),
    product: "t3code",
    relayBaseUrl: normalizeHttpsOrPrivateUrl(input.relayBaseUrl),
    relayKind:
      input.relayKind === "tailscale" || input.relayKind === "openai-compatible"
        ? input.relayKind
        : "hugerouter",
    routeTokenEnvKey: requiredText(input.routeTokenEnvKey, "routeTokenEnvKey"),
    transport: input.transport === "private-network" ? "private-network" : "hugerouter",
    version: 1,
  };
  assertNoBlockedShareKeys(payload);
  return payload;
}

export function createT3ProductShareCode(
  input: Omit<T3ProductSharePayload, "version" | "product"> &
    Partial<Pick<T3ProductSharePayload, "version" | "product">>
) {
  return `${T3_PRODUCT_SHARE_PREFIX}${encodeSharePayload(normalizeT3ProductSharePayload(input))}`;
}

export function parseT3ProductShareCode(value: string): T3ProductSharePayload {
  const trimmed = requiredText(value, "share code");
  const encoded = trimmed.startsWith(T3_PRODUCT_SHARE_PREFIX)
    ? trimmed.slice(T3_PRODUCT_SHARE_PREFIX.length)
    : new URL(trimmed).searchParams.get("payload");
  if (!encoded) {
    throw new Error("Unsupported T3 share code format.");
  }
  const decoded = decodeSharePayload(encoded);
  assertNoBlockedShareKeys(decoded);
  const record = decoded as Partial<T3ProductSharePayload>;
  if (record.product !== "t3code" || record.version !== 1) {
    throw new Error("Unsupported T3 share payload.");
  }
  return normalizeT3ProductSharePayload(record as T3ProductSharePayload);
}

export function summarizeT3ProductRouteReadiness(input: {
  routes: readonly {
    backendId: string;
    provider: string;
    status: string;
    authState?: string;
    capabilities: string[];
    installed?: boolean;
  }[];
  hugeRouterConnected: boolean;
  relayBaseUrl: string;
  shareCode: string;
}): T3ProductRouteReadiness {
  const readyRoutes = input.routes.filter(
    (route) =>
      route.status === "ready" &&
      route.installed !== false &&
      (route.authState === undefined || route.authState === "authenticated")
  );
  const routeText = readyRoutes
    .map((route) =>
      [route.backendId, route.provider, route.status, ...route.capabilities].join(" ")
    )
    .join(" ")
    .toLowerCase();
  return {
    arbitraryRelay: input.relayBaseUrl.trim().length > 0,
    embeddedCodex:
      routeText.includes("embedded_app_server") || routeText.includes("codex-app-server"),
    hugeRouterConnected: input.hugeRouterConnected,
    localClaude: routeText.includes("local-claude") || routeText.includes("claude_code_local"),
    localCodex: routeText.includes("local-codex") || routeText.includes("local_cli"),
    shareReady: input.shareCode.trim().startsWith(T3_PRODUCT_SHARE_PREFIX),
  };
}
