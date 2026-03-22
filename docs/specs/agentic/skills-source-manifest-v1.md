# Skills + Source Manifest v1

> Date: 2026-02-06
> Status: Frozen
> Owners: AG5, AG6
> Source: `docs/roadmap/agentic/parallel-development.md`

---

## Objective

Define installable skill/source manifest format for portability, trust validation, and compatibility checks.

---

## Contract

### Required Fields

- `schema_version`: `"skills_source_manifest.v1"`
- `id`, `name`, `version`
- `kind`: `skill | source`
- `publisher`: publisher identity
- `trust_level`: `verified | community | local`
- `signature`: detached signature string
- `compatibility`: runtime/app version constraints

### Optional Fields

- `entrypoint`
- `permissions`
- `mcp_servers`
- `resources`
- `digest`

### Validation Rules

- Install is blocked if signature validation fails.
- Install is blocked if compatibility constraints fail.
- Upgrades must preserve backward-compatible command names unless major version changes.

---

## JSON Schema (Normative)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SkillsSourceManifestV1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "id",
    "name",
    "version",
    "kind",
    "publisher",
    "trust_level",
    "signature",
    "compatibility"
  ],
  "properties": {
    "schema_version": { "const": "skills_source_manifest.v1" },
    "id": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "version": { "type": "string", "minLength": 1 },
    "kind": { "type": "string", "enum": ["skill", "source"] },
    "publisher": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "url": { "type": "string" }
      },
      "additionalProperties": false
    },
    "trust_level": {
      "type": "string",
      "enum": ["verified", "community", "local"]
    },
    "signature": { "type": "string", "minLength": 1 },
    "digest": { "type": "string" },
    "entrypoint": { "type": "string" },
    "permissions": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "mcp_servers": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "resources": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "compatibility": {
      "type": "object",
      "required": ["min_runtime"],
      "properties": {
        "min_runtime": { "type": "string" },
        "max_runtime": { "type": "string" },
        "min_app": { "type": "string" },
        "max_app": { "type": "string" }
      },
      "additionalProperties": false
    }
  }
}
```

---

## Example

```json
{
  "schema_version": "skills_source_manifest.v1",
  "id": "com.hugecode.git-pr-review",
  "name": "Git PR Review",
  "version": "1.2.0",
  "kind": "skill",
  "publisher": { "name": "HugeCode Labs", "url": "https://hugecode.example" },
  "trust_level": "verified",
  "signature": "base64:...",
  "compatibility": { "min_runtime": "0.24.0", "min_app": "0.19.0" },
  "permissions": ["repo.read", "git.exec"]
}
```
