# Governed GitHub PR Review-Comment Execution Slice

Date: 2026-03-31

This note records the thin supervised GitHub-to-review slice that is now treated as the canonical golden path in `apps/code`.

## Supported Source Type

- `pull_request_review_comment_command`
- normalized into `taskSource.kind = "github_pr_followup"`
- launched through the same governed runtime prepare/start lane as other canonical runtime runs

This is intentionally narrower than generic GitHub automation. It is the operator-supervised PR review-comment follow-up path only.

## Golden Path Map

1. Desktop Git UI selects a PR review comment follow-up.
2. `githubCommentSourceLaunchNormalization` normalizes the source into canonical `taskSource` + GitHub provenance.
3. `githubSourceGovernedLaunch` builds the governed runtime request with repository execution defaults and supervised autonomy policy.
4. `code_runtime_run_prepare_v2` remains the authoritative preparation step.
5. The subsequent start request is derived from preparation truth, not replayed from the raw prepare request:
   - `approvedPlanVersion` is attached from runtime preparation
   - the mission brief is enriched with runtime plan metadata
   - GitHub launch-handshake provenance is advanced to `started`
6. Runtime run/review truth carries the same GitHub provenance into review surfaces.
7. Review Pack actionability, relaunch defaults, and follow-up actions continue from runtime-owned truth.
8. Review surfaces expose the GitHub closure policy from the active review profile so the operator can close the loop coherently.

## What Is Coherent End-To-End Now

- One governed GitHub intake path reaches the canonical runtime `prepare_v2 -> start_v2` lane.
- Backend preference resolution for the start step stays inside runtime execution facades.
- GitHub source provenance survives from intake through launch-handshake, run truth, review truth, and intervention defaults.
- Review/actionability continues to consume runtime-published review truth rather than page-local fallback reconstruction.
- The operator can move from PR review-comment intake to Review Pack follow-up and closure guidance inside one canonical workflow.

## Intentionally Out Of Scope

- unattended GitHub polling or schedulers
- bulk issue or PR triage automation
- repo-wide autonomous sweeps
- non-supervised continuation after GitHub intake
- browser extraction or control-plane/plugin expansion
- broader GitHub source-type parity beyond the PR review-comment golden path
