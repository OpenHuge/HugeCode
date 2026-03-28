# ChatGPT Workspace Automation Facade Boundary Design

## Goal

Align ChatGPT browser automation with the runtime boundary direction established by PR #141 and PR #142.
Feature code in settings should depend on one approved runtime facade entrypoint instead of importing the implementation module directly.

## Problem

`apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx`,
`apps/code/src/features/settings/components/sections/settings-codex-accounts-card/useCodexAccountActions.ts`,
and their tests currently import `application/runtime/facades/chatgptWorkspaceAutomation` directly.

That file currently mixes two concerns:

1. approved product-facing actions and result types for settings workflows
2. internal implementation details for local Chrome debugger discovery, ChatGPT target resolution, remote account identity reads, and leave execution

This is inconsistent with the architecture direction from PR #141 and PR #142:

- feature code should consume a single approved facade or hook entrypoint
- compatibility and implementation details should stay behind a narrower runtime boundary
- boundary guards should prevent future imports from bypassing the approved path

## Design

### Approved entrypoint

Add a new facade file:

- `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomationFacade.ts`

This file becomes the approved feature-facing entrypoint for settings/product code.
It will re-export the runtime-facing types that settings needs and expose the two product actions:

- `reviewDeactivatedChatgptWorkspaces`
- `leaveDeactivatedChatgptWorkspaces`

Feature code should import from this facade file only.

### Internal implementation

Keep `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.ts` as the implementation module.
It remains responsible for:

- `WithDeps` testable helpers
- local Chrome DevTools endpoint discovery
- remote ChatGPT account/workspace inspection
- sequential leave execution

The implementation file should no longer be the approved dependency surface for feature code.

### Feature adaptation

Update settings consumers to use the new approved facade:

- `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx`
- `apps/code/src/features/settings/components/sections/settings-codex-accounts-card/useCodexAccountActions.ts`
- `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

Tests should mock the facade file, not the implementation file.

### Boundary enforcement

Extend the UI/runtime boundary guard so product code cannot import the implementation module directly.

Rule intent:

- allow `application/runtime/facades/chatgptWorkspaceAutomationFacade`
- reject direct imports of `application/runtime/facades/chatgptWorkspaceAutomation`
  from UI/product code outside runtime architecture internals and tests

Add focused tests in `tests/scripts/ui-service-boundary.test.ts`.

## Why This Is The Best Fit

This follows the same architectural pattern already used for runtime session command access:

- one approved feature-facing facade path
- implementation details retained inside `application/runtime/*`
- guard coverage so the boundary stays stable

It improves boundary clarity without introducing extra ports or speculative abstractions for a workflow that still only has one active feature consumer.

## Non-Goals

- no new browser automation runtime contract
- no split into multiple micro-ports for debugger discovery, target navigation, and leave execution
- no UI behavior change for the settings flow
- no expansion of ChatGPT cleanup into a broader browser automation subsystem

## Validation

At minimum:

- targeted Vitest for settings card and runtime facade coverage
- `pnpm exec vitest run tests/scripts/ui-service-boundary.test.ts`
- `node scripts/check-ui-service-boundary.mjs`
- matching repo validation gate after implementation
