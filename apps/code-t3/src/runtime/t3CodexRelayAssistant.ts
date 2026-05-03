import {
  buildT3CodexGatewayProviderProfile,
  createT3CodexGatewayProviderRoute,
  type T3CodeProviderRoute,
} from "@ku0/code-t3-runtime-adapter";

export type T3CodexRelayProviderId = "tokenflux" | "hugerouter" | "custom";

export type T3CodexRelayProvider = {
  id: T3CodexRelayProviderId;
  label: string;
  baseUrl: string;
  envKey: string;
  modelAlias: string;
  readinessLabel: string;
  summary: string;
};

function envText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function resolveT3CodexRelayBackendId(providerId: T3CodexRelayProviderId): string {
  return `codex-app-server-${providerId === "custom" ? "custom_relay" : providerId}`;
}

export function listT3CodexRelayProviders(): T3CodexRelayProvider[] {
  const tokenFluxEnvKey =
    envText(import.meta.env.VITE_TOKENFLUX_API_KEY_ENV) ?? "TOKENFLUX_API_KEY";
  const hugeRouterEnvKey =
    envText(import.meta.env.VITE_HUGEROUTER_ROUTE_TOKEN_ENV) ?? "HUGEROUTER_ROUTE_TOKEN";
  const customEnvKey =
    envText(import.meta.env.VITE_CODEX_RELAY_API_KEY_ENV) ?? "CODEX_RELAY_API_KEY";
  const customBaseUrl = envText(import.meta.env.VITE_CODEX_RELAY_BASE_URL);
  return [
    {
      id: "tokenflux",
      label: "TokenFlux",
      baseUrl: envText(import.meta.env.VITE_TOKENFLUX_BASE_URL) ?? "https://tokenflux.dev/v1",
      envKey: tokenFluxEnvKey,
      modelAlias: envText(import.meta.env.VITE_TOKENFLUX_MODEL_ALIAS) ?? "agent-coding-default",
      readinessLabel: "runtime env",
      summary: "OpenAI-compatible relay for embedded Codex app-server routing.",
    },
    {
      id: "hugerouter",
      label: "HugeRouter",
      baseUrl:
        envText(import.meta.env.VITE_HUGEROUTER_ROUTE_BASE_URL) ??
        "https://hugerouter.openhuge.local/v1",
      envKey: hugeRouterEnvKey,
      modelAlias: envText(import.meta.env.VITE_HUGEROUTER_MODEL_ALIAS) ?? "agent-coding-default",
      readinessLabel: "runtime env",
      summary: "HugeCode commercial route token relay for built-in Codex.",
    },
    {
      id: "custom",
      label: "Custom relay",
      baseUrl: customBaseUrl ?? "https://relay.example/v1",
      envKey: customEnvKey,
      modelAlias: envText(import.meta.env.VITE_CODEX_RELAY_MODEL_ALIAS) ?? "agent-coding-default",
      readinessLabel: customBaseUrl ? "runtime env" : "base URL needed",
      summary: "Bring an env-backed OpenAI-compatible relay without exposing key material.",
    },
  ];
}

export function createT3CodexRelayRoute(provider: T3CodexRelayProvider): T3CodeProviderRoute {
  return createT3CodexGatewayProviderRoute(
    buildT3CodexGatewayProviderProfile({
      apiKeyEnvKey: provider.envKey,
      baseUrl: provider.baseUrl,
      displayName: provider.label,
      executionTarget: "embedded_app_server",
      modelAlias: provider.modelAlias,
      profileKind: provider.id === "hugerouter" ? "hugerouter_commercial" : "custom_gateway",
      providerId: provider.id === "custom" ? "custom_relay" : provider.id,
    })
  );
}
