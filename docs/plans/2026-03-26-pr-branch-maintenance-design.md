# PR Branch Maintenance Design

**Problem**

Approved in-repo pull requests frequently stall after `main` moves forward. The repository already enables auto-merge for approved repo PRs, but the current automation does not proactively update a PR branch when GitHub reports `mergeStateStatus=BEHIND`. As a result, maintainers end up doing repetitive `Update branch` work by hand, while truly conflicting PRs remain mixed into the same backlog.

**Goal**

Reduce manual PR babysitting by automatically updating eligible PR branches with GitHub's native branch-update behavior, while keeping true merge conflicts visible without attempting risky automatic conflict resolution.

**Scope**

- Act only on repo-hosted pull requests
- Act only on non-draft PRs
- Act only on PRs with `reviewDecision=APPROVED`
- Act only when all review threads are resolved
- Respect the existing `manual-merge` opt-out label
- Use GitHub-native branch update semantics instead of local merge or rebase automation
- Surface `DIRTY` PRs in workflow output, but do not mutate them

**Recommended Architecture**

Add a dedicated public workflow, `pr-branch-maintenance.yml`, separate from `pr-auto-merge.yml`.

The new workflow has two modes:

1. Event mode for a single PR
   Trigger on `pull_request_target` and `pull_request_review` to react when a PR becomes newly eligible.

2. Sweep mode for the repository
   Trigger on `push` to `main` plus `workflow_dispatch` to scan current open PRs after the base branch moves forward.

Both modes use the same evaluation rules and the same side effect:

- If the PR is eligible and `mergeStateStatus=BEHIND`, run `gh pr update-branch <number>`
- If the PR is eligible and `mergeStateStatus=DIRTY`, record it in the workflow summary
- Otherwise skip with an explicit reason

**Why a Separate Workflow**

- It keeps branch-maintenance behavior independent from auto-merge enabling
- It avoids overloading `pr-auto-merge` with repository-wide sweep logic
- It makes operational debugging easier because update-branch actions and skip reasons have their own run history

**Risk Controls**

- No local merge or rebase bot behavior
- No automation for fork PRs
- No automation for unresolved review feedback
- No automation for `manual-merge` PRs
- No attempt to auto-resolve conflicts
- Explicit concurrency so only one maintenance run per PR or sweep context is active

**Validation**

- Add workflow-structure regression coverage in `tests/scripts`
- Run targeted workflow governance tests
- Run `pnpm check:workflow-governance`
