# Pi-Mono Borrowing Analysis

Date: 2026-03-25
Status: active working doc
Branch: `feat/pi-mono-borrowing-analysis`
HugeCode baseline: `origin/main` @ `cf3e5bcf90aef4ddbd45f037121befea932818bb`
Pi-mono baseline: `badlogic/pi-mono` `main` @ `629341c18f3482d891b665a844975096b47b4779`
Release calibration: `v0.62.0` published 2026-03-23

## Intent

This branch is a docs-only research branch.

Its purpose is to refresh HugeCode's understanding of the current `pi-mono` source tree and to
turn that reading into a concrete borrowing decision pack. It does not change runtime contracts,
frontend runtime facades, Rust runtime behavior, or public TypeScript APIs.

## Exact Environment Decisions

- HugeCode work was isolated in `../HugeCode-pi-mono-borrowing-analysis`
- the branch was created from remote `main`, not from the current diverged worktree
- the working branch tracks `origin/main` but starts at the exact fetched commit
  `cf3e5bcf90aef4ddbd45f037121befea932818bb`
- the external reference checkout lives at `/Users/han/Documents/Code/document/code/github/pi-mono`
- the external repository was pinned to detached `HEAD` at
  `629341c18f3482d891b665a844975096b47b4779` for reproducible analysis

## Command Log

Commands run during setup:

```bash
git fetch origin main
git ls-remote origin refs/heads/main
git worktree add ../HugeCode-pi-mono-borrowing-analysis -b feat/pi-mono-borrowing-analysis origin/main

mkdir -p /Users/han/Documents/Code/document/code/github
git clone https://github.com/badlogic/pi-mono.git /Users/han/Documents/Code/document/code/github/pi-mono
git -C /Users/han/Documents/Code/document/code/github/pi-mono rev-parse HEAD
git -C /Users/han/Documents/Code/document/code/github/pi-mono describe --tags --abbrev=0
git -C /Users/han/Documents/Code/document/code/github/pi-mono checkout 629341c18f3482d891b665a844975096b47b4779
```

Verification commands used for baseline capture:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

## Updated Findings

### 1. `pi-mono` is no longer best read as a HugeCode-like runtime architecture

The current public `main` branch is strongest as:

- a provider/model layer in `pi-ai`
- a generic evented agent loop in `pi-agent-core`
- a coding harness in `pi-coding-agent`
- optional shell technologies in `pi-tui` and `pi-web-ui`

That is useful for HugeCode, but it is not a reason to weaken runtime-owned mission, review, or
continuity truth.

### 2. The highest-value borrowing target is `pi-agent-core`

The most directly useful ideas are:

- structured event vocabulary for agent and tool lifecycle
- `beforeToolCall` and `afterToolCall` lifecycle hooks
- explicit `transformContext` then `convertToLlm` boundary
- configurable `parallel` vs `sequential` tool execution

### 3. The second highest-value borrowing target is `pi-coding-agent`

The most directly useful ideas are:

- disciplined skill and extension loading
- package/resource loader boundaries
- session tree and compaction ergonomics
- clean separation between interactive mode, RPC mode, and SDK surface

### 4. HugeCode should not borrow `pi-mono`'s truth model

Explicit non-goals:

- do not replace runtime truth with local harness truth
- do not move review or continuity into local session ownership
- do not borrow the `pi-web-ui` stack choices

## Borrowing Priority

### Copy Directly

1. Agent/tool event taxonomy.
2. Hookable pre/post tool lifecycle model.
3. Resource loading discipline for skills and extensions.

### Adapt

1. Session tree, fork, and compaction UX.
2. Model/provider registry ergonomics.
3. SDK-style reusable composition boundaries.

### Defer

1. TUI-first interaction model.
2. Standalone `pi-web-ui` shell ideas.
3. `pi-pods` and `pi-mom` product surfaces.

### Reject

1. Tailwind plus `mini-lit` plus web-components stack.
2. CLI-local session state as canonical execution truth.
3. Monolithic harness ownership of review and continuation semantics.

## Recommended Follow-On Slice

The first implementation after this research should define a HugeCode-specific runtime/app-facing
event vocabulary and tool lifecycle hook model inspired by `pi-agent-core`.

It should stay inside approved application/runtime boundaries and remain proposal-first before any
runtime contract changes.

## 2026 Product Signals Checked On 2026-03-25

Official sources reviewed during this branch:

- OpenAI Codex launch and product updates
  - https://openai.com/index/introducing-codex/
  - https://openai.com/index/codex-now-generally-available/
  - https://openai.com/index/introducing-gpt-5-2-codex/
- Anthropic Claude Code product page and 2026 trends report
  - https://claude.com/product/claude-code
  - https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf
- GitHub Copilot coding agent docs
  - https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent
  - https://docs.github.com/en/copilot/how-tos/use-copilot-agents/manage-agents
  - https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- Devin docs
  - https://docs.devin.ai/api-reference/v1/overview

### Product patterns that now look durable

1. Parallel async task execution is becoming the default shape.

   OpenAI and Anthropic are both leaning into multiple concurrent tasks rather than a single
   foreground loop. Anthropic's 2026 report also predicts single agents giving way to coordinated
   agent teams, with environments expected to expose concurrent session state and version-control
   friendly workflows.

2. Session logs, steering, and handoff are now table stakes.

   Codex emphasizes verifiable logs and test evidence. GitHub emphasizes session logs, steering,
   redirecting active sessions, and opening a session in local CLI or IDE. Devin exposes sessions
   as a first-class API primitive. HugeCode should assume operators expect resumable and inspectable
   sessions rather than opaque task runs.

3. Skills, hooks, and specialized agent profiles are becoming standard extension points.

   GitHub now exposes skills, custom agents, and execution hooks. Claude Code exposes Skills as a
   first-class product surface. OpenAI is moving toward SDK and embedded-agent workflows. HugeCode
   should treat skills/resource loading discipline and runtime-approved lifecycle hooks as durable
   platform investments, not optional polish.

4. Multi-surface continuity is no longer optional.

   Claude Code now spans terminal, IDE, desktop, web, iOS, and Slack. GitHub exposes sessions
   through web, CLI, IDEs, mobile, and collaboration tools. OpenAI GA added Slack plus an SDK.
   HugeCode should continue to preserve runtime-owned truth so the same mission can survive shell
   transitions, handoff, and later cloud or collaboration entrypoints.

5. Production products are adding stronger admin and security controls, not fewer.

   Codex GA adds environment controls, monitoring, and analytics dashboards. Claude highlights
   safer long-running auto mode instead of all-or-nothing permissions. GitHub documents custom
   environments and firewall controls. Anthropic's 2026 report explicitly calls for
   security-first architecture as dual-use risk rises. HugeCode should keep policy, approvals,
   environment boundaries, and diagnostics inside runtime-owned surfaces.

### Implications for HugeCode

These external signals strengthen the current branch direction rather than changing it:

- keep the lifecycle event vocabulary work, because status visibility is a prerequisite for
  session logs, steering, and future multi-agent orchestration
- add runtime-owned tool lifecycle hooks next, because hooks are now a common enterprise-grade
  extension mechanism
- keep `skills-first`, but only through runtime-approved loading metadata and scope discipline
- treat reviewable evidence, approval traceability, and session continuity as core product
  features rather than debug-only extras

### Production follow-ons after Phase 1

If HugeCode wants to close the gap toward top-tier agent products, the next slices after the
current lifecycle pilot should be:

1. Promote lifecycle events from debug-only trial to operator session logs and handoff summaries.
2. Add runtime-owned steering and continuation primitives that can redirect an active run without
   breaking review or checkpoint truth.
3. Add runtime-approved lifecycle hooks with explicit auditability and policy guardrails.
4. Normalize skills/plugins metadata so project, personal, and later organization-level capability
   sources remain inspectable and governable.
5. Add admin-grade observability around environment selection, approvals, and agent/session
   reliability before expanding to more collaboration surfaces.

## Docs Updated In This Branch

- `docs/runtime/pi-mono-runtime-source-deep-dive-2026-03-22.md`
- `docs/runtime/runtime-borrowing-blueprint-2026-03-22.md`
- `docs/plans/2026-03-25-pi-mono-borrowing-analysis.md`

## Validation Scope

Docs-only, no runtime impact.

Required checks for this branch:

- confirm the HugeCode worktree is on `cf3e5bcf90aef4ddbd45f037121befea932818bb`
- confirm the local `pi-mono` checkout is on `629341c18f3482d891b665a844975096b47b4779`
- confirm all refreshed docs state exact SHAs and dates
- confirm the borrowing decision is separated into `copy directly`, `adapt`, `defer`, and `reject`
- confirm no active doc cites `docs/archive/**` as authority
- confirm no forbidden UI stack recommendation is presented as a HugeCode adoption path
