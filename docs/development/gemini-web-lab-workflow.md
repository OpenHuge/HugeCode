# Gemini Web Lab Workflow

> Status: Active workflow specification
> Scope: Gemini web workflows inside HugeCode AI Web Lab
> Verification date: 2026-04-07

## Purpose

This workflow defines how HugeCode uses Gemini web as a first-class AI Web Lab provider for:

- canvas-driven prompt and document editing
- deep research synthesis
- GitHub import assisted context review
- Gems-based reusable workflow capture

## Recommended Entrypoints

Gemini entrypoints currently exposed by AI Web Lab:

- `canvas`
- `deep_research`
- `github_import`
- `gems`

The shell keeps these as stable entrypoint ids even if Google changes route shapes or navigation chrome.

## Artifact Strategy

Preferred Gemini artifact mapping:

- `canvas` -> `canvas_document`
- `deep_research` -> `research_brief`
- `gems` -> `workflow_instructions`
- `github_import` -> `canvas_document` or `share_link`, depending on what is extractable

Gemini extraction should prefer the latest structured content in the active `main` surface and fall back to normalized visible text when no code block or structured block is present.

## Session Guidance

- Use `managed` mode when you want HugeCode to perform canonical extraction.
- Use `attached` mode when you already have Gemini authenticated in a local Chrome profile and only need the HugeCode control surface plus debugger-backed continuity.

## Handoff Guidance

Gemini artifacts should usually flow back into:

- Mission Control draft when the artifact is the next execution instruction
- provider-aware decision lab when the artifact is comparative research
- saved prompt/template flow when the artifact is a reusable Gem-style workflow
