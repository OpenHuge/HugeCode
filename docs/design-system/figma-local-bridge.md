# Figma Local Bridge

This document defines the canonical Figma workflow for this repository.

The default path is the regular local plugin under `scripts/figma-json-bridge`. It does not depend
on Figma MCP, Dev Mode, paid seats, or a Figma personal access token for normal local design review.

## Why this exists

Use this workflow when an agent or contributor needs Figma design reference data but should stay on
the free, stable, reproducible path:

- regular Figma plugin under `scripts/figma-json-bridge`
- repo-generated token lookup map from the design-system pipeline
- local receiver under `scripts/figma-json-bridge/receiver.mjs`
- local artifacts written into `.figma-workflow/figma-exports`

## Canonical workflow

1. Prepare the free plugin assets:

   ```bash
   pnpm -C tools/figma bridge:prepare
   ```

2. Start the local receiver:

   ```bash
   pnpm -C tools/figma bridge:listen
   ```

3. In Figma Desktop, import the plugin manifest from:

   `scripts/figma-json-bridge/manifest.json`

4. Open the target file in Figma Desktop.
5. Select exactly one node.
6. Run `HugeCode Local Figma Bridge`.
7. Use `Token And Code Inspector` when you need repo-native token lookup.
8. Use `Export selection or target` when you need a local artifact bundle.
9. Use `Send last export to localhost` to materialize the current export under `.figma-workflow/figma-exports`.
10. Inspect the latest bundle locally:

```bash
pnpm -C tools/figma bridge:inspect
```

For link-driven agent work, resolve the Figma URL into the best local artifact before opening the
web canvas in automation:

```bash
pnpm -C tools/figma bridge:resolve --url "https://www.figma.com/design/..."
```

`pnpm -C tools/figma bridge:resolve` prefers, in order:

- an exact cached artifact for the node
- subtree materialization from a matching local source export for the same file
- an explicit REST fallback only when `--allow-fetch` is supplied

11. Run the governed downstream workflow:

    ```bash
    pnpm -C tools/figma pipeline:production
    ```

12. When the export is a page-scale design-system canvas, derive a family-level execution plan from
    the cached root export before attempting any live fetch:

    ```bash
    pnpm -C tools/figma pipeline:focus-plan --output docs/design-system/figma-focus-plan.linear-dark-mode.json
    pnpm -C tools/figma pipeline:focus-fetch --plan docs/design-system/figma-focus-plan.linear-dark-mode.json --families Button,Input,Select
    ```

`focus-fetch` prefers local child-artifact materialization from the matching root export before it
falls back to any live Figma request, so repeated local iteration can stay on the free path.

## Free token/code lookup

The plugin includes a `Token And Code Inspector` section that reads the repo-generated
`figmaCodegenMap` and maps bound Figma variable names back to:

- repo token paths
- CSS custom properties
- `vanilla-extract` contract access

This is the preferred local design-token lookup path. It runs inside the normal plugin surface and
does not depend on Dev Mode.

The inspector is intentionally conservative:

- exact and normalized suffix matching only
- no raw color-value guessing
- explicit `Unmapped` output when no bound variable names match the repo token map

## Output contract

Each successful export writes a bundle under `.figma-workflow/figma-exports`:

- `*.json`: full exported payload
- `*.png`: raster preview of the same node
- `*.svg`: vector preview of the same node
- `*.summary.json`: lightweight summary for quick inspection
- `*.manifest.json`: source and checksum manifest for staged pipeline consumers

The summary includes:

- file key
- page metadata
- selection metadata
- node count
- top node types
- top solid colors
- image references
- sample layer names
- preview availability flags

## Agent usage rules

- Prefer the local plugin path over Figma MCP and over tokenized REST fetches for normal local work.
- Prefer `pnpm -C tools/figma bridge:resolve --url <figma-link>` over browser automation when an agent starts from a Figma link.
- Treat the plugin inspector as the default path for design-token lookup.
- Treat exported artifacts as local reference material, not as the source of truth for styling tokens.
- Map visual decisions back to repository design tokens before implementing UI.
- Treat `workflowRecommendation.codegenSafe === false` as a hard stop for promotion-oriented codegen unless you intentionally rerun with `--force-codegen`.
- If the target file is a Community resource, duplicate it into a workspace you can open in Figma Desktop before exporting.
- Store reusable links in `docs/design-system/figma-reference-registry.json`.

## Validation and guardrails

- Run `pnpm -C tools/figma bridge:smoke` before relying on workflow changes. It validates the localhost receiver path, the plugin UI workflow, and the mocked headless fetch path against structured payloads.
- After any export intended for shared implementation work, run `pnpm -C tools/figma pipeline:production` and then `pnpm check:design-system:baseline` before promoting or applying scaffold output.
- Use the checked-in family focus plan for `8:2` at `docs/design-system/figma-focus-plan.linear-dark-mode.json` as the default queue for Linear design-system work.
- If outbound access to `api.figma.com` is unavailable, stay on the local plugin path and cached artifacts instead of retrying network fetches.

## Optional maintenance-only tooling

The following commands remain available for automation, fixture refresh, and controlled maintenance
work, but they are not the canonical local workflow:

- `pnpm -C tools/figma bridge:doctor`
- `pnpm -C tools/figma bridge:fetch`
- `pnpm -C tools/figma pipeline:focus-fetch`

Use the tokenized fetch path only when you intentionally need a fresh REST snapshot for a
registry-backed node and the local plugin export or artifact cache is insufficient.

## Tooling entrypoints

- `pnpm -C tools/figma bridge:listen`
- `pnpm -C tools/figma bridge:smoke`
- `pnpm -C tools/figma bridge:inspect`
- `pnpm -C tools/figma bridge:resolve`
- `pnpm -C tools/figma bridge:doctor`
- `pnpm -C tools/figma bridge:fetch`
- `pnpm -C tools/figma pipeline:classify`
- `pnpm -C tools/figma pipeline:tokens`
- `pnpm -C tools/figma pipeline:components`
- `pnpm -C tools/figma pipeline:variants`
- `pnpm -C tools/figma pipeline:specs`
- `pnpm -C tools/figma pipeline:plan`
- `pnpm -C tools/figma pipeline:codegen`
- `pnpm -C tools/figma pipeline:develop`
- `pnpm -C tools/figma pipeline:production`
- `pnpm -C tools/figma pipeline:focus-plan`
- `pnpm -C tools/figma pipeline:focus-fetch`
- `pnpm -C tools/figma pipeline:promote`
- `pnpm -C tools/figma pipeline:review`
- `pnpm -C tools/figma pipeline:apply`
- `pnpm -C tools/figma pipeline:run`
- `pnpm -C tools/figma pipeline:validate`

## Pipeline follow-up

The local bridge is Stage A only. After export, run the staged pipeline to produce:

- classified node graph
- primitive tokens
- semantic token mappings
- component inventory
- variant/state model
- component specifications
- generation plan
- codegen report and scaffold bundle
- optional promote pass into repo-native target paths
- promotion manifest and promotion review markdown
- promotion apply report
- QA report

If `pnpm` is blocked by a workspace dependency verification guard during one-off local tooling use,
the direct node entrypoints remain supported:

- `node scripts/figma-json-bridge/inspect.mjs`
- `node scripts/figma-pipeline/fetch-focus-batch.mjs --plan docs/design-system/figma-focus-plan.linear-dark-mode.json --families Button,Input,Select`
- `node scripts/figma-pipeline/production-workflow.mjs`

Canonical implementation notes live in:

- [figma-pipeline.md](./figma-pipeline.md)

## Local files

- [manifest.json](../../scripts/figma-json-bridge/manifest.json)
- [code.js](../../scripts/figma-json-bridge/code.js)
- [ui.html](../../scripts/figma-json-bridge/ui.html)
- [receiver.mjs](../../scripts/figma-json-bridge/receiver.mjs)
- [inspect.mjs](../../scripts/figma-json-bridge/inspect.mjs)
- [README.md](../../scripts/figma-json-bridge/README.md)
