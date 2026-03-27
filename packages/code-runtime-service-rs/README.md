# code-runtime-service-rs

Standalone Rust runtime service for `apps/code`.

## Purpose

- Decouple UI from runtime implementation.
- Provide a single RPC contract that web, Electron desktop, and other clients can consume.
- Keep model invocation and session state in one service layer.

## Run

```bash
pnpm --filter @ku0/code-runtime-service-rs dev
```

Default address: `http://127.0.0.1:8788`

## Environment variables

- `CODE_RUNTIME_SERVICE_HOST` (default `127.0.0.1`)
- `CODE_RUNTIME_SERVICE_PORT` (default `8788`)
- `CODE_RUNTIME_SERVICE_DEFAULT_MODEL` (default `gpt-5.3-codex`)
- `CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT` (default `https://api.openai.com/v1/responses`)
- `OPENAI_API_KEY` (for Codex/OpenAI models)
- `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL` (optional, e.g. `http://127.0.0.1:8045/v1`)
- `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY` (optional, OpenAI-compatible gateway key; falls back to `OPENAI_API_KEY`)
- `CODE_RUNTIME_SERVICE_ANTHROPIC_ENDPOINT` (default `https://api.anthropic.com/v1/messages`)
- `CODE_RUNTIME_SERVICE_ANTHROPIC_VERSION` (default `2023-06-01`)
- `ANTHROPIC_API_KEY` (for Claude/Anthropic models)
- `CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH` (optional explicit path to the local `claude` CLI used by `claude_code_local`)
- `CODE_RUNTIME_SERVICE_GEMINI_ENDPOINT` (default `https://generativelanguage.googleapis.com/v1beta/models`)
- `GEMINI_API_KEY` (for Gemini/Google models)
- `CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS` (default `45000`)
- `CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES` (default `2`)
- `CODE_RUNTIME_SERVICE_OPENAI_RETRY_BASE_MS` (default `250`)
- `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS` (default `30000`, TTL for cached `/models` catalog in compat mode)
- `CODE_RUNTIME_SERVICE_OAUTH_POOL_DB` (default `~/.hugecode/oauth-pool.db`; falls back to the legacy temp-dir path only when no home directory can be resolved)
- `CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY` (optional override; base64-encoded 32-byte key for OAuth account API-key encryption-at-rest)
- `CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY_FILE` (optional key file path; defaults to `~/.hugecode/oauth-secret.key`)
- `CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL` (optional; absolute `http(s)` origin used to build OAuth callback URLs behind proxies)

## RPC endpoint

- `POST /rpc`
- Request body:
  - `{ "method": "code_health", "params": {} }`
- Response body:
  - success: `{ "ok": true, "result": ... }`
  - failure: `{ "ok": false, "error": { "message": "..." } }`

## Runtime events stream

- `GET /events`
- Response type: `text/event-stream` (SSE)
- Emits runtime envelopes as JSON `data:` frames with SSE `id` + `retry` fields:
  - `turn.started` before provider execution
  - `item.started`, `item.updated`, and `item.completed` for item lifecycle updates
  - `item.agentMessage.delta` for assistant text streaming
  - `item.mcpToolCall.progress` for in-flight tool progress messages
  - `turn.completed` for successful turns
  - `turn.failed` for unsuccessful turns
- Also emits `native_state_fabric_updated` after mutating RPC calls (for live-update consumers):
  - includes `payload.revision`, `payload.scope[]`, `payload.reason`
  - OAuth login updates also include optional fields:
    - `payload.oauthLoginId`
    - `payload.oauthLoginSuccess`
    - `payload.oauthLoginError`
- Supports replay after reconnect:
  - send `Last-Event-ID` request header to resume from buffered events
- Existing `code_turn_send` RPC response shape is unchanged; `/events` is an additional stream.

## OAuth endpoints (Codex)

- `POST /oauth/codex/start`:
  - input: `{ "workspaceId": "..." }` (optional)
  - output: `{ "loginId": "...", "authUrl": "..." }`
  - default authorize URL shape matches CodexMonitor/Codex flow:
    - `redirect_uri=http://localhost:1455/auth/callback`
    - `scope=openid profile email offline_access api.connectors.read api.connectors.invoke`
    - `originator=hypecode`
  - loopback callback port is configurable via `CODE_RUNTIME_SERVICE_OAUTH_LOOPBACK_CALLBACK_PORT` (default `1455`).
  - the runtime only binds the loopback callback port while a Codex OAuth login is actively pending; startup no longer holds `1455` open.
  - if `1455` is already in use when OAuth starts, the start request fails with a clear port-conflict error instead of stealing the port at boot.
- `POST /oauth/codex/cancel`:
  - input: `{ "workspaceId": "..." }` (optional)
  - output: `{ "canceled": true, "status": "canceled|idle" }`
- `GET /auth/callback`:
  - browser callback endpoint that exchanges authorization code and upserts OAuth account into pool.
  - legacy alias: `GET /oauth/codex/callback` (backward compatible).

## OAuth account encryption-at-rest

- OAuth account API keys are always encrypted at rest (AES-256-GCM-SIV).
- Startup key resolution order:
  - `CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY` if provided.
  - else `CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY_FILE` if provided.
  - else default `~/.hugecode/oauth-secret.key`.
- If no key file exists, service generates a new 32-byte key, persists it, and applies restrictive permissions (`0700` directory, `0600` key file on unix).
- OAuth account pool storage follows the same persistence root:
  - default database path is `~/.hugecode/oauth-pool.db`
  - startup migrates the legacy temp-dir database (`${TMPDIR}/code-runtime-service-oauth-pool.db`) into `~/.hugecode` when the canonical file is still absent

## Health and readiness

- `GET /health`:
  - process liveness only (`200` when service is running)
- `GET /ready`:
  - runtime readiness (`200` when the default model's provider key+endpoint are valid)
  - returns `503` with check details when not ready

## Startup validation

- Service startup validates:
  - `CODE_RUNTIME_SERVICE_DEFAULT_MODEL` must be non-empty
  - provider endpoints (`OPENAI/ANTHROPIC/GEMINI`) must be valid URLs
- Missing API keys are warnings; `code_turn_send` still routes by provider/model and fails only on missing target-provider key.

## OpenAI retry policy

- `code_turn_send` uses reqwest timeout + retry with exponential backoff.
- Retries are attempted for:
  - transport failures (timeout/connect/request errors)
  - HTTP `429` and `5xx`
- Non-retryable errors are returned immediately.

## Turn routing contract (anti-rollback)

- `code_turn_send` accepts explicit `provider` and `modelId`.
- Supported provider values: `openai | anthropic | claude_code_local | google`.
- `claude_code_local` is a first-class native provider:
  - macOS-first in v1
  - requires a locally installed, already authenticated `claude` CLI
  - runs via `claude --print --verbose --output-format stream-json`
  - never falls back to cloud `anthropic` automatically
- Validation is strict:
  - unknown provider -> `INVALID_PARAMS`
  - provider/model mismatch -> `INVALID_PARAMS`
- Routing behavior:
  - provider + model -> route by explicit pair when consistent
  - provider only -> use provider default model (`gpt-5.3-codex` / `claude-sonnet-4-5` / `gemini-3.1-pro`)
  - `claude_code_local` uses the local Claude CLI default when no explicit model is selected
  - model only -> infer provider from model id
  - neither -> fallback to `CODE_RUNTIME_SERVICE_DEFAULT_MODEL`

## OpenAI-compatible gateway mode (Gemini/Claude)

- If `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL` is set:
  - model pool will try to read dynamic models from `{baseUrl}/models`
  - dynamic model catalog is cached in-process (TTL from `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS`) and stale cache is reused if refresh temporarily fails
  - `code_turn_send` will send turn execution through `{baseUrl}/chat/completions` for OpenAI/Anthropic/Google routed providers
- API key resolution order for compat calls:
  - provider-specific/oauth override (if available) -> `CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY` -> `OPENAI_API_KEY` -> provider-specific env key (`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`)
- When compat/env keys are not configured, model catalog discovery can still use enabled OAuth account keys from pool providers (`codex`, `claude_code`, `gemini`).

## Troubleshooting

- `/health=200` and `/ready=503`:
  - usually missing `OPENAI_API_KEY` or invalid endpoint/default model.
- `claude_code_local` unavailable in provider catalog:
  - install Claude Code locally or set `CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH`
  - run `claude` once to sign in before retrying
  - non-macOS hosts remain unavailable in v1 by design
- Frequent upstream timeout errors:
  - increase `CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS`
  - tune `CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES` and `...RETRY_BASE_MS`
