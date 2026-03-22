# Session Event Envelope v1

> Date: 2026-02-06
> Status: Frozen
> Owners: AG1, AG2, AG8
> Source: `docs/roadmap/agentic/parallel-development.md`

---

## Objective

Define a single event envelope for task/session streams across gateway, runtime, and UI.

---

## Contract

### Required Fields

- `schema_version`: must be `"session_event_envelope.v1"`.
- `event_id`: unique ID for idempotency.
- `event_type`: one of `plan_step`, `tool_call`, `approval`, `checkpoint`, `artifact`.
- `session_id`: session scope key.
- `agent_id`: producing agent identity.
- `channel_id`: routing partition key.
- `occurred_at`: ISO-8601 timestamp.
- `sequence`: monotonically increasing per `session_id + channel_id`.
- `payload`: event-specific object.

### Optional Fields

- `task_id`
- `correlation_id`
- `parent_event_id`
- `trace_id`
- `metadata`

---

## Ordering and Delivery Rules

- Producers must emit strictly increasing `sequence` per session/channel.
- Consumers must deduplicate by `event_id`.
- Replayed events must include `metadata.replayed = true`.
- Missing sequence gaps must trigger replay fetch before render/execute.

---

## JSON Schema (Normative)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SessionEventEnvelopeV1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "event_id",
    "event_type",
    "session_id",
    "agent_id",
    "channel_id",
    "occurred_at",
    "sequence",
    "payload"
  ],
  "properties": {
    "schema_version": { "const": "session_event_envelope.v1" },
    "event_id": { "type": "string", "minLength": 1 },
    "event_type": {
      "type": "string",
      "enum": ["plan_step", "tool_call", "approval", "checkpoint", "artifact"]
    },
    "session_id": { "type": "string", "minLength": 1 },
    "agent_id": { "type": "string", "minLength": 1 },
    "channel_id": { "type": "string", "minLength": 1 },
    "task_id": { "type": "string" },
    "correlation_id": { "type": "string" },
    "parent_event_id": { "type": "string" },
    "trace_id": { "type": "string" },
    "occurred_at": { "type": "string", "format": "date-time" },
    "sequence": { "type": "integer", "minimum": 1 },
    "payload": { "type": "object", "additionalProperties": true },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

---

## Example

```json
{
  "schema_version": "session_event_envelope.v1",
  "event_id": "evt_01JABCXYZ",
  "event_type": "plan_step",
  "session_id": "sess_42",
  "agent_id": "agent_main",
  "channel_id": "main",
  "task_id": "task_9",
  "occurred_at": "2026-02-06T10:00:00Z",
  "sequence": 17,
  "payload": {
    "step_id": "step_3",
    "status": "running",
    "title": "Build interface schemas"
  }
}
```
