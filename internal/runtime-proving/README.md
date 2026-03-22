# Internal Runtime Proving

`internal/runtime-proving` hosts the runtime replay and nightly robustness commands that were previously exposed at the repo root.

The only root entrypoint that remains is:

- `pnpm runtime:prove`

Everything else in this lane should be run explicitly through `pnpm -C internal/runtime-proving ...`.

## Commands

- `pnpm -C internal/runtime-proving workflow:list`
- `pnpm -C internal/runtime-proving replay:intake`
- `pnpm -C internal/runtime-proving replay:nightly`
- `pnpm -C internal/runtime-proving replay:list`
- `pnpm -C internal/runtime-proving replay:lineage`
- `pnpm -C internal/runtime-proving replay:golden`
- `pnpm -C internal/runtime-proving replay:smoke`
- `pnpm -C internal/runtime-proving replay:rerecord`
- `pnpm -C internal/runtime-proving replay:lint`
- `pnpm -C internal/runtime-proving provider:record`
- `pnpm -C internal/runtime-proving provider:validate`

## Boundary

- Root `package.json` no longer exposes the detailed replay lane.
- Nightly CI should call `pnpm runtime:prove` instead of individual replay scripts.
- The implementation layer remains under `scripts/` for now; this wave only removes the root-first-class surface.
