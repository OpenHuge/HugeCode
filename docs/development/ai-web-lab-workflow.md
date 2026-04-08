# AI Web Lab Workflow

> Status: Active workflow specification
> Scope: Multi-provider AI web workflows before repo execution in HugeCode runtime or Codex
> Verification date: 2026-04-07

## Purpose

This workflow defines how HugeCode uses provider web surfaces such as ChatGPT and Gemini for:

- prompt refinement
- long-form canvas editing
- research synthesis
- reusable workflow capture
- final artifact handoff into Mission Control

The workflow keeps browser-side ideation and context shaping on provider web surfaces while reserving repo edits, validation, and execution for HugeCode runtime and Codex.

## Working Model

AI Web Lab is provider-neutral at the shell level and provider-specific at the adapter level.

Current first-class providers:

- ChatGPT
- Gemini

Shared workflow phases:

1. Select provider and entrypoint in AI Web Lab.
2. Use the provider surface for ideation, canvas editing, or research.
3. Extract one final artifact back into HugeCode.
4. Hand that artifact into Mission Control draft, decision lab, or a reusable prompt/template flow.

## Provider Capabilities

AI Web Lab currently models provider web capability through these categories:

- `persistent_project`
- `editable_canvas`
- `deep_research`
- `repo_context_import`
- `reusable_workflow`
- `artifact_export`

Adapters may expose different entrypoints, but the shell should stay stable as providers evolve.

## Session Modes

- `managed`
  HugeCode opens a provider session in an Electron-managed persistent partition.
- `attached`
  HugeCode attaches to a local Chrome session discovered through the existing debugger path.

Managed mode is the default because it supports canonical artifact extraction.

## View Modes

- `docked`
  HugeCode keeps the control surface in Mission Control and uses a managed window for the live provider session.
- `window`
  HugeCode prefers a dedicated provider window.

## Artifact Handoff

Current artifact kinds:

- `prompt_markdown`
- `canvas_document`
- `research_brief`
- `workflow_instructions`
- `share_link`

Preferred handoff targets:

- Mission Control draft
- provider-aware decision lab
- saved prompt/template flow
- clipboard-only fallback

## Future Direction

The product direction assumes provider web surfaces will continue converging around:

- persistent project context
- editable long-form workspaces
- research-oriented tasks
- imported external context
- reusable workflows

AI Web Lab should keep its shell and contracts capability-based so new providers can be added without rebuilding the Mission Control surface.
