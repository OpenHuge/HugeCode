import { describe, expect, it } from "vitest";
import {
  ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
  buildDesktopBrowserAssessmentProxyPath,
  buildDesktopBrowserAssessmentTargetUrl,
  createBindingFactory,
  createCapabilityRegistry,
  DESKTOP_HOST_IPC_CHANNELS,
  DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE,
  DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM,
  normalizeActiveIntentContext,
  normalizeActiveIntentContextByWorkspaceId,
  readDesktopBrowserAssessmentProxyRequest,
  type DesktopAppInfo,
  type DesktopBrowserAssessmentResult,
  type DesktopBrowserExtractionResult,
  type DesktopDiagnosticsInfo,
  type DesktopLaunchIntent,
  type DesktopUpdateState,
  isElectronDesktopHostBridge,
} from "./index";

describe("code-platform-interfaces", () => {
  it("recognizes the supported electron bridge kind", () => {
    expect(isElectronDesktopHostBridge({ kind: "electron" })).toBe(true);
  });

  it("rejects missing or unsupported bridge kinds", () => {
    expect(isElectronDesktopHostBridge(null)).toBe(false);
    expect(isElectronDesktopHostBridge({ kind: "electron-legacy" })).toBe(false);
    expect(isElectronDesktopHostBridge({})).toBe(false);
  });

  it("creates a capability registry with optional and required lookups", () => {
    const registry = createCapabilityRegistry<{
      alpha: () => string;
      beta: (value: string) => string;
    }>([
      {
        key: "alpha",
        capability: () => "ready",
        source: "test",
      },
    ]);

    expect(registry.has("alpha")).toBe(true);
    expect(registry.has("beta")).toBe(false);
    expect(registry.get("alpha")?.()).toBe("ready");
    expect(() => registry.require("beta")).toThrow(/Missing required capability `beta`/i);
    expect(registry.list()).toEqual([
      expect.objectContaining({
        key: "alpha",
        source: "test",
      }),
    ]);
  });

  it("creates binding factories over capability registries", () => {
    const registry = createCapabilityRegistry<{
      alpha: () => string;
      beta: (value: string) => string;
    }>([
      {
        key: "alpha",
        capability: () => "alpha-ready",
      },
      {
        key: "beta",
        capability: (value) => `${value}-beta`,
      },
    ]);

    const bindings = createBindingFactory(registry)((helpers) => ({
      alpha: helpers.require("alpha")(),
      beta: helpers.optional("beta")?.("value") ?? "missing",
    }));

    expect(bindings).toEqual({
      alpha: "alpha-ready",
      beta: "value-beta",
    });
  });

  it("supports the public beta app, launch, and updater contracts", () => {
    const appInfo: DesktopAppInfo = {
      channel: "beta",
      platform: "darwin",
      updateCapability: "automatic",
      updateMessage: "Automatic beta updates are enabled from the configured static feed.",
      updateMode: "enabled_beta_static_feed",
      version: "0.1.0-beta.1",
    };
    const launchIntent: DesktopLaunchIntent = {
      kind: "protocol",
      receivedAt: "2026-03-24T00:00:00.000Z",
      url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
    };
    const workspaceLaunchIntent: DesktopLaunchIntent = {
      kind: "workspace",
      launchPath: "/workspace/alpha/src/main.ts",
      launchPathKind: "file",
      receivedAt: "2026-03-24T00:00:00.000Z",
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    };
    const updateState: DesktopUpdateState = {
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases/tag/v0.1.0-beta.2",
      stage: "available",
      version: "0.1.0-beta.2",
    };
    const diagnosticsInfo: DesktopDiagnosticsInfo = {
      crashDumpsDirectoryPath: "/tmp/hugecode/crash-dumps",
      incidentLogPath: "/tmp/hugecode/logs/desktop-incidents.ndjson",
      lastIncidentAt: "2026-03-24T00:05:00.000Z",
      logsDirectoryPath: "/tmp/hugecode/logs",
      recentIncidentCount: 2,
      reportIssueUrl: "https://github.com/OpenHuge/HugeCode/issues/new",
      supportSnapshotText: "HugeCode Desktop Support Snapshot",
    };

    expect(appInfo.channel).toBe("beta");
    expect(launchIntent.kind).toBe("protocol");
    expect(workspaceLaunchIntent.launchPathKind).toBe("file");
    expect(workspaceLaunchIntent.workspacePath).toBe("/workspace/alpha");
    expect(updateState.stage).toBe("available");
    expect(diagnosticsInfo.recentIncidentCount).toBe(2);
  });

  it("supports browser extraction result contracts with normalized text and trace details", () => {
    const extractionResult: DesktopBrowserExtractionResult = {
      status: "partial",
      normalizedText:
        "Mission Control can now project browser extraction capability state through the runtime facade.",
      snippet: "Mission Control can now project browser extraction capability state",
      sourceUrl: "https://example.com/runtime-browser-readiness",
      title: "Runtime browser readiness",
      errorCode: "SNIPPET_TRUNCATED",
      errorMessage: "Normalized text was truncated to the preview snippet window.",
      traceId: "browser-trace-1",
      trace: [
        {
          stage: "capture",
          message: "Captured page text from the active browser session.",
          at: "2026-03-29T00:00:00.000Z",
        },
        {
          stage: "normalize",
          message: "Collapsed whitespace and produced a preview snippet.",
          at: "2026-03-29T00:00:00.250Z",
          code: "SNIPPET_TRUNCATED",
        },
      ],
    };

    expect(extractionResult.status).toBe("partial");
    expect(extractionResult.normalizedText).toContain("runtime facade");
    expect(extractionResult.snippet).toContain("browser extraction");
    expect(extractionResult.trace).toHaveLength(2);
    expect(extractionResult.trace[1]?.stage).toBe("normalize");
    expect(extractionResult.traceId).toBe("browser-trace-1");
  });

  it("supports browser assessment result contracts with DOM, console, and accessibility details", () => {
    const assessmentResult: DesktopBrowserAssessmentResult = {
      status: "failed",
      target: {
        kind: "fixture",
        fixtureName: "mission-control",
      },
      domSnapshot: {
        childElementCount: 4,
        html: "<main><button>Run</button></main>",
        selector: "main",
        selectorMatched: true,
        text: "Run",
      },
      consoleEntries: [
        {
          level: "error",
          message: "Failed to load resource",
          line: 18,
          sourceId: "mission-control.tsx",
        },
      ],
      accessibilityFailures: [
        {
          code: "button-name-missing",
          message: "Interactive button is missing an accessible name.",
          selector: "button",
        },
      ],
      sourceUrl: "http://desktop-app/fixtures.html?fixture=mission-control",
      title: "Mission Control fixture",
      errorCode: "BROWSER_A11Y_FAILURES_DETECTED",
      errorMessage: "Accessibility failures were detected in the assessed surface.",
      traceId: "browser-assessment-1",
      trace: [
        {
          stage: "proxy",
          message: "Loaded the canonical browser assessment proxy.",
          at: "2026-03-30T00:00:00.000Z",
        },
        {
          stage: "audit",
          message: "Collected accessibility failures from the assessed surface.",
          at: "2026-03-30T00:00:00.350Z",
          code: "BROWSER_A11Y_FAILURES_DETECTED",
        },
      ],
    };

    expect(assessmentResult.status).toBe("failed");
    expect(assessmentResult.target.kind).toBe("fixture");
    expect(assessmentResult.domSnapshot?.selectorMatched).toBe(true);
    expect(assessmentResult.consoleEntries[0]?.level).toBe("error");
    expect(assessmentResult.accessibilityFailures[0]?.code).toBe("button-name-missing");
    expect(assessmentResult.trace[1]?.stage).toBe("audit");
  });

  it("builds proxy and target URLs that guard against recursive browser assessment loops", () => {
    expect(
      buildDesktopBrowserAssessmentProxyPath({
        target: {
          kind: "fixture",
          fixtureName: "mission-control",
        },
        selector: "main",
        waitForMs: 2400,
      })
    ).toBe(
      `/fixtures.html?fixture=${DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE}&browserAssessmentTargetKind=fixture&browserAssessmentTargetFixture=mission-control&browserAssessmentSelector=main&browserAssessmentWaitMs=2400`
    );
    expect(
      buildDesktopBrowserAssessmentTargetUrl({
        kind: "fixture",
        fixtureName: "mission-control",
      })
    ).toBe(
      `/fixtures.html?fixture=mission-control&${DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM}=1`
    );
    expect(
      buildDesktopBrowserAssessmentTargetUrl({
        kind: "route",
        routePath: "/workspace/alpha?tab=mission-control",
      })
    ).toBe(
      `/workspace/alpha?tab=mission-control&${DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM}=1`
    );

    expect(() =>
      buildDesktopBrowserAssessmentTargetUrl({
        kind: "fixture",
        fixtureName: DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE,
      })
    ).toThrow(/cannot target itself/i);
    expect(() =>
      buildDesktopBrowserAssessmentTargetUrl({
        kind: "route",
        routePath: `/fixtures.html?fixture=${DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE}`,
      })
    ).toThrow(/cannot target itself/i);
    expect(() =>
      buildDesktopBrowserAssessmentTargetUrl({
        kind: "route",
        routePath: `/workspace/alpha?${DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM}=1`,
      })
    ).toThrow(/sentinel/i);
  });

  it("reads browser assessment proxy requests from the shared fixture query contract", () => {
    expect(
      readDesktopBrowserAssessmentProxyRequest(
        `?fixture=${DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE}&browserAssessmentTargetKind=route&browserAssessmentTargetRoute=%2Fworkspace%2Falpha&browserAssessmentSelector=main&browserAssessmentWaitMs=3500`
      )
    ).toEqual({
      ok: true,
      request: {
        target: {
          kind: "route",
          routePath: "/workspace/alpha",
        },
        selector: "main",
        waitForMs: 3500,
      },
    });
    expect(
      readDesktopBrowserAssessmentProxyRequest(
        `?fixture=${DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE}&browserAssessmentTargetKind=fixture`
      )
    ).toEqual({
      ok: false,
      code: "BROWSER_ASSESSMENT_PROXY_FIXTURE_REQUIRED",
      message: "Browser assessment proxy requires a fixture target when target kind is fixture.",
    });
  });

  it("exports the canonical desktop host ipc channel contract", () => {
    expect(DESKTOP_HOST_IPC_CHANNELS).toEqual({
      getAppInfo: "hugecode:desktop-host:get-app-info",
      getAppVersion: "hugecode:desktop-host:get-app-version",
      getDiagnosticsInfo: "hugecode:desktop-host:get-diagnostics-info",
      copySupportSnapshot: "hugecode:desktop-host:copy-support-snapshot",
      assessBrowserSurface: "hugecode:desktop-host:assess-browser-surface",
      getLastBrowserAssessmentResult: "hugecode:desktop-host:get-last-browser-assessment-result",
      extractBrowserContent: "hugecode:desktop-host:extract-browser-content",
      getLastBrowserExtractionResult: "hugecode:desktop-host:get-last-browser-extraction-result",
      consumePendingLaunchIntent: "hugecode:desktop-host:consume-pending-launch-intent",
      pushLaunchIntent: "hugecode:desktop-host:push-launch-intent",
      pushUpdateState: "hugecode:desktop-host:push-update-state",
      getCurrentSession: "hugecode:desktop-host:get-current-session",
      listLocalChromeDebuggerEndpoints:
        "hugecode:desktop-host:list-local-chrome-debugger-endpoints",
      listRecentSessions: "hugecode:desktop-host:list-recent-sessions",
      reopenSession: "hugecode:desktop-host:reopen-session",
      getWindowLabel: "hugecode:desktop-host:get-window-label",
      listWindows: "hugecode:desktop-host:list-windows",
      openWindow: "hugecode:desktop-host:open-window",
      focusWindow: "hugecode:desktop-host:focus-window",
      closeWindow: "hugecode:desktop-host:close-window",
      getTrayState: "hugecode:desktop-host:get-tray-state",
      setTrayEnabled: "hugecode:desktop-host:set-tray-enabled",
      showNotification: "hugecode:desktop-host:show-notification",
      openDialog: "hugecode:desktop-host:open-dialog",
      getUpdateState: "hugecode:desktop-host:get-update-state",
      checkForUpdates: "hugecode:desktop-host:check-for-updates",
      restartToApplyUpdate: "hugecode:desktop-host:restart-to-apply-update",
      openExternalUrl: "hugecode:desktop-host:open-external-url",
      openPathIn: "hugecode:desktop-host:open-path-in",
      openPath: "hugecode:desktop-host:open-path",
      revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
    });
  });

  it("normalizes the active intent context contract for persisted flow state", () => {
    expect(
      normalizeActiveIntentContext({
        schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
        intent: {
          objective: "Keep continuity readiness stable",
          constraints: "Stay inside application/runtime boundaries",
          successCriteria: "Recover flow state after restart",
          deadline: "2026-03-30",
          priority: "high",
          managerNotes: "Prefer runtime truth over page-local heuristics",
        },
        focusedFiles: [
          {
            path: "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
            reason: "recent_change",
          },
          {
            path: "packages/code-platform-interfaces/src/index.ts",
            reason: "diagnostic",
          },
        ],
        unresolvedErrors: [
          {
            source: "tsc",
            severity: "error",
            message:
              "Property 'activeIntentContextByWorkspaceId' does not exist on type 'AppSettings'.",
            path: "apps/code/src/types.ts",
            code: "TS2339",
            startLine: 278,
            startColumn: 3,
            endLine: 278,
            endColumn: 35,
          },
        ],
        history: {
          latestRunId: "run-1",
          latestRunTitle: "Persist flow state",
          latestReviewPackId: "review-pack-1",
          lastUpdatedAt: 42,
          recentChangedPaths: [
            "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
            "packages/code-platform-interfaces/src/index.ts",
          ],
          validationSummaries: ["TypeScript failed after adding persistent flow state fields."],
        },
      })
    ).toEqual({
      schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
      intent: {
        objective: "Keep continuity readiness stable",
        constraints: "Stay inside application/runtime boundaries",
        successCriteria: "Recover flow state after restart",
        deadline: "2026-03-30",
        priority: "high",
        managerNotes: "Prefer runtime truth over page-local heuristics",
      },
      focusedFiles: [
        {
          path: "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
          reason: "recent_change",
        },
        {
          path: "packages/code-platform-interfaces/src/index.ts",
          reason: "diagnostic",
        },
      ],
      unresolvedErrors: [
        {
          source: "tsc",
          severity: "error",
          message:
            "Property 'activeIntentContextByWorkspaceId' does not exist on type 'AppSettings'.",
          path: "apps/code/src/types.ts",
          code: "TS2339",
          startLine: 278,
          startColumn: 3,
          endLine: 278,
          endColumn: 35,
        },
      ],
      history: {
        latestRunId: "run-1",
        latestRunTitle: "Persist flow state",
        latestReviewPackId: "review-pack-1",
        lastUpdatedAt: 42,
        recentChangedPaths: [
          "apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts",
          "packages/code-platform-interfaces/src/index.ts",
        ],
        validationSummaries: ["TypeScript failed after adding persistent flow state fields."],
      },
    });
  });

  it("drops malformed active intent context entries while keeping valid workspaces", () => {
    expect(
      normalizeActiveIntentContextByWorkspaceId({
        "workspace-1": {
          schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
          intent: {
            objective: "Carry intent across restarts",
            constraints: "",
            successCriteria: "",
            deadline: null,
            priority: "medium",
            managerNotes: "",
          },
          focusedFiles: [{ path: "apps/code/src/types.ts", reason: "recent_change" }],
          unresolvedErrors: [
            {
              source: "oxlint",
              severity: "warning",
              message: "Unused import",
              path: "apps/code/src/types.ts",
              code: null,
              startLine: 1,
              startColumn: 1,
              endLine: 1,
              endColumn: 10,
            },
          ],
          history: {
            latestRunId: null,
            latestRunTitle: null,
            latestReviewPackId: null,
            lastUpdatedAt: null,
            recentChangedPaths: [],
            validationSummaries: [],
          },
        },
        "workspace-2": {
          schemaVersion: "active-intent-context/v0",
        },
      })
    ).toEqual({
      "workspace-1": {
        schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
        intent: {
          objective: "Carry intent across restarts",
          constraints: "",
          successCriteria: "",
          deadline: null,
          priority: "medium",
          managerNotes: "",
        },
        focusedFiles: [{ path: "apps/code/src/types.ts", reason: "recent_change" }],
        unresolvedErrors: [
          {
            source: "oxlint",
            severity: "warning",
            message: "Unused import",
            path: "apps/code/src/types.ts",
            code: null,
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
        ],
        history: {
          latestRunId: null,
          latestRunTitle: null,
          latestReviewPackId: null,
          lastUpdatedAt: null,
          recentChangedPaths: [],
          validationSummaries: [],
        },
      },
    });
  });
});
