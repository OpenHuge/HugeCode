# Context Budget Contract v1

> Date: 2026-02-06
> Status: Frozen
> Owners: AG4, AG2, AG8
> Source: `docs/roadmap/agentic/parallel-development.md`

---

## Objective

Define consistent token budget and compaction signals across runtime, UI, and operations.

---

## Contract

### Required Fields

- `schema_version`: `"context_budget.v1"`
- `session_id`
- `limits`: per-bucket limits (`prompt`, `history`, `tool_output`, `total`)
- `usage`: current usage per bucket
- `policy`: `warn | compact | stop`
- `compaction_state`: `none | pending | completed | failed`

### Compaction Rules

- Runtime must emit reason code for every compaction trigger.
- Compacted summaries must reference source range IDs.
- `stop` policy must block new tool calls until manual resume or policy change.

---

## JSON Schema (Normative)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ContextBudgetV1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "session_id", "limits", "usage", "policy", "compaction_state"],
  "properties": {
    "schema_version": { "const": "context_budget.v1" },
    "session_id": { "type": "string", "minLength": 1 },
    "limits": {
      "type": "object",
      "required": ["prompt", "history", "tool_output", "total"],
      "properties": {
        "prompt": { "type": "integer", "minimum": 0 },
        "history": { "type": "integer", "minimum": 0 },
        "tool_output": { "type": "integer", "minimum": 0 },
        "total": { "type": "integer", "minimum": 1 }
      },
      "additionalProperties": false
    },
    "usage": {
      "type": "object",
      "required": ["prompt", "history", "tool_output", "total"],
      "properties": {
        "prompt": { "type": "integer", "minimum": 0 },
        "history": { "type": "integer", "minimum": 0 },
        "tool_output": { "type": "integer", "minimum": 0 },
        "total": { "type": "integer", "minimum": 0 }
      },
      "additionalProperties": false
    },
    "policy": {
      "type": "string",
      "enum": ["warn", "compact", "stop"]
    },
    "compaction_state": {
      "type": "string",
      "enum": ["none", "pending", "completed", "failed"]
    },
    "last_compaction_reason": { "type": "string" },
    "lineage_ids": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

---

## Example

```json
{
  "schema_version": "context_budget.v1",
  "session_id": "sess_42",
  "limits": {
    "prompt": 20000,
    "history": 80000,
    "tool_output": 30000,
    "total": 100000
  },
  "usage": {
    "prompt": 19000,
    "history": 64000,
    "tool_output": 12000,
    "total": 95000
  },
  "policy": "compact",
  "compaction_state": "pending",
  "last_compaction_reason": "history_bucket_threshold"
}
```
