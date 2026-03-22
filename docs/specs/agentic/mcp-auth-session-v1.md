# MCP Auth + Session Contract v1

> Date: 2026-02-06
> Status: Frozen
> Owners: AG3, AG1
> Source: `docs/roadmap/agentic/parallel-development.md`

---

## Objective

Standardize MCP auth lifecycle, consent mode, and session binding to avoid token/policy drift.

---

## Contract

### Session Binding

- Each MCP credential must bind to `session_id` and `server_id`.
- Cross-session reuse is denied unless explicitly marked shareable.

### Required Fields

- `schema_version`: `"mcp_auth_session.v1"`
- `session_id`
- `server_id`
- `auth_mode`: `oauth2 | api_key | local`
- `consent_mode`: `allow | ask | deny`
- `policy_tag_set`: array of policy tags
- `token_state`: `active | expiring | expired | revoked | invalid_scope`

### Refresh and Retry Rules

- Expired token may attempt refresh up to 2 retries with backoff.
- `revoked` and `invalid_scope` must not auto-retry.
- Any retry must emit an audit event with decision metadata.

---

## JSON Schema (Normative)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "McpAuthSessionV1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "session_id",
    "server_id",
    "auth_mode",
    "consent_mode",
    "policy_tag_set",
    "token_state"
  ],
  "properties": {
    "schema_version": { "const": "mcp_auth_session.v1" },
    "session_id": { "type": "string", "minLength": 1 },
    "server_id": { "type": "string", "minLength": 1 },
    "auth_mode": {
      "type": "string",
      "enum": ["oauth2", "api_key", "local"]
    },
    "consent_mode": {
      "type": "string",
      "enum": ["allow", "ask", "deny"]
    },
    "policy_tag_set": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "token_state": {
      "type": "string",
      "enum": ["active", "expiring", "expired", "revoked", "invalid_scope"]
    },
    "expires_at": { "type": "string", "format": "date-time" },
    "last_refresh_at": { "type": "string", "format": "date-time" },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

---

## Example

```json
{
  "schema_version": "mcp_auth_session.v1",
  "session_id": "sess_42",
  "server_id": "github-mcp",
  "auth_mode": "oauth2",
  "consent_mode": "ask",
  "policy_tag_set": ["repo.read", "issues.write"],
  "token_state": "active",
  "expires_at": "2026-02-06T12:00:00Z"
}
```
