# Frozen Agentic Support Contracts

> Date: 2026-03-11
> Status: Frozen v1
> Owner: HugeCode (Code Runtime Support Contracts)

This folder stores frozen supporting interface contracts that still help the coding-agent runtime and gateway layer interoperate across clients and tooling.

These documents are supporting contracts, not a separate product line, platform taxonomy, or active workstream roster.

For active product cognition:

- Product definition and user-facing model live in `docs/prd.md` and `docs/specs/apps/code-product-shape-2026.md`.
- Runtime boundary and ownership live in `docs/specs/code-runtime-spec-2026.md`.
- Documents in this folder only define frozen support contracts that assist the current product loop of define, delegate, observe, review, and decide.

When these docs mention sessions, tasks, approvals, or bridges, read them as implementation support for the active product objects such as `Task`, `Run`, `Execution Profile`, and `Review Pack`, not as evidence of a broader standalone agent platform.

## Documents

- `docs/specs/agentic/session-event-envelope-v1.md`
- `docs/specs/agentic/mcp-auth-session-v1.md`
- `docs/specs/agentic/context-budget-v1.md`
- `docs/specs/agentic/skills-source-manifest-v1.md`
- `docs/specs/agentic/knowledge-index-v1.md`
- `docs/specs/agentic/ide-bridge-v1.md`

## Machine-Readable Schemas

- `docs/specs/agentic/session-event-envelope-v1.schema.json`
- `docs/specs/agentic/mcp-auth-session-v1.schema.json`
- `docs/specs/agentic/context-budget-v1.schema.json`
- `docs/specs/agentic/skills-source-manifest-v1.schema.json`
- `docs/specs/agentic/knowledge-index-v1.schema.json`
- `docs/specs/agentic/ide-bridge-v1.schema.json`

## Versioning Rules

- Breaking changes require a new versioned doc such as `*-v2.md`.
- Additive updates can be recorded as patch notes under the same version.
- Runtime payloads should continue to emit `schema_version` where the contract requires it.
