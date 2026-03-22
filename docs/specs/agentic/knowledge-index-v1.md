# Knowledge Index API v1

> Date: 2026-02-06
> Status: Frozen
> Owners: AG6, AG8
> Source: `docs/roadmap/agentic/parallel-development.md`

---

## Objective

Define canonical API payloads for source ingest, indexing lifecycle, and retrieval telemetry.

---

## Resource Model

### KnowledgeSource

- `source_id`
- `session_id`
- `kind`: `file | directory | mcp | api`
- `status`: `queued | indexing | ready | failed | paused`
- `retention_policy`

### RetrievalMetrics

- `query_id`
- `latency_ms`
- `hit_count`
- `coverage_score` (0-1)
- `quality_score` (0-1)

---

## API Payload Contracts

### Ingest Request

```json
{
  "schema_version": "knowledge_index.v1",
  "session_id": "sess_42",
  "source": {
    "kind": "directory",
    "uri": "file:///workspace/docs",
    "retention_policy": "session"
  }
}
```

### Ingest Response

```json
{
  "schema_version": "knowledge_index.v1",
  "source_id": "src_abc",
  "status": "queued"
}
```

### Retrieval Request

```json
{
  "schema_version": "knowledge_index.v1",
  "session_id": "sess_42",
  "query": "find MCP auth retry policy",
  "limit": 8,
  "filters": {
    "source_ids": ["src_abc"],
    "min_score": 0.6
  }
}
```

### Retrieval Response

```json
{
  "schema_version": "knowledge_index.v1",
  "query_id": "qry_123",
  "results": [
    {
      "source_id": "src_abc",
      "uri": "file:///workspace/docs/spec.md",
      "score": 0.87,
      "snippet": "..."
    }
  ],
  "metrics": {
    "latency_ms": 121,
    "hit_count": 1,
    "coverage_score": 0.72,
    "quality_score": 0.81
  }
}
```

---

## Lifecycle Rules

- `queued -> indexing -> ready` is the happy path.
- `failed` requires error code and retry hint.
- Retrieval should return metrics even on empty results.
