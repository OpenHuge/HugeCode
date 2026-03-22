# IDE Bridge Contract v1

> Date: 2026-02-06
> Status: Frozen
> Owners: AG7, AG2
> Source: `docs/roadmap/agentic/parallel-development.md`

---

## Objective

Define stable deep-link and review anchor contracts between activity timeline, worktree state, and IDE surfaces.

---

## Contract

### Open-in-IDE Payload

- `schema_version`: `"ide_bridge.v1"`
- `session_id`
- `worktree_id`
- `path`
- `line`
- `column`
- `focus`: `editor | diff | terminal`

### Review Anchor Payload

- `anchor_id`
- `event_id`
- `path`
- `line_start`
- `line_end`
- `change_type`: `added | modified | deleted | moved`

---

## JSON Schema (Normative)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "IdeBridgeV1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "session_id", "worktree_id", "path", "line", "column", "focus"],
  "properties": {
    "schema_version": { "const": "ide_bridge.v1" },
    "session_id": { "type": "string", "minLength": 1 },
    "worktree_id": { "type": "string", "minLength": 1 },
    "path": { "type": "string", "minLength": 1 },
    "line": { "type": "integer", "minimum": 1 },
    "column": { "type": "integer", "minimum": 1 },
    "focus": {
      "type": "string",
      "enum": ["editor", "diff", "terminal"]
    },
    "event_id": { "type": "string" },
    "anchor_id": { "type": "string" },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

---

## Example

```json
{
  "schema_version": "ide_bridge.v1",
  "session_id": "sess_42",
  "worktree_id": "wt_7",
  "path": "apps/code/src/features/plan/components/DistributedTaskGraphPanel.tsx",
  "line": 132,
  "column": 9,
  "focus": "editor",
  "event_id": "evt_01JABCXYZ"
}
```

## Fallback Rules

- If `path` is missing due to rename, resolver may search by `anchor_id`.
- If exact line no longer exists, jump to nearest changed hunk.
- Failed resolution must return structured reason code.
