# Runtime Browser Assessment Loop

The runtime browser assessment loop is the canonical local feedback path for
UI self-healing work in HugeCode.

It allows the runtime agent to ask the desktop host to render one localized UI
surface, collect DOM and console data, and return that result through the
runtime-facing browser capability facade.

## Scope

This loop covers:

- a fixture or in-app route target
- one canonical proxy entrypoint
- hidden local rendering in the desktop host
- DOM snapshot, console, and accessibility capture
- publication of the latest result back to Mission Control and runtime plugin readiness

It does not introduce a second browser routing model, a page-local polling loop,
or a wide legacy aggregation port.

## Canonical Path

The loop is intentionally narrow:

1. Mission Control or WebMCP requests `assess-runtime-browser-surface`.
2. `apps/code` forwards the request through the canonical browser capability facade.
3. `apps/code-electron` opens one hidden assessment window.
4. The hidden window loads the proxy fixture route, not the target directly.
5. The proxy fixture mounts the requested target inside a sandboxed `iframe`.
6. The desktop host collects console messages plus DOM/accessibility output.
7. The result is published back into runtime readiness and tool metrics surfaces.

## Infinite-Loop Prevention

The proxy exists to make recursion impossible by construction.

Guardrails:

- The shared contract reserves the fixture name `browser-assessment-proxy`.
- Fixture targets are rejected if they try to target `browser-assessment-proxy` directly.
- Route targets are rejected if they resolve back to `/fixtures.html?fixture=browser-assessment-proxy`.
- The shared contract appends `__hugecode_browser_assessment=1` to the actual target URL.
- Route targets that already include `__hugecode_browser_assessment` are rejected. Only the proxy may add it.
- The Electron assessor loads `buildDesktopBrowserAssessmentProxyPath(...)` and never loads nested target URLs directly.
- The proxy fixture only renders when `readDesktopBrowserAssessmentProxyRequest(...)` succeeds. Invalid or recursive requests stay in a blocked state and never mount an iframe.

These rules ensure the assessment renderer can observe a UI surface once, but
cannot recursively assess the assessment proxy itself.

## Runtime Boundary Rules

- Browser assessment capability truth comes from the desktop/browser capability boundary.
- Readiness and history are exposed through runtime facades, not page-local heuristics.
- Tool metrics remain asynchronous observability only; they do not become control truth.
- New assessment work must continue to use narrow runtime/browser ports instead of adding wide `desktop*` or `desktop-host*` aggregation ports.

## Validation Expectations

Changes to this loop should include:

- shared contract tests for proxy path and target validation
- proxy fixture tests for blocked and ready states
- desktop host tests for hidden-window assessment behavior
- Mission Control tests for readiness/result presentation
- targeted accessibility coverage through `pnpm test:e2e:a11y`
