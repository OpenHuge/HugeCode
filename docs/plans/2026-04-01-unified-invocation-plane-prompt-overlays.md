# Unified Invocation Plane Prompt Overlays Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish runtime prompt-library slash-command overlays into the unified invocation catalog and let composer slash discovery prefer the catalog over prompt-only UI assembly.

**Architecture:** Keep the frozen `InvocationDescriptor` contract unchanged. Normalize runtime prompt-library entries into `session_command` descriptors with overlay metadata at the catalog seam, then consume those descriptors from composer autocomplete while leaving prompt expansion/sending behavior in the existing prompt/slash-command path.

**Tech Stack:** TypeScript, React 19, Vitest, HugeCode runtime kernel facades, runtime prompt library bridge.

---

### Task 1: Add failing catalog tests for prompt-derived overlay invocations

**Files:**

- Modify: `apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- runtime prompt-library entries publish into `invocations.catalog`
- the published descriptors keep stable IDs and `InvocationDescriptor` shape
- prompt overlays carry slash-command metadata needed for discovery
- prompt overlays remain operator-visible and model-hidden

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/application/runtime/kernel/runtimeInvocationCatalog.test.ts --config vitest.config.ts`
Expected: FAIL because prompt-derived entries are not ingested yet.

**Step 3: Commit checkpoint**

Do not commit yet. Continue to implementation after the red state is confirmed.

### Task 2: Implement prompt overlay ingestion at the catalog seam

**Files:**

- Modify: `apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.ts`
- Modify: `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`
- Modify: `docs/plans/2026-03-31-unified-invocation-plane-track-a.md`

**Step 1: Write minimal implementation**

Add a prompt-list ingestion seam that:

- reads runtime prompt-library entries from app/runtime ports
- normalizes them into `InvocationDescriptor`
- stores slash overlay metadata in `metadata`
- keeps prompt-specific shapes inside the ingestion boundary

**Step 2: Keep precedence explicit**

Define prompt overlay precedence relative to:

- built-in runtime tools
- runtime extension tools
- plugin-derived descriptors
- compat session commands

**Step 3: Verify catalog tests pass**

Run: `pnpm exec vitest run src/application/runtime/kernel/runtimeInvocationCatalog.test.ts --config vitest.config.ts`
Expected: PASS

### Task 3: Add failing composer tests for catalog-backed slash discovery

**Files:**

- Modify: `apps/code/src/features/composer/hooks/useComposerAutocompleteState.test.tsx`
- Modify: `apps/code/src/features/composer/components/Composer.types.ts`
- Modify: `apps/code/src/features/composer/components/Composer.tsx`

**Step 1: Write the failing test**

Add tests that assert:

- composer slash autocomplete can consume prompt-derived entries from the unified invocation catalog
- catalog-derived slash items are preferred over prompt-only fallback assembly when available

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/composer/hooks/useComposerAutocompleteState.test.tsx --config vitest.config.ts`
Expected: FAIL because composer still only builds slash entries from prompt props.

### Task 4: Implement composer consumption of unified slash overlays

**Files:**

- Modify: `apps/code/src/features/composer/hooks/useComposerAutocompleteState.ts`
- Modify: `apps/code/src/features/composer/components/Composer.tsx`
- Modify: `apps/code/src/features/app/types/mainAppLayoutContracts.ts`
- Modify: `apps/code/src/features/app/hooks/layoutBridge/buildMainAppConversationAndComposerBridgeInput.ts`

**Step 1: Add the smallest runtime-facing prop**

Pass workspace context into composer so it can resolve the workspace invocation catalog.

**Step 2: Prefer catalog-backed slash entries**

Load the active catalog, derive slash autocomplete items from prompt overlay descriptors, and fall back to the existing prompt-only registry when catalog data is unavailable.

**Step 3: Keep send/expand behavior unchanged**

Do not move prompt expansion into the catalog. `expandCustomCommandText` remains the execution-side path.

**Step 4: Run focused tests**

Run:

- `pnpm exec vitest run src/features/composer/hooks/useComposerAutocompleteState.test.tsx --config vitest.config.ts`
- `pnpm exec vitest run src/application/runtime/kernel/runtimeInvocationCatalog.test.ts --config vitest.config.ts`

Expected: PASS

### Task 5: Validate, commit, push, and open the PR

**Files:**

- Review touched files only

**Step 1: Run targeted validation**

Run:

- `pnpm --filter @ku0/code typecheck`
- `pnpm --filter @ku0/code-runtime-host-contract typecheck`
- `pnpm ui:contract`
- `pnpm exec oxlint apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.ts apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.test.ts apps/code/src/features/composer/hooks/useComposerAutocompleteState.ts apps/code/src/features/composer/hooks/useComposerAutocompleteState.test.tsx apps/code/src/features/composer/components/Composer.tsx apps/code/src/features/composer/components/Composer.types.ts apps/code/src/features/app/hooks/layoutBridge/buildMainAppConversationAndComposerBridgeInput.ts apps/code/src/features/app/types/mainAppLayoutContracts.ts apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`

**Step 2: Commit**

```bash
git add docs/plans/2026-04-01-unified-invocation-plane-prompt-overlays.md \
  apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.ts \
  apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.test.ts \
  apps/code/src/application/runtime/kernel/createRuntimeKernel.ts \
  apps/code/src/features/composer/hooks/useComposerAutocompleteState.ts \
  apps/code/src/features/composer/hooks/useComposerAutocompleteState.test.tsx \
  apps/code/src/features/composer/components/Composer.tsx \
  apps/code/src/features/composer/components/Composer.types.ts \
  apps/code/src/features/app/hooks/layoutBridge/buildMainAppConversationAndComposerBridgeInput.ts \
  apps/code/src/features/app/types/mainAppLayoutContracts.ts \
  docs/plans/2026-03-31-unified-invocation-plane-track-a.md
git commit -m "feat: publish prompt overlays in the invocation catalog"
```

**Step 3: Push and open PR**

```bash
git push -u origin codex/unified-invocation-plane-track-a
gh pr create --fill
```
