# Merge Queue PR Flow Design

**Date:** 2026-03-26

**Problem**

`main` currently uses classic branch protection with strict required status checks. The repository has no rulesets and no merge queue configured. With `strict: true`, every merge to `main` can invalidate the merge base for other open PRs, which forces repeated `Update branch` churn, duplicate CI runs, and slow agent iteration.

**Evidence**

- Branch protection for `main` currently reports `required_status_checks.strict: true`.
- Repository rulesets are empty, so merge queue is not active.
- Recent PR runs show the fast path (`Quality / Quality` and `PR Affected Checks / PR Affected Checks`) finishing in roughly 1-4 minutes for light changes, while broader PR scopes still fan out into longer optional lanes. Even when the required gates are green, strict branch protection still forces branch refresh churn after unrelated merges.
- GitHub documents merge queue as the path for repositories that want required checks to validate the latest base branch without requiring authors to manually keep every PR branch up to date.

**Options**

1. Keep strict required checks and automate `update branch` harder.
   This reduces manual work but preserves the fundamental rerun churn after every merge.

2. Disable strict up-to-date enforcement without a queue.
   This removes branch refresh churn but weakens confidence that a PR was validated against the latest branch state.

3. Move `main` to merge queue and stop branch-maintenance automation from updating branches when queue semantics are active.
   This keeps latest-base validation while removing repeated PR-branch refresh churn from the author workflow.

**Recommendation**

Adopt option 3.

**Design**

1. Repository merge-control model

- Enable merge queue for `main`.
- Keep stable aggregate required checks: `Quality / Quality` and `PR Affected Checks / PR Affected Checks`.
- Continue running those gates on both `pull_request` and `merge_group`, which the repo already supports in `ci.yml`.
- Let approved PRs enter the queue through the existing auto-merge path instead of requiring direct merges.

2. Workflow behavior changes

- Keep `PR Auto Merge` as the approval-driven entrypoint.
- Make `PR Branch Maintenance` queue-aware:
  - when merge queue semantics are enabled, do not call `gh pr update-branch`
  - still surface `DIRTY` PRs for manual conflict resolution
  - still skip fork PRs, draft PRs, unapproved PRs, unresolved-thread PRs, and `manual-merge` PRs
- Preserve workflow summary output so operators can still see which PRs are blocked by real conflicts versus policy.

3. Documentation changes

- Update CI workflow docs and development docs to describe merge queue as the default `main` merge path.
- Document that branch-refresh automation is only a compatibility path for classic strict protection, not for queue mode.

4. Validation

- Add or update workflow tests to assert queue-aware behavior in `pr-branch-maintenance.yml`.
- Run targeted workflow-governance tests plus `pnpm check:workflow-governance`.

**Non-Goals**

- Re-architecting all CI lanes in this change.
- Replacing the current aggregate check names.
- Auto-resolving merge conflicts.

**Expected Outcome**

- Merging one PR should no longer force all other healthy PRs to manually update their branches.
- Agents can iterate on approved PRs by waiting for queue admission instead of re-running branch refresh loops.
- Required checks still validate queue heads against the latest `main` state.
