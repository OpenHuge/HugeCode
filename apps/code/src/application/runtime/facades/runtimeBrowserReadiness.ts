import type {
  DesktopBrowserAssessmentResult,
  DesktopBrowserExtractionResult,
  DesktopRuntimeHost,
} from "@ku0/code-platform-interfaces";
import { getDesktopHostBridge } from "../ports/desktopHostBridge";
import { supportsWebMcp } from "./runtimeWebMcpBridgeFacade";

export type RuntimeBrowserReadinessState = "ready" | "attention" | "blocked";

export type RuntimeBrowserReadinessSource =
  | "desktop_host_bridge"
  | "partial_host_bridge"
  | "local_placeholder"
  | "unavailable";

export type RuntimeBrowserReadinessSummary = {
  state: RuntimeBrowserReadinessState;
  headline: string;
  detail: string;
  recommendedAction: string;
  runtimeHost: DesktopRuntimeHost;
  source: RuntimeBrowserReadinessSource;
  sourceLabel: string;
  assessmentAvailable: boolean;
  assessmentHistoryAvailable: boolean;
  extractionAvailable: boolean;
  historyAvailable: boolean;
  localOnly: boolean;
  lastAssessmentResult: DesktopBrowserAssessmentResult | null;
  lastResult: DesktopBrowserExtractionResult | null;
  capabilities: {
    browserAssessment: boolean;
    browserAssessmentHistory: boolean;
    browserDebug: boolean;
    browserExtraction: boolean;
    browserExtractionHistory: boolean;
    webMcp: boolean;
  };
};

function readWebMcpSupport(): boolean {
  try {
    return supportsWebMcp();
  } catch {
    return false;
  }
}

function buildPlaceholderResult(input: {
  status: DesktopBrowserExtractionResult["status"];
  message: string;
  errorCode: string;
}): DesktopBrowserExtractionResult {
  return {
    status: input.status,
    normalizedText: null,
    snippet: null,
    errorCode: input.errorCode,
    errorMessage: input.message,
    traceId: null,
    trace: [
      {
        stage: "availability",
        message: input.message,
        at: new Date(0).toISOString(),
        code: input.errorCode,
      },
    ],
  };
}

export function readBrowserReadiness(): RuntimeBrowserReadinessSummary {
  if (typeof window === "undefined") {
    return {
      state: "blocked",
      headline: "Browser readiness unavailable",
      detail: "Browser capability state can only be read from an interactive client runtime.",
      recommendedAction:
        "Open HugeCode in an interactive browser or Electron renderer before checking browser readiness.",
      runtimeHost: "browser",
      source: "unavailable",
      sourceLabel: "Unavailable",
      assessmentAvailable: false,
      assessmentHistoryAvailable: false,
      extractionAvailable: false,
      historyAvailable: false,
      localOnly: false,
      lastAssessmentResult: null,
      lastResult: buildPlaceholderResult({
        status: "failed",
        message: "Browser capability state can only be read from an interactive client runtime.",
        errorCode: "INTERACTIVE_BROWSER_RUNTIME_REQUIRED",
      }),
      capabilities: {
        browserAssessment: false,
        browserAssessmentHistory: false,
        browserDebug: false,
        browserExtraction: false,
        browserExtractionHistory: false,
        webMcp: false,
      },
    };
  }

  const desktopHostBridge = getDesktopHostBridge();
  const runtimeHost: DesktopRuntimeHost = desktopHostBridge?.kind ?? "browser";
  const hasBrowserAssessmentCapability =
    typeof desktopHostBridge?.browserAssessment?.assess === "function";
  const hasBrowserAssessmentHistoryCapability =
    typeof desktopHostBridge?.browserAssessment?.getLastResult === "function";
  const hasBrowserExtractionCapability =
    typeof desktopHostBridge?.browserExtraction?.extract === "function";
  const hasBrowserExtractionHistoryCapability =
    typeof desktopHostBridge?.browserExtraction?.getLastResult === "function";
  const hasBrowserDebugCapability =
    typeof desktopHostBridge?.browserDebug?.listLocalChromeDebuggerEndpoints === "function";
  const hasWebMcpSupport = readWebMcpSupport();

  if (hasBrowserExtractionCapability) {
    return {
      state: "ready",
      headline: "Browser readiness confirmed",
      detail: hasBrowserAssessmentCapability
        ? "Electron bridge publishes the canonical browser assessment and extraction contracts."
        : "Electron bridge publishes the browser extraction contract, so extraction can move through the canonical capability boundary.",
      recommendedAction: hasBrowserAssessmentCapability
        ? "Use the published browser assessment and extraction contracts as the canonical source for future browser feedback loops."
        : "Use the Electron bridge browser extraction contract as the canonical source for future browser reads.",
      runtimeHost,
      source: "desktop_host_bridge",
      sourceLabel: "Electron bridge",
      assessmentAvailable: hasBrowserAssessmentCapability,
      assessmentHistoryAvailable: hasBrowserAssessmentHistoryCapability,
      extractionAvailable: true,
      historyAvailable: hasBrowserExtractionHistoryCapability,
      localOnly: false,
      lastAssessmentResult: null,
      lastResult: null,
      capabilities: {
        browserAssessment: hasBrowserAssessmentCapability,
        browserAssessmentHistory: hasBrowserAssessmentHistoryCapability,
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: true,
        browserExtractionHistory: hasBrowserExtractionHistoryCapability,
        webMcp: hasWebMcpSupport,
      },
    };
  }

  if (hasBrowserAssessmentCapability || hasBrowserAssessmentHistoryCapability) {
    return {
      state: "attention",
      headline: "Browser readiness is partially published",
      detail:
        "Electron bridge publishes browser assessment capability, but browser extraction is not fully wired yet.",
      recommendedAction:
        "Keep using the published browser assessment loop and add the extraction contract before treating browser readiness as fully complete.",
      runtimeHost,
      source: "partial_host_bridge",
      sourceLabel: "Partial Electron bridge",
      assessmentAvailable: hasBrowserAssessmentCapability,
      assessmentHistoryAvailable: hasBrowserAssessmentHistoryCapability,
      extractionAvailable: false,
      historyAvailable: hasBrowserExtractionHistoryCapability,
      localOnly: false,
      lastAssessmentResult: null,
      lastResult: null,
      capabilities: {
        browserAssessment: hasBrowserAssessmentCapability,
        browserAssessmentHistory: hasBrowserAssessmentHistoryCapability,
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: false,
        browserExtractionHistory: hasBrowserExtractionHistoryCapability,
        webMcp: hasWebMcpSupport,
      },
    };
  }

  if (hasBrowserExtractionHistoryCapability) {
    return {
      state: "attention",
      headline: "Browser readiness is partially published",
      detail:
        "Electron bridge can read the last browser extraction result, but it does not publish the canonical extract entrypoint yet.",
      recommendedAction:
        "Publish the full browser extraction contract before treating browser extraction as runtime-ready.",
      runtimeHost,
      source: "partial_host_bridge",
      sourceLabel: "Partial Electron bridge",
      assessmentAvailable: hasBrowserAssessmentCapability,
      assessmentHistoryAvailable: hasBrowserAssessmentHistoryCapability,
      extractionAvailable: false,
      historyAvailable: true,
      localOnly: false,
      lastAssessmentResult: null,
      lastResult: null,
      capabilities: {
        browserAssessment: hasBrowserAssessmentCapability,
        browserAssessmentHistory: hasBrowserAssessmentHistoryCapability,
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: false,
        browserExtractionHistory: true,
        webMcp: hasWebMcpSupport,
      },
    };
  }

  if (hasBrowserDebugCapability || hasWebMcpSupport) {
    return {
      state: "attention",
      headline: "Browser readiness is local-only",
      detail:
        "Browser-related integrations are present, but extraction still resolves through a local placeholder state until a host adapter publishes the canonical extraction contract.",
      recommendedAction:
        "Treat this as placeholder local state and wire a real host or runtime extraction adapter before depending on browser extraction in production flows.",
      runtimeHost,
      source: "local_placeholder",
      sourceLabel: "Local placeholder",
      assessmentAvailable: hasBrowserAssessmentCapability,
      assessmentHistoryAvailable: hasBrowserAssessmentHistoryCapability,
      extractionAvailable: false,
      historyAvailable: false,
      localOnly: true,
      lastAssessmentResult: null,
      lastResult: buildPlaceholderResult({
        status: "empty",
        message:
          "Browser extraction remains in placeholder mode until a host or runtime adapter publishes canonical extraction results.",
        errorCode: "LOCAL_PLACEHOLDER_STATE",
      }),
      capabilities: {
        browserAssessment: hasBrowserAssessmentCapability,
        browserAssessmentHistory: hasBrowserAssessmentHistoryCapability,
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: false,
        browserExtractionHistory: false,
        webMcp: hasWebMcpSupport,
      },
    };
  }

  return {
    state: "blocked",
    headline: "Browser readiness blocked",
    detail:
      "No browser extraction capability, browser debug bridge, or WebMCP browser support is available on this host.",
    recommendedAction:
      "Enable a browser-capable host integration before requesting browser extraction from the runtime facade.",
    runtimeHost,
    source: "unavailable",
    sourceLabel: "Unavailable",
    assessmentAvailable: hasBrowserAssessmentCapability,
    assessmentHistoryAvailable: hasBrowserAssessmentHistoryCapability,
    extractionAvailable: false,
    historyAvailable: false,
    localOnly: false,
    lastAssessmentResult: null,
    lastResult: buildPlaceholderResult({
      status: "failed",
      message:
        "No browser extraction capability, browser debug bridge, or WebMCP browser support is available on this host.",
      errorCode: "BROWSER_CAPABILITY_UNAVAILABLE",
    }),
    capabilities: {
      browserAssessment: hasBrowserAssessmentCapability,
      browserAssessmentHistory: hasBrowserAssessmentHistoryCapability,
      browserDebug: false,
      browserExtraction: false,
      browserExtractionHistory: false,
      webMcp: false,
    },
  };
}
