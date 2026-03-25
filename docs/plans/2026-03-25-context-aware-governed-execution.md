# Context-Aware Governed Execution

> Working implementation note for the March 25, 2026 HugeCode strategic reset.

## Strategic Reset

HugeCode should stop compounding value mainly in runtime routing, shell variation,
or provider breadth. The next durable layer is the one that turns upstream
context into a governed run and returns a review-native next decision.

This slice moves the product in that direction by landing three shared
semantics:

1. `context truth`
   One normalized view of source-linked task context instead of per-entry
   interpretation.
2. `guidance stack`
   One precedence-ordered summary of repo, source, review-profile, and
   launch-time guidance.
3. `triage summary`
   One source-aware summary of owner, priority, risk, tags, and dedupe hints.
4. `delegation contract`
   One operator-facing summary of who stays accountable, who executes, and what
   the next action is.

## Scope

Implemented in this slice:

- broadened source normalization beyond GitHub issue / PR follow-up to include
  GitHub discussion, note, customer feedback, doc, call summary, and external
  reference inputs
- expanded repository source-mapping support for those source kinds in both the
  app-layer parser and Rust runtime parser
- runtime kernel v2 prepare response now publishes:
  - `contextTruth`
  - `guidanceStack`
  - `triageSummary`
  - `delegationContract`
- app runtime facades now rebuild the same semantics for review and follow-up
  surfaces so launch and review stay aligned
- Mission Control launch preview and Review Queue now render the new summaries

Out of scope for this slice:

- persistent runtime storage of the new context/guidance semantics on every run
- new non-GitHub source UI panels
- provider or shell expansion

## Module Changes

- `packages/code-runtime-host-contract`
  Added v2 prepare-response types for context truth, guidance stack, and
  delegation contract, plus broader task-source kinds.
- `packages/code-runtime-service-rs`
  Runtime prepare now synthesizes the new summaries and repository execution
  defaults accept the expanded source kinds.
- `apps/code/src/application/runtime/facades`
  Added generic source normalization and shared context/delegation facades.
- `apps/code/src/features`
  Launch preview and review queue render the new summaries without introducing
  page-local policy logic.

## Migration Notes

- Existing GitHub launch call sites remain compatible through the
  `githubSourceLaunchNormalization` wrapper and GitHub-specific launch helper.
- New integrations should target the generic source normalization and source
  delegation entrypoints first.
- Repo execution contracts may now add source mappings for:
  `github_discussion`, `note`, `customer_feedback`, `doc`, `call_summary`, and
  `external_ref`.

## Validation

- targeted Vitest coverage for:
  - generic source normalization
  - GitHub wrapper compatibility
  - runtime context truth and delegation semantics
  - repository execution contract parsing
  - launch/review UI smoke coverage
- TypeScript contract package typecheck
- Rust targeted unit coverage for expanded repository source kinds

## Follow-Up

- persist `contextTruth` / `guidanceStack` / `delegationContract` deeper into
- persist `triageSummary` deeper into
  runtime run and review records so review/takeover surfaces can consume the
  runtime-published object directly instead of rebuilding from current truth
- add non-GitHub source launch UI once the intake policy and ownership model are
  ready
- teach Review Pack detail surfaces to show source-context provenance and
  delegation contract explicitly
