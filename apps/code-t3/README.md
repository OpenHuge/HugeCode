# HugeCode T3 UI Layer

`apps/code-t3/upstream` is a pinned copy of the T3CODE web UI. Treat it as vendored source:

- do not edit files under `upstream` directly
- keep HugeCode behavior in `src/shell/*`, `src/runtime/*`, `src/components/BrowserLaunchPage.tsx`, and `@ku0/code-t3-runtime-adapter`
- keep upstream chat shell alignment in `src/components/T3ChatWorkspaceChrome.tsx`; avoid mixing runtime orchestration into that component
- when updating T3CODE, refresh `upstream/UPSTREAM.json`, re-audit `upstream-sync.json`, then run `pnpm -C apps/code-t3 sync:status` and `pnpm -C apps/code-t3 sync:check`

`src/shell/T3CodeShell.tsx` is the stable local entry boundary. Keep launch routing,
query-param compatibility, and HugeCode-only host composition there so `src/main.tsx`
stays nearly static when upstream code is refreshed.

Use `pnpm -C apps/code-t3 sync:status` before pulling or replacing the upstream snapshot.
It prints local upstream drift and the overlay roots that should receive product work.
Use `pnpm -C apps/code-t3 sync:guard` when a branch is expected to contain no vendored
upstream edits outside a deliberate upstream refresh commit.

The long-term target is to replace local UI shims with upstream components. New runtime data should therefore use T3-shaped contracts first, then map to HugeCode runtime contracts at the adapter boundary.

`@ku0/code-t3-runtime-adapter` exposes a provider catalog that mirrors the upstream T3 `ServerProvider` model picker shape. Keep new composer/provider work on that catalog instead of reading HugeCode backend and model pools directly from React components; this keeps future upstream component swaps narrow.

`T3WorkspaceApp.tsx` is the HugeCode orchestration shell. `T3ChatWorkspaceChrome.tsx` is the low-intrusion upstream-aligned chat/composer facade. When upstream `ChatComposer`, `ProviderModelPicker`, or chat toolbar components change, update the facade first and keep browser/profile features in their existing runtime/browser modules.

Current sync watchpoints:

- `upstream/src/components/Sidebar.tsx`
- `upstream/src/components/chat/ChatComposer.tsx`
- `upstream/src/components/chat/ProviderModelPicker.tsx`
- `upstream/src/components/chat/ModelPickerContent.tsx`
- `upstream/src/providerModels.ts`

If any watchpoint changes, update the adapter or local shim before refreshing the hash in `upstream-sync.json`.
