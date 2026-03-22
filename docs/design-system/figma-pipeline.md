# Figma Pipeline

This document defines the repo-native staged pipeline that sits after the local Figma bridge.

## Goal

Turn a raw Figma export bundle into machine-readable intermediate artifacts that can drive token normalization, component abstraction, and governed implementation planning.

## Production entrypoint

Use the pipeline in this order for production-oriented work:

1. `pnpm -C tools/figma bridge:prepare`
2. `pnpm -C tools/figma bridge:listen`
3. Export through the Desktop plugin and inspect with `pnpm -C tools/figma bridge:inspect`
4. `pnpm -C tools/figma pipeline:production`
5. If the export is page-scale, generate a family focus plan and then fetch only the families you actually need
6. `pnpm -C tools/figma pipeline:develop` for the focused child export you intend to review or promote
7. Review the generated promotion markdown and manifest before any apply step
8. `pnpm check:design-system:baseline`
9. `pnpm -C tools/figma pipeline:apply` only for explicitly approved targets

Use `pnpm -C tools/figma bridge:doctor` and `pnpm -C tools/figma bridge:fetch` only when you intentionally need a
fresh REST snapshot for maintenance, fixture refresh, or controlled automation. They are no longer
the primary production handoff path.

The raw export manifest is part of the evidence chain. Do not discard it once downstream artifacts or scaffold reviews exist.

## Implementation Gate

Before continuing any shared component implementation or applying scaffold promotions into repo-native source paths, run:

- `pnpm check:design-system:baseline`

This gate is intentionally small and blocks the common false-positive failure mode where generated or hand-shaped component work looks complete in git history but the current workspace cannot actually render the verification fixture.

The gate currently requires:

- design-system barrel exports resolve to real source files in the current workspace
- the app design-system barrel resolves to real source files in the current workspace
- the app adapter barrel resolves to real source files when that barrel exists or is referenced by the app design-system barrel
- the `git-inspector-detail` fixture opens in Playwright
- the fixture no longer stalls on the boot fallback copy
- no Vite `500`, import-resolution failure, or `Cannot find module` error is observed during the fixture load

Run the same gate again after `pnpm -C tools/figma pipeline:apply` or any manual repo-native promotion/refinement step that changes shared component source files.

## Stages

1. `pnpm -C tools/figma pipeline:classify`
   Input: latest raw `*.json` export
   Output: `*.classified-node-graph.json`
2. `pnpm -C tools/figma pipeline:tokens`
   Input: raw export + classified graph
   Output: `*.primitive-tokens.json`, `*.semantic-tokens.json`
3. `pnpm -C tools/figma pipeline:components`
   Input: classified graph
   Output: `*.component-inventory.json`
4. `pnpm -C tools/figma pipeline:variants`
   Input: component inventory + classified graph + semantic tokens
   Output: `*.variant-state-model.json`
5. `pnpm -C tools/figma pipeline:specs`
   Input: variant/state model + component inventory + semantic tokens
   Output: `*.component-specs.json`
6. `pnpm -C tools/figma pipeline:plan`
   Input: component specs
   Output: `*.generation-plan.json`
7. `pnpm -C tools/figma pipeline:codegen`
   Input: generation plan + component specs
   Output: `*.codegen-report.json` plus scaffold files under `artifacts/figma-codegen/<export-name>/`
   Notes: family-aware scaffold templates now cover shared foundations, common form controls, navigation, feedback, and local adapter shells. App-adapter codegen emits family folders plus per-family `index.ts`, but does not author `apps/code/src/design-system/adapters/index.ts` or `apps/code/src/design-system/index.ts`.
8. `pnpm -C tools/figma pipeline:develop`
   Input: raw export bundle
   Output: staged artifacts + optional codegen report + optional promotion review artifacts
   Notes: safe developer entrypoint for `run -> codegen -> review`; now skips codegen by default when the export is `CANVAS`, `SECTION`, or an oversized `FRAME`, unless `--force-codegen` is explicitly provided
9. `pnpm -C tools/figma pipeline:production`
   Input: raw export bundle
   Output: either audit-only staged artifacts or the full develop flow, depending on export scope
   Notes: preferred production entrypoint after `pnpm -C tools/figma bridge:inspect`; keeps page-scale design-system references out of accidental promotion review
10. `pnpm -C tools/figma pipeline:focus-plan`
    Input: raw export bundle plus downstream `component-inventory` and `component-specs`
    Output: checked or ad hoc family-level focus plan JSON
    Notes: use after a page-scale audit export to derive the next component-scale fetch queue
11. `pnpm -C tools/figma pipeline:focus-fetch`
    Input: focus plan JSON
    Output: sequential fetch report plus fresh or cached raw artifact bundles for the selected families
    Notes: cache-first and serial by default; intended to reduce 429 risk on Starter-tier tokens
12. `pnpm -C tools/figma pipeline:promote`
    Input: generation plan + component specs + codegen promote flags
    Output: updated `*.codegen-report.json` plus optional repo-native scaffold promotion
    Notes: supports `--promote`, `--allow-review-targets`, `--overwrite`, and `--promote-root=<path>`
13. `pnpm -C tools/figma pipeline:review`
    Input: codegen report
    Output: `*.promotion-manifest.json` plus `*.promotion-review.md`
    Notes: review output carries forward app-adapter compatibility notes so promotion reviewers can wire approved families through the adapter barrel and root app design-system barrel.
14. `pnpm -C tools/figma pipeline:apply`
    Input: promotion manifest
    Output: `*.promotion-apply-report.json`
    Notes: apply copies only approved scaffold files. App-adapter barrel wiring remains an explicit follow-up step outside codegen/apply.
15. `pnpm -C tools/figma pipeline:validate`
    Input: generated artifacts
    Output: `*.qa-report.json`
16. `pnpm -C tools/figma pipeline:run`
    Runs the end-to-end pipeline on the latest export bundle.

## Output contracts

Schemas live under:

- `docs/design-system/schemas/raw-artifact-manifest.schema.json`
- `docs/design-system/schemas/classified-node-graph.schema.json`
- `docs/design-system/schemas/primitive-tokens.schema.json`
- `docs/design-system/schemas/semantic-tokens.schema.json`
- `docs/design-system/schemas/component-inventory.schema.json`
- `docs/design-system/schemas/variant-state-model.schema.json`
- `docs/design-system/schemas/component-specs.schema.json`
- `docs/design-system/schemas/generation-plan.schema.json`
- `docs/design-system/schemas/codegen-report.schema.json`
- `docs/design-system/schemas/promotion-manifest.schema.json`
- `docs/design-system/schemas/promotion-apply-report.schema.json`
- `docs/design-system/schemas/qa-report.schema.json`

## Current implementation boundary

This is the productionized foundation layer, not the finished greenfield extractor.

Current behavior:

- normalizes raw bridge output into a manifest-backed bundle
- classifies nodes into reusable graph roles
- extracts primitive token candidate collections
- creates semantic token mapping artifacts with explicit coverage
- detects repeated component candidates
- models family-level variants, sizes, tones, slots, and state axes
- emits machine-readable component specifications
- emits repo-native generation plans for `packages/design-system` and `apps/code`
- emits family-aware scaffold bundles for shared foundations, common controls, layout primitives, and app adapters
- treats app-adapter targets as compatibility-layer scaffolds that still require manual adapter-barrel and app-root-barrel wiring after promotion
- supports gated promotion into repo-native paths for codegen-ready targets
- emits review manifests and markdown summaries for scaffold acceptance
- applies only approved scaffold promotions via a separate controlled step
- provides a one-command developer flow via `pnpm -C tools/figma pipeline:develop`
- provides a scope-aware production flow via `pnpm -C tools/figma pipeline:production`
- validates artifacts against repo-backed schemas

Next upgrades should refine clustering, semantic inference, variant modeling, and codegen without replacing these contracts.

## Design Evidence Strength

Treat family implementation evidence in two explicit buckets:

| Evidence strength                                    | Families                                                                | Current expectation                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strong Figma / pipeline anchor                       | `Card`                                                                  | May continue refinement against the current pipeline artifact set because it has the clearest local Figma export and staged pipeline evidence path.                                                 |
| Repo-native extension of the current design language | `Button`, `Input`, `Tabs`, `Textarea`, `IconButton`, `Badge`, `Surface` | May be refined for correctness and consistency, but do not use them as justification to expand into new families without a stronger family-local design anchor or an explicit manual design review. |

This distinction exists to prevent agents from treating "looks coherent in code" as equivalent to "is supported by a strong Figma evidence chain".

## Family-Local Evidence Notes

Weak-anchor families may only gain stronger local evidence through a scoped, repo-native note that ties together:

- the current design anchor source
- the validated product surface
- the verification fixture or test surface
- the allowed maintenance boundary
- the explicitly forbidden expansion boundary

The first family-local note is:

- `Textarea`: [docs/design-system/family-evidence/textarea.md](./family-evidence/textarea.md)

Adding a family-local evidence note does not automatically upgrade that family into a strong anchor. It only makes the current evidence explicit so future work can decide whether refinement is safe or whether a dedicated Figma export is still required.

When a family-local note still shows missing `export`, `registry`, `artifact`, or `human-confirmation` layers, treat that note as a gap gate rather than as permission to expand the family.

## Production Defaults

The production workflow should treat raw exports in two modes:

- `audit`: for `CANVAS`, `SECTION`, shell-scale `FRAME`, or oversized exports. Use this mode to extract tokens, inspect hierarchy, and build review evidence without generating promotion-ready scaffolds.
- `develop`: for component-scale `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, or narrow `FRAME` exports that are small enough to map cleanly into the repository design-system families.

The intended flow is:

1. `pnpm -C tools/figma bridge:inspect`
2. `pnpm -C tools/figma pipeline:production`
3. If the workflow stays in audit mode, run `pnpm -C tools/figma pipeline:focus-plan` to derive the next family queue from the page export.
4. Use `pnpm -C tools/figma pipeline:focus-fetch --families <family,...>` to fetch only the child nodes you need, with cache-first sequential execution.
5. Run `pnpm -C tools/figma pipeline:develop <focused-export.json>` or `pnpm -C tools/figma pipeline:production <focused-export.json>` before attempting promotion-oriented codegen.

## Rate-limit strategy

Production use of free or Starter-tier Figma tokens should assume high-rate endpoints can return very long `Retry-After` windows.

The repo workflow now treats rate limits this way:

- raw node and image pulls are always cache-first
- retries are bounded and only automatic for short retry windows
- very large `Retry-After` values fail fast with plan-tier metadata instead of sleeping indefinitely
- page exports are converted into family focus plans so work can be spread across a small, explicit node queue
- the Desktop plugin path remains the fallback when the current token is locked out or quota-limited
