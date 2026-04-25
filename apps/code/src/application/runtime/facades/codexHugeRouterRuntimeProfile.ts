export const CODEX_HUGEROUTER_PROVIDER_ID = "hugerouter";
export const CODEX_HUGEROUTER_PROVIDER_NAME = "HugeRouter";
export const CODEX_HUGEROUTER_ROUTE_TOKEN_ENV = "HUGEROUTER_ROUTE_TOKEN";
export const CODEX_HUGEROUTER_WIRE_API = "responses";

export type CodexHugeRouterWireApi = typeof CODEX_HUGEROUTER_WIRE_API;

export type CodexHugeRouterRuntimeProfileInput = {
  baseUrl: string;
  model: string;
  routeToken: string;
  providerId?: string | null;
  providerName?: string | null;
  routeTokenEnvKey?: string | null;
  disableResponseStorage?: boolean | null;
};

export type CodexHugeRouterProviderConfig = {
  providerId: string;
  providerName: string;
  baseUrl: string;
  envKey: string;
  wireApi: CodexHugeRouterWireApi;
};

export type CodexHugeRouterRuntimeProfile = {
  model: string;
  modelProvider: string;
  disableResponseStorage: boolean;
  provider: CodexHugeRouterProviderConfig;
  environment: Record<string, string>;
  configToml: string;
};

function normalizeRequiredText(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProviderId(value: string | null | undefined): string {
  const providerId = normalizeOptionalText(value) ?? CODEX_HUGEROUTER_PROVIDER_ID;
  if (!/^[a-z][a-z0-9_-]*$/u.test(providerId)) {
    throw new Error("providerId must use lowercase letters, numbers, underscores, or hyphens.");
  }
  return providerId;
}

function normalizeEnvKey(value: string | null | undefined): string {
  const envKey = normalizeOptionalText(value) ?? CODEX_HUGEROUTER_ROUTE_TOKEN_ENV;
  if (!/^[A-Z_][A-Z0-9_]*$/u.test(envKey)) {
    throw new Error("routeTokenEnvKey must be an uppercase environment variable name.");
  }
  return envKey;
}

export function normalizeHugeRouterCodexBaseUrl(baseUrl: string): string {
  const rawBaseUrl = normalizeRequiredText(baseUrl, "baseUrl");
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error("baseUrl must be an absolute http(s) URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("baseUrl must use http or https.");
  }

  const normalizedPath = url.pathname.replace(/\/+$/u, "");
  if (/\/(?:responses|chat\/completions)$/u.test(normalizedPath)) {
    throw new Error("baseUrl must point at the HugeRouter /v1 root, not an operation endpoint.");
  }

  url.pathname = normalizedPath.length > 0 ? normalizedPath : "/";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/u, "");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function buildCodexConfigToml(input: {
  model: string;
  provider: CodexHugeRouterProviderConfig;
  disableResponseStorage: boolean;
}): string {
  return [
    `model = ${tomlString(input.model)}`,
    `model_provider = ${tomlString(input.provider.providerId)}`,
    `disable_response_storage = ${input.disableResponseStorage ? "true" : "false"}`,
    "",
    `[model_providers.${input.provider.providerId}]`,
    `name = ${tomlString(input.provider.providerName)}`,
    `base_url = ${tomlString(input.provider.baseUrl)}`,
    `env_key = ${tomlString(input.provider.envKey)}`,
    `wire_api = ${tomlString(input.provider.wireApi)}`,
    "",
  ].join("\n");
}

export function buildCodexHugeRouterRuntimeProfile(
  input: CodexHugeRouterRuntimeProfileInput
): CodexHugeRouterRuntimeProfile {
  const model = normalizeRequiredText(input.model, "model");
  const routeToken = normalizeRequiredText(input.routeToken, "routeToken");
  const providerId = normalizeProviderId(input.providerId);
  const providerName = normalizeOptionalText(input.providerName) ?? CODEX_HUGEROUTER_PROVIDER_NAME;
  const envKey = normalizeEnvKey(input.routeTokenEnvKey);
  const provider: CodexHugeRouterProviderConfig = {
    providerId,
    providerName,
    baseUrl: normalizeHugeRouterCodexBaseUrl(input.baseUrl),
    envKey,
    wireApi: CODEX_HUGEROUTER_WIRE_API,
  };
  const disableResponseStorage = input.disableResponseStorage ?? true;

  return {
    model,
    modelProvider: providerId,
    disableResponseStorage,
    provider,
    environment: {
      [envKey]: routeToken,
    },
    configToml: buildCodexConfigToml({
      model,
      provider,
      disableResponseStorage,
    }),
  };
}
