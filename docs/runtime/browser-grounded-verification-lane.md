# Browser-Grounded Verification Lane

This note describes the current thin verification lane that lets desktop browser extraction participate in Review Pack evidence without creating a second artifact system.

## What Is First-Class Now

- browser extraction readiness remains published from the approved `apps/code/src/application/runtime/*` facade boundary
- the latest desktop-host extraction result can become operator-attached browser verification evidence for a mission run or review pack
- attached browser verification evidence is stored with explicit provenance:
  - workspace, task, run, and optional review-pack linkage
  - readiness source and runtime host
  - requested page URL and selector
  - extraction trace id and host-published result payload

## Where Operators See It

- Mission Control still exposes the full browser assessment and extraction operators for desktop-host execution
- Review Pack now exposes a thin `Browser verification` section inside the canonical review workflow
- from that section an operator can:
  - trigger browser extraction
  - inspect the latest extraction result
  - attach the result as browser verification evidence
  - ignore the pending result

## How Review Consumes It

- attached browser verification is folded into the existing `Artifacts and evidence` list as an `evidence` artifact
- review reproduction guidance gains a stable inspect step for the attached browser artifact URI
- review decision actionability now includes browser-verification context when evidence is attached or when a pending result still needs operator attach/ignore
- this keeps browser evidence on the same review-pack artifact lane instead of introducing a separate verification artifact product

## Telemetry And Eval Hooks

- the lane emits minimal browser-verification lifecycle events for:
  - extraction triggered
  - extraction succeeded
  - extraction failed
  - evidence attached
  - evidence ignored
- the same actions also record product-analytics counters so the lane can be measured without adding a separate telemetry subsystem

## Intentional Constraints

- desktop-first only; no web-host parity is implied
- operator-assisted only; no autonomous browser remediation loop is introduced
- attachment is scoped to the latest workspace candidate and is meant to support review trust, not autonomous self-healing
- GitHub intake and closure remain unchanged; this lane only enriches review-time evidence and actionability
