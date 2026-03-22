# Internal Figma Tools

`tools/figma` hosts the internal Figma bridge and pipeline commands for this repo.

These commands are intentionally excluded from the root default product workflows.
Run them only when design-tooling work is explicitly in scope.

## Commands

- `pnpm -C tools/figma workflow:list`
- `pnpm -C tools/figma bridge:prepare`
- `pnpm -C tools/figma bridge:listen`
- `pnpm -C tools/figma bridge:inspect`
- `pnpm -C tools/figma bridge:resolve`
- `pnpm -C tools/figma pipeline:production`
- `pnpm -C tools/figma pipeline:develop`
- `pnpm -C tools/figma pipeline:run`

## Boundary

- Root `package.json` does not expose these commands.
- `scripts/figma-json-bridge` and `scripts/figma-pipeline` remain the implementation layer for now.
- If the tooling survives the freeze window, the next step is moving implementation files under `tools/figma/`.
