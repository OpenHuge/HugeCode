import type { DesktopBrowserAssessmentResult } from "@ku0/code-platform-interfaces";
import type { RuntimeBrowserReadinessSummary } from "../ports/browserCapability";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPlugins";

const BROWSER_ASSESSMENT_PLUGIN_ID = "hugecode.browser-assessment";

function buildWarnings(result: DesktopBrowserAssessmentResult | null): string[] {
  if (!result) {
    return [];
  }
  if (result.status === "passed") {
    return [];
  }
  const warnings = [
    result.errorMessage,
    ...result.accessibilityFailures.map((failure) => failure.message),
    ...result.consoleEntries
      .filter((entry) => entry.level === "error" || entry.level === "warn")
      .map((entry) => entry.message),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 4);
  return warnings;
}

export function buildRuntimeBrowserAssessmentPluginDescriptor(input: {
  readiness: RuntimeBrowserReadinessSummary;
  result: DesktopBrowserAssessmentResult | null;
}): RuntimeKernelPluginDescriptor | null {
  if (
    !input.readiness.assessmentAvailable &&
    !input.readiness.assessmentHistoryAvailable &&
    !input.result
  ) {
    return null;
  }

  const warnings = buildWarnings(input.result);
  return {
    id: BROWSER_ASSESSMENT_PLUGIN_ID,
    name: "Canonical browser assessment",
    version: input.readiness.assessmentAvailable ? "bound" : "history-only",
    summary:
      "Localized browser render loop that collects DOM, console, and accessibility feedback through the canonical browser capability facade.",
    source: "host_bridge",
    transport: "host_bridge",
    hostProfile: {
      kind: "bridge",
      executionBoundaries: ["desktop_host"],
    },
    workspaceId: null,
    enabled: input.readiness.assessmentAvailable || input.readiness.assessmentHistoryAvailable,
    runtimeBacked: true,
    capabilities: [
      {
        id: "browser.assessment",
        enabled: input.readiness.assessmentAvailable,
      },
      {
        id: "browser.assessment.history",
        enabled: input.readiness.assessmentHistoryAvailable,
      },
    ],
    permissions: [],
    resources: [],
    executionBoundaries: ["desktop_host"],
    binding: {
      state: input.readiness.assessmentAvailable ? "bound" : "declaration_only",
      contractFormat: "host_bridge",
      contractBoundary: "desktop-browser-assessment",
      interfaceId: BROWSER_ASSESSMENT_PLUGIN_ID,
      surfaces: [
        {
          id: "browser.assessment",
          kind: "procedure_set",
          direction: "export",
          summary: "Runs a localized browser assessment through the desktop host bridge.",
        },
      ],
    },
    operations: {
      execution: {
        executable: false,
        mode: "none",
        reason: "Browser assessment is executed through the desktop host bridge operator path.",
      },
      resources: {
        readable: false,
        mode: "none",
        reason: "Browser assessment does not expose static resources through the runtime kernel.",
      },
      permissions: {
        evaluable: false,
        mode: "none",
        reason: "Browser assessment does not request additional runtime permissions.",
      },
    },
    metadata: {
      sourceLabel: input.readiness.sourceLabel,
      assessmentStatus: input.result?.status ?? null,
      assessmentErrorCode: input.result?.errorCode ?? null,
      consoleEntryCount: input.result?.consoleEntries.length ?? 0,
      accessibilityFailureCount: input.result?.accessibilityFailures.length ?? 0,
    },
    permissionDecision: "allow",
    health: input.result
      ? {
          state: input.result.status === "passed" ? "healthy" : "degraded",
          checkedAt: Date.now(),
          warnings,
        }
      : {
          state: "unknown",
          checkedAt: null,
          warnings: [],
        },
  };
}
