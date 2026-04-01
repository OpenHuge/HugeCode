# WebMCP Auto-Resync From Activation Truth

## What Is Canonical Now

- WebMCP runtime tool publication continues to derive from workspace-scoped activation truth.
- `syncWebMcpAgentControl(...)` remains the pure publication primitive that reads current truth and republishes the browser catalog.
- UI orchestration in `WorkspaceHomeAgentControlCore` is now responsible for timing resyncs when runtime truth changes.

## What Changed In This Slice

- Added `useRuntimeWebMcpCatalogRevision(...)` as an app-local hook that listens to `runtime.updated` for the active workspace.
- The hook only reacts to `bootstrap` and `skills` scopes, debounces clustered updates, and returns a monotonically increasing revision token.
- `WorkspaceHomeAgentControlCore` now includes that revision token in the WebMCP sync effect dependencies, so activation-truth changes trigger a fresh catalog sync without waiting for incidental UI changes.
- `WorkspaceHomeAgentControlCore` also waits for workspace-local bridge state hydration before the first sync, which avoids publishing a transient catalog from default local state and then immediately republishing from restored workspace state.
- `WorkspaceHomeAgentWebMcpConsoleSection` now consumes the same revision token to refresh its displayed catalog after a publication resync, so the operator-facing console does not lag behind the bridge registration state.
- Failed auto-resync attempts preserve the last registered catalog and reuse the existing bridge status and error surface instead of tearing the bridge down.

## Scope Boundaries

- This remains workspace-only publication logic.
- Session overlays do not republish the browser catalog; they continue to apply only to execution- and resolution-scoped reads.
- No host RPC or WebMCP public contract changed in this slice.

## Remaining Gaps

- Raw diagnostic and debug transport remains intentionally outside the activation-backed publication path.
- Future phases can widen auto-resync only if there is evidence that additional `runtime.updated` scopes materially affect published runtime tools.
