export type SettingsRelayAssistantKind = "new-api" | "one-api" | "sub2api" | "openai-compatible";

export type SettingsRelayAssistantPreset = {
  id: SettingsRelayAssistantKind;
  label: string;
  providerId: string;
  displayName: string;
  pool: string;
  baseUrlPlaceholder: string;
  tokenEnvKey: string;
  defaultModelId: string;
  aliases: string[];
  summary: string;
  notes: string[];
};

export type SettingsRelayAssistantDraft = {
  kind: SettingsRelayAssistantKind;
  providerId: string;
  displayName: string;
  pool: string;
  baseUrl: string;
  tokenEnvKey: string;
  defaultModelId: string;
  aliases: string[];
};

export type SettingsRelayAssistantProviderExtension = {
  providerId: string;
  displayName: string;
  pool: string;
  defaultModelId: string;
  compatBaseUrl: string;
  aliases: string[];
  apiKeyEnv: string;
};

export type SettingsRelayAssistantQualityPlugin = {
  pluginId: string;
  displayName: string;
  summary: string;
  capabilities: string[];
  manifestJson: string;
};

export type SettingsRelayAssistantGeneratedConfig = {
  providerExtension: SettingsRelayAssistantProviderExtension;
  providerExtensionsJson: string;
  qualityPlugin: SettingsRelayAssistantQualityPlugin;
  codexConfigToml: string;
  shellExports: string;
  qualityProbeScript: string;
  diagnostics: string[];
};

export const RELAY_ASSISTANT_PRESETS: SettingsRelayAssistantPreset[] = [
  {
    id: "new-api",
    label: "New API",
    providerId: "relay_new_api",
    displayName: "New API relay",
    pool: "relay_new_api",
    baseUrlPlaceholder: "https://new-api.example.com/v1",
    tokenEnvKey: "CODE_RUNTIME_SERVICE_RELAY_NEW_API_KEY",
    defaultModelId: "gpt-5.4",
    aliases: ["new-api", "newapi"],
    summary:
      "OpenAI-compatible relay. Use the deployment host plus /v1, then issue a token in the dashboard.",
    notes: [
      "Keep channel/model selection inside New API; HugeCode only needs the compatible base URL and token.",
      "Use a route-specific token with the narrowest quota practical for local development.",
    ],
  },
  {
    id: "one-api",
    label: "One API",
    providerId: "relay_one_api",
    displayName: "One API relay",
    pool: "relay_one_api",
    baseUrlPlaceholder: "https://one-api.example.com/v1",
    tokenEnvKey: "CODE_RUNTIME_SERVICE_RELAY_ONE_API_KEY",
    defaultModelId: "gpt-5.4",
    aliases: ["one-api", "oneapi"],
    summary:
      "OpenAI-compatible relay. Configure upstream channels in One API, then use its token against /v1.",
    notes: [
      "One API owns upstream channel priority and quota accounting; HugeCode treats it as one provider extension.",
      "Prefer one local token per workstation so revoked or rotated tokens are easy to isolate.",
    ],
  },
  {
    id: "sub2api",
    label: "Sub2API",
    providerId: "relay_sub2api",
    displayName: "Sub2API relay",
    pool: "relay_sub2api",
    baseUrlPlaceholder: "https://sub2api.example.com/v1",
    tokenEnvKey: "CODE_RUNTIME_SERVICE_RELAY_SUB2API_KEY",
    defaultModelId: "gpt-5.4",
    aliases: ["sub2api"],
    summary:
      "Multi-format relay. Select its OpenAI-compatible endpoint for HugeCode runtime routing.",
    notes: [
      "Sub2API may also expose Claude, Gemini, or Antigravity style endpoints; keep those as shell-specific config outside this OpenAI-compatible provider extension.",
      "For Codex routing, use the endpoint that behaves like OpenAI /v1 and a token accepted by that endpoint.",
    ],
  },
  {
    id: "openai-compatible",
    label: "Custom OpenAI-compatible",
    providerId: "relay_openai_compatible",
    displayName: "OpenAI-compatible relay",
    pool: "relay_openai_compatible",
    baseUrlPlaceholder: "https://relay.example.com/v1",
    tokenEnvKey: "CODE_RUNTIME_SERVICE_RELAY_API_KEY",
    defaultModelId: "gpt-5.4",
    aliases: ["relay"],
    summary: "Generic OpenAI-compatible endpoint for self-hosted or vendor-managed relay services.",
    notes: [
      "The runtime expects a stable HTTP(S) base URL. Add /v1 unless your gateway documents a different compatible base path.",
      "Keep the token in the environment; do not store the secret in provider extension JSON.",
    ],
  },
];

const RELAY_ASSISTANT_PRESET_BY_ID = new Map(
  RELAY_ASSISTANT_PRESETS.map((preset) => [preset.id, preset])
);

export function resolveRelayAssistantPreset(
  kind: SettingsRelayAssistantKind
): SettingsRelayAssistantPreset {
  return RELAY_ASSISTANT_PRESET_BY_ID.get(kind) ?? RELAY_ASSISTANT_PRESETS[0]!;
}

export function createRelayAssistantDraft(
  kind: SettingsRelayAssistantKind
): SettingsRelayAssistantDraft {
  const preset = resolveRelayAssistantPreset(kind);
  return {
    kind: preset.id,
    providerId: preset.providerId,
    displayName: preset.displayName,
    pool: preset.pool,
    baseUrl: preset.baseUrlPlaceholder,
    tokenEnvKey: preset.tokenEnvKey,
    defaultModelId: preset.defaultModelId,
    aliases: preset.aliases,
  };
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function normalizeEnvKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeBaseUrl(value: string): { baseUrl: string; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { baseUrl: "", diagnostics: ["Gateway base URL is required."] };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { baseUrl: trimmed, diagnostics: ["Gateway base URL must be a valid URL."] };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    diagnostics.push("Gateway base URL must use http or https.");
  }

  parsed.hash = "";
  parsed.search = "";
  const normalizedPath = parsed.pathname.replace(/\/+$/g, "");
  parsed.pathname = normalizedPath.length === 0 ? "/v1" : normalizedPath;
  const baseUrl = parsed.toString().replace(/\/+$/g, "");
  if (!baseUrl.toLowerCase().endsWith("/v1")) {
    diagnostics.push("Confirm the relay's OpenAI-compatible base path; most deployments use /v1.");
  }
  return { baseUrl, diagnostics };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function buildCodexConfigToml(extension: SettingsRelayAssistantProviderExtension): string {
  return [
    `model = ${tomlString(extension.defaultModelId)}`,
    `model_provider = ${tomlString(extension.providerId)}`,
    "disable_response_storage = true",
    "",
    `[model_providers.${extension.providerId}]`,
    `name = ${tomlString(extension.displayName)}`,
    `base_url = ${tomlString(extension.compatBaseUrl)}`,
    `env_key = ${tomlString(extension.apiKeyEnv)}`,
    `wire_api = "responses"`,
  ].join("\n");
}

function buildQualityProbeScript(extension: SettingsRelayAssistantProviderExtension): string {
  const tokenEnvKey = extension.apiKeyEnv || "RELAY_TOKEN_ENV_REQUIRED";
  const responsePayload = JSON.stringify({
    model: extension.defaultModelId,
    input: "HugeCode relay quality probe. Reply with ok.",
    max_output_tokens: 32,
  });
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    `BASE_URL=${shellQuote(extension.compatBaseUrl)}`,
    `MODEL=${shellQuote(extension.defaultModelId)}`,
    `TOKEN="\${${tokenEnvKey}:-}"`,
    "",
    'if [ -z "$TOKEN" ]; then',
    `  echo "Missing ${tokenEnvKey}; export a relay token before running the quality probe." >&2`,
    "  exit 1",
    "fi",
    "",
    'echo "Checking relay model catalog: $BASE_URL/models"',
    'curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE_URL/models" >/dev/null',
    "",
    'echo "Checking relay Responses compatibility with model: $MODEL"',
    "curl -fsS \\",
    '  -H "Authorization: Bearer $TOKEN" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d ${shellQuote(responsePayload)} \\`,
    '  "$BASE_URL/responses" >/dev/null',
    "",
    'echo "Relay quality probe passed for $BASE_URL using $MODEL."',
  ].join("\n");
}

function buildQualityPlugin(
  extension: SettingsRelayAssistantProviderExtension
): SettingsRelayAssistantQualityPlugin {
  const pluginId = `${extension.providerId}_relay_quality`;
  const capabilities = [
    "relay.quality.connectivity",
    "relay.quality.models",
    "relay.quality.responses",
    "relay.quality.secret-env",
  ];
  const manifest = {
    pluginId,
    displayName: `${extension.displayName} quality probe`,
    kind: "relay-quality",
    version: "1.0.0",
    providerId: extension.providerId,
    transport: "openai-compatible",
    capabilities,
    config: {
      compatBaseUrl: extension.compatBaseUrl,
      defaultModelId: extension.defaultModelId,
      apiKeyEnv: extension.apiKeyEnv,
      checks: ["models", "responses"],
    },
  };
  return {
    pluginId,
    displayName: manifest.displayName,
    summary:
      "Local relay quality plugin declaration for checking gateway reachability, model catalog access, Responses compatibility, and token environment wiring.",
    capabilities,
    manifestJson: JSON.stringify(manifest, null, 2),
  };
}

export function buildRelayAssistantGeneratedConfig(
  draft: SettingsRelayAssistantDraft
): SettingsRelayAssistantGeneratedConfig {
  const providerId = normalizeIdentifier(draft.providerId);
  const pool = normalizeIdentifier(draft.pool || draft.providerId);
  const tokenEnvKey = normalizeEnvKey(draft.tokenEnvKey);
  const defaultModelId = draft.defaultModelId.trim();
  const displayName = draft.displayName.trim();
  const { baseUrl, diagnostics } = normalizeBaseUrl(draft.baseUrl);
  const aliases = Array.from(
    new Set(
      [providerId, ...draft.aliases]
        .map(normalizeIdentifier)
        .filter((alias) => alias.length > 0 && alias !== providerId)
    )
  );

  if (providerId.length === 0) {
    diagnostics.push("Provider id is required.");
  }
  if (pool.length === 0) {
    diagnostics.push("Provider pool is required.");
  }
  if (displayName.length === 0) {
    diagnostics.push("Display name is required.");
  }
  if (defaultModelId.length === 0) {
    diagnostics.push("Default model id is required.");
  }
  if (tokenEnvKey.length === 0) {
    diagnostics.push("Token environment variable is required.");
  }

  const providerExtension: SettingsRelayAssistantProviderExtension = {
    providerId,
    displayName,
    pool,
    defaultModelId,
    compatBaseUrl: baseUrl,
    aliases,
    apiKeyEnv: tokenEnvKey,
  };
  const providerExtensionsJson = JSON.stringify([providerExtension]);
  const qualityPlugin = buildQualityPlugin(providerExtension);
  const codexConfigToml = buildCodexConfigToml(providerExtension);
  const qualityProbeScript = buildQualityProbeScript(providerExtension);
  const shellExports = [
    `export CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON=${shellQuote(providerExtensionsJson)}`,
    `export ${tokenEnvKey}='<paste relay token here>'`,
    `export CODE_RUNTIME_SERVICE_DEFAULT_MODEL=${shellQuote(defaultModelId)}`,
  ].join("\n");

  return {
    providerExtension,
    providerExtensionsJson,
    qualityPlugin,
    codexConfigToml,
    shellExports,
    qualityProbeScript,
    diagnostics,
  };
}
