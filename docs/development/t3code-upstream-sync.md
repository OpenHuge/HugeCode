# t3code Upstream Sync

`apps/code-t3` is HugeCode's t3code-derived frontend workspace. The active HugeCode code lives in
`apps/code-t3/src` and adapts to the existing Rust runtime through
`packages/code-t3-runtime-adapter`.

`apps/code-t3/upstream` is a vendored copy of `pingdotgg/t3code`'s `apps/web` source at the commit
recorded in `apps/code-t3/upstream/UPSTREAM.json`. Treat it as read-only generated input. The
running HugeCode frontend should stay a thin adapter shell that mirrors upstream UX structure,
tokens, and component behavior without importing HugeCode runtime calls into upstream files.

Do not scatter HugeCode-specific runtime calls through imported upstream UI files. Keep upstream
code under `apps/code-t3/upstream` when syncing, then move or wrap selected components through the
adapter boundary.

## Sync Command

```bash
node scripts/sync-t3code-upstream.mjs --ref=main
```

Use `--dry-run` to confirm the source and upstream commit before replacing
`apps/code-t3/upstream`.

After every sync:

1. Review upstream changes in `src/index.css`, `src/components/Sidebar.tsx`,
   `src/components/chat/ChatHeader.tsx`, `src/components/chat/MessagesTimeline.tsx`, and
   `src/components/chat/ChatComposer.tsx`.
2. Port UX/token/layout changes into `apps/code-t3/src` or a HugeCode-owned wrapper.
3. Keep provider, thread, task, event, diff, git, approval, and terminal mapping in
   `packages/code-t3-runtime-adapter`.
4. Run `pnpm --filter @ku0/code-t3 typecheck` and `pnpm --filter @ku0/code-t3 build`.

## Rules

- Preserve t3code's MIT license in `apps/code-t3/upstream/T3CODE_LICENSE`.
- Keep `apps/code-t3/upstream/UPSTREAM.json` with the synced commit.
- Do not edit `apps/code-t3/upstream/**` by hand except to refresh it with the sync script.
- Prefer changes in `packages/code-t3-runtime-adapter` for provider, thread, task, event, diff, and
  git mapping.
- `apps/code-t3` is the only controlled exception for t3code-style plain CSS or future Tailwind
  imports. Existing `apps/code` and shared packages still follow the vanilla-extract standard.
