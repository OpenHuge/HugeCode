# Relay Assistant

Relay Assistant is a settings/runtime control-plane helper for connecting
OpenAI-compatible relay services to the local HugeCode runtime without adding a
new provider protocol.

## Supported Relay Shapes

| Relay        | Local shape                                                                                                | Notes                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New API      | OpenAI-compatible `/v1` base URL + dashboard token                                                         | New API positions itself as an LLM gateway and AI asset management system. Keep channels, model mapping, and quotas inside New API; expose one local provider extension to HugeCode.                       |
| One API      | OpenAI-compatible API format + One API token                                                               | One API documents standard OpenAI API format access, token management, load balancing, and channel management. Treat it as a single provider extension from HugeCode.                                      |
| Sub2API      | OpenAI-compatible endpoint for Codex/HugeCode; optional separate Claude/Gemini/Antigravity shell endpoints | Sub2API is a subscription quota distribution gateway. Its ecosystem includes Codex, Claude Code, Gemini, and other relay services, but HugeCode runtime routing should use the OpenAI-compatible endpoint. |
| Custom relay | Any stable HTTP(S) OpenAI-compatible endpoint                                                              | Use when a vendor or self-hosted gateway behaves like OpenAI `/v1`.                                                                                                                                        |

## Runtime Contract

The assistant generates the existing provider-extension environment contract:

```bash
export CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON='[{"providerId":"relay_new_api","displayName":"New API relay","pool":"relay_new_api","defaultModelId":"gpt-5.4","compatBaseUrl":"https://new-api.example.com/v1","aliases":["new-api","newapi"],"apiKeyEnv":"CODE_RUNTIME_SERVICE_RELAY_NEW_API_KEY"}]'
export CODE_RUNTIME_SERVICE_RELAY_NEW_API_KEY='<paste relay token here>'
export CODE_RUNTIME_SERVICE_DEFAULT_MODEL='gpt-5.4'
```

The token stays in an environment variable. The JSON only names the variable and
the runtime resolves it on startup. This keeps shell setup, embedded runtime
startup, and future desktop settings writers on the same contract.

For a local Codex CLI shell, the same assistant also generates a compatible
`config.toml` provider block:

```toml
model = "gpt-5.4"
model_provider = "relay_new_api"
disable_response_storage = true

[model_providers.relay_new_api]
name = "New API relay"
base_url = "https://new-api.example.com/v1"
env_key = "CODE_RUNTIME_SERVICE_RELAY_NEW_API_KEY"
wire_api = "responses"
```

## UX Contract

- The settings page shows Relay Assistant inside the server control plane.
- Presets only seed defaults and operational guidance; users can edit provider
  id, pool, base URL, model, and token environment variable.
- `Copy local setup` copies runtime shell exports plus the Codex shell provider
  block, the relay quality probe script, and the local quality plugin
  declaration.
- `Apply locally` calls an optional host-provided settings writer. If none is
  connected, it falls back to copying the generated local setup artifacts.
- Non-`/v1` paths are not rewritten silently; the assistant surfaces a warning so
  users can confirm gateway-specific paths.

## Relay Quality Plugin

For each relay draft, the assistant also generates a local relay quality plugin
declaration. The declaration is intentionally token-free: it names the provider
extension, compatible base URL, default model, token environment variable, and
the probe capabilities (`models` and `responses`) that local HugeRouter quality
tooling can evaluate.

The generated probe script is a short operator-run smoke test:

1. verify the relay token environment variable is present
2. call the relay's OpenAI-compatible `/models` endpoint
3. call the relay's `/responses` endpoint with the selected default model

This gives users a stable way to test a relay station before routing real work
through it, while keeping HugeRouter responsible for route receipts, metering,
fallback, and long-running service quality decisions.

## References

- New API upstream: <https://github.com/QuantumNous/new-api>
- One API upstream: <https://github.com/songquanpeng/one-api>
- Sub2API upstream: <https://github.com/Wei-Shaw/sub2api>
