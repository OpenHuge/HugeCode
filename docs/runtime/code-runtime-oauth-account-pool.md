# Code Runtime OAuth Account Pool (Codex/Gemini/Claude)

## Scope

- Runtime contract and client API for OAuth multi-account pool management.
- Rust service implementation in `packages/code-runtime-service-rs` with SQLite WAL persistence.
- Compatibility-first rollout (`code_*` canonical methods + legacy aliases).
- Architecture guardrails for runtime-owned multi-client behavior are described in:
  - `docs/arch.md`
  - `docs/specs/code-runtime-spec-2026.md`

## Architecture Position

- This document defines the routing/account-pool authority of the shared runtime service.
- UI (`apps/code`) and desktop bridge (`apps/code-electron`) must consume this authority, not re-implement policy.
- Runtime host contract (`packages/code-runtime-host-contract`) is the transport-neutral envelope, while this document defines routing semantics.

## Contract Surface

### Canonical RPC methods

- `code_oauth_accounts_list`
- `code_oauth_account_upsert`
- `code_oauth_account_remove`
- `code_oauth_pools_list`
- `code_oauth_pool_upsert`
- `code_oauth_pool_remove`
- `code_oauth_pool_members_replace`
- `code_oauth_pool_select`
- `code_oauth_rate_limit_report`

### Legacy aliases

- `oauth_accounts_list`
- `oauth_account_upsert`
- `oauth_account_remove`
- `oauth_pools_list`
- `oauth_pool_upsert`
- `oauth_pool_remove`
- `oauth_pool_members_replace`
- `oauth_pool_select`
- `oauth_rate_limit_report`

### Shared model contracts

- Providers: `codex | gemini | claude_code`
- Account lifecycle: status/metadata/disable reason
- Pool policy:
  - strategy: `round_robin | p2c`
  - sticky mode: `cache_first | balance | performance_first`
- Pool member selection result
- Rate-limit report payload

## Compatibility Strategy

- Canonical methods remain source-of-truth.
- Legacy aliases are preserved and discovered through `listCodeRuntimeRpcMethodCandidates`.
- Compatibility field helper keeps bidirectional mapping:
  - `accountId <-> account_id`
  - `poolId <-> pool_id`
- Existing camelCase/snake_case dual-path remains for:
  - `workspaceId/sessionId/threadId/provider/modelId/reasonEffort/accessMode`
- Account metadata compatibility keys:
  - API key: `apiKey | api_key | token | access_token | openaiApiKey | anthropicApiKey | geminiApiKey`
  - OpenAI-compat base URL: `compatBaseUrl | compat_base_url | baseUrl | base_url | proxyBaseUrl | proxy_base_url`
- Response redaction rule:
  - `code_oauth_accounts_list` / `code_oauth_account_upsert` / `code_oauth_pool_select` never return raw API key value.
  - Instead, response metadata exposes `apiKeyConfigured: true` when a key exists.
  - `compatBaseUrl` is normalized to canonical camelCase key for display.
- Secret-at-rest requirement:
  - Configure `CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY` (base64-encoded 32 bytes).
  - Runtime persists API keys as `apiKeyEncryptedV1` (AES-256-GCM-SIV), not plaintext.
  - Startup performs legacy plaintext migration; if key is missing while plaintext/encrypted secrets exist, startup fails fast.
  - `metadata.apiKeyEncryptedV1` is reserved for service-managed ciphertext and is rejected from client upsert payloads.

## Turn Routing Contract (Provider + Model)

- `code_turn_send` payload supports explicit `provider` and `modelId`.
- Allowed provider values for turn routing: `openai | anthropic | google`.

### Validation rules

- Unknown provider is rejected as `INVALID_PARAMS`.
- Provider/model mismatch is rejected as `INVALID_PARAMS`.
  - Example: `provider=openai` with `modelId=claude-*`.
- Invalid enum values are always hard errors (no silent fallback).

### Routing rules

- Provider + model: route exactly if consistent.
- Provider only: route by provider default model (service) or first eligible provider model from the active desktop/browser adapter.
  - In OpenAI-compatible gateway mode, service should prefer discovered provider models with stability ranking (non-experimental chat/coding models first, e.g. `gemini-3-flash` before `gemini-2.0-flash-exp`).
- Model only: infer provider from model ID.
- Neither: apply default model strategy.

### Route metadata visibility (required)

- Routed `provider/model/pool/source` must remain visible in ACK/thread metadata and downstream UI.
- Any adapter that drops routed metadata is contract-breaking.

## Runtime Service Behavior

- SQLite storage with WAL + foreign key checks.
- Startup validates DB path and fails fast on invalid DB configuration (no silent in-memory downgrade).
- Default pools are seeded:
  - `pool-codex`
  - `pool-gemini`
  - `pool-claude`
- Account scheduling supports:
  - weighted round-robin
  - p2c (power-of-two choices)
  - sticky session binding
  - preferred account
- Rate-limit updates:
  - success clears model-scoped limiter
  - failure increments limiter state
  - `invalid_grant` auto-disables account and clears bindings (`oauth_invalid_grant`)
- Routing observability reason codes (service logs):
  - `pool_not_found`
  - `pool_disabled`
  - `rate_limited`
  - `pool_exhausted`
  - `auth_missing`
  - `decrypt_failed`
  - `pool_select_error`
- Provider filter validation rejects unsupported provider values with `INVALID_PARAMS`.
- Enum-like config fields are strict-validated:
  - account `status`: `enabled | disabled | forbidden | validation_blocked`
  - pool `strategy`: `round_robin | p2c`
  - pool `stickyMode`: `cache_first | balance | performance_first`
  - invalid values are rejected as `INVALID_PARAMS` (no silent fallback)
- Service readiness is provider-aware (`OPENAI/ANTHROPIC/GEMINI` endpoints + keys).
- `GET /ready` includes an `oauthPool` diagnostics snapshot for operations visibility:
  - `accountsTotal`
  - `accountsEnabled`
  - `accountsWithApiKey`
  - `poolsTotal`
  - `poolsEnabled`
  - `poolMembersTotal`
  - `sessionBindingsTotal`
  - `activeRateLimitsTotal`
  - `oauthSecretKeyConfigured`
  - when diagnostics fail, response includes `oauthPoolError` (status logic remains unchanged).
- `GET /ready` includes a `runtimeDiagnostics` snapshot for routing/account hardening visibility:
  - `oauthRoutingFailuresTotal`
  - `oauthRoutingPoolSelectErrorTotal`
  - `oauthRoutingPoolNotFoundTotal`
  - `oauthRoutingPoolDisabledTotal`
  - `oauthRoutingPoolExhaustedTotal`
  - `oauthRoutingRateLimitedTotal`
  - `oauthRoutingAuthMissingTotal`
  - `oauthRoutingDecryptFailedTotal`
  - `oauthReservedMetadataRejectionsTotal`
- Runtime routing policy is strict pool-selection only for turn execution; direct account-scan fallback is removed from send path.
- Provider-only default-model resolution in `code_turn_send` reuses the same strict pool-selected credentials (no separate direct account scan path).
- Provider catalog availability and compat catalog recovery probes now use strict pool checks (pool exists + enabled + enabled member with resolvable credentials) instead of account-list scanning.
- Account upsert now auto-syncs membership into provider default pools (`pool-codex`, `pool-claude`, `pool-gemini`) so strict routing remains compatible with provider-only flows.
- Service startup emits an `oauth pool startup diagnostics` log event with core pool/account counts and `oauthSecretKeyConfigured`.
- OpenAI-compatible gateway mode (`CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL`) behavior:
  - reads model catalog from `{baseUrl}/models` and merges into `code_models_pool`;
  - model catalog lookup uses in-process TTL cache (`CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS`, default `30000`) and stale-on-refresh-failure fallback to reduce routing jitter;
  - catalog cache is scoped by resolved compat `baseUrl` to avoid cross-endpoint drift when accounts use different proxy backends;
  - when compat/env keys are missing, catalog discovery may use enabled OAuth account API keys per provider pool (`codex|claude_code|gemini`) to keep provider-only routing functional;
  - sends routed turn execution through `{baseUrl}/chat/completions` for OpenAI/Anthropic/Google providers;
  - key priority: OAuth/account metadata -> `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY` -> `OPENAI_API_KEY` -> provider-specific env key fallback;
  - base URL priority: OAuth/account metadata (`compatBaseUrl` aliases) -> `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL`;
  - readiness accepts compat mode as provider-ready when base URL is valid and a compatible key is present.
  - account upsert metadata is patch-like:
    - when `metadata` is omitted, existing credentials are preserved;
    - when `metadata` is provided, canonical keys are reconciled (`apiKey`, `compatBaseUrl`) and alias drift is collapsed.
  - account key writes require `CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY`; missing key is a hard error (no insecure fallback).

## Non-Rollback Sentinels

- Do not remove provider/model mismatch rejection.
- Do not reintroduce model-name-only routing in send paths.
- Do not hide routed metadata from ACK/thread surfaces.
- Do not downgrade strict enum validation to implicit defaulting.
- Do not move routing policy into UI or transport adapters.
- Do not regress provider-only default selection to naive first-model choice when compat catalog includes experimental/preview models.
- Do not remove compat catalog cache + stale fallback behavior; provider-only routing should remain stable under transient `/models` failures.
- Do not require env-level compat keys for provider-only routing when OAuth account keys are available.

## Web / Desktop Integration

- Web client (`apps/code/src/services/runtimeClient.ts`) consumes OAuth APIs through runtime contract only.
- Desktop host bridges may keep compatibility commands during migration.
- Unsupported methods must continue standard method-not-found handling.
- Business/UI code should avoid direct platform bridge coupling.

## Deprecation Plan

- Current phase: dual-write/dual-read support (canonical + legacy).
- Remove legacy aliases only after:
  1. all consumers call canonical `code_*`;
  2. one stable release cycle without legacy usage;
  3. explicit migration note in release docs.

## Risk and Rollback

- Main risk: provider/status mismatch in manually managed pool members.
- Mitigations:
  - pool-member provider validation at write time;
  - invalid account auto-disable on terminal OAuth error.
- Rollback:
  1. route clients back to existing runtime methods;
  2. ignore new OAuth methods (no impact on core turn/thread/workspace flows);
  3. keep DB file for recovery or set `CODE_RUNTIME_SERVICE_OAUTH_POOL_DB=:memory:`.
