# Code Runtime Provider Catalog Architecture

## Goal

Keep provider routing semantics in the runtime service, not in UI clients, so `web` / `desktop-host` / future `cli` / `telegram` clients consume one stable contract.

## What Is Canonical Now

- Canonical RPC method: `code_providers_catalog`
- Legacy alias: `providers_catalog`
- Capability flag: `provider_catalog`
- Canonical provider IDs:
  - `openai` (pool: `codex`, oauth: `codex`)
  - `anthropic` (pool: `claude`, oauth: `claude_code`)
  - `claude_code_local` (pool: `null`, oauth: `null`)
  - `google` (pool: `gemini`, oauth: `gemini`)

The service returns provider metadata (aliases/default model/availability) through one endpoint. Clients should render and route by this payload instead of local hardcoded provider maps.

## Service Responsibilities

`packages/code-runtime-service-rs` now centralizes provider metadata through runtime provider specs:

- alias normalization
- routed provider/pool/oAuth IDs
- default model IDs
- model pool assembly
- provider catalog assembly

This removes scattered alias logic in multiple paths and reduces drift when provider names evolve (for example `antigravity -> google/gemini`).

`claude_code_local` is the exception to the OAuth/OpenAI-compatible rule:

- it is a built-in native provider, not an extension
- availability is gated by local CLI readiness, not OAuth pool state
- v1 is macOS-first and requires an already authenticated local `claude` install
- failures stay local and do not auto-fallback to cloud `anthropic`

## Client Responsibilities

`packages/code-runtime-host-contract` exposes:

- typed response schema for `code_providers_catalog`
- canonicalization helpers backed by a single alias registry
- method/feature constants for capability negotiation

UI/bridge clients should:

1. call `code_rpc_capabilities`
2. check feature `provider_catalog`
3. call `code_providers_catalog`
4. drive provider displays and routing hints from service payload
5. route explicit provider launch, model-derived send flow, and readiness
   summaries through one app/runtime facade instead of page-local heuristics

See [`provider-routing-control-plane.md`](./provider-routing-control-plane.md)
for the current HugeCode launch/send/review control-plane rules.

## Onboarding a New Provider

1. Add provider spec in Rust (`RuntimeProviderSpec`).
2. For non-core providers, register extension config (OpenAI-compatible) instead of patching core enums.
3. Add alias/ID mapping in host contract registry.
4. Extend tests:
   - method registry + capability flags
   - provider catalog payload coverage
   - turn routing mismatch/alias cases

Keep legacy aliases for at least one release cycle before removal.

## Extension Provider Config (OpenAI-Compatible)

Use `CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON` to register non-core providers.

```json
[
  {
    "providerId": "deepseek",
    "displayName": "DeepSeek",
    "pool": "deepseek",
    "defaultModelId": "deepseek-chat",
    "compatBaseUrl": "https://api.deepseek.com/v1",
    "aliases": ["deepseek", "ds"],
    "apiKeyEnv": "DEEPSEEK_API_KEY"
  }
]
```

Notes:

- Core built-ins remain fixed: `openai`, `anthropic`, `claude_code_local`, `google`.
- Extension providers are routed via OpenAI-compatible `chat/completions`.
- If extension `apiKey` is missing, provider remains visible in catalog but marked unavailable.
