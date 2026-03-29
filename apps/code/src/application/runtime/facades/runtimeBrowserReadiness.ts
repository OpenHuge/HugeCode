import type {
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
  extractionAvailable: boolean;
  localOnly: boolean;
  lastResult: DesktopBrowserExtractionResult | null;
  capabilities: {
    browserDebug: boolean;
    browserExtraction: boolean;
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
      extractionAvailable: false,
      localOnly: false,
      lastResult: buildPlaceholderResult({
        status: "failed",
        message: "Browser capability state can only be read from an interactive client runtime.",
        errorCode: "INTERACTIVE_BROWSER_RUNTIME_REQUIRED",
      }),
      capabilities: {
        browserDebug: false,
        browserExtraction: false,
        webMcp: false,
      },
    };
  }

  const desktopHostBridge = getDesktopHostBridge();
  const runtimeHost: DesktopRuntimeHost = desktopHostBridge?.kind ?? "browser";
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
      detail:
        "Desktop host bridge publishes the browser extraction contract, so extraction can move through the canonical capability boundary.",
      recommendedAction:
        "Use the desktop-host browser extraction contract as the canonical source for future browser reads.",
      runtimeHost,
      source: "desktop_host_bridge",
      sourceLabel: "Desktop host bridge",
      extractionAvailable: true,
      localOnly: false,
      lastResult: null,
      capabilities: {
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: true,
        webMcp: hasWebMcpSupport,
      },
    };
  }

  if (hasBrowserExtractionHistoryCapability) {
    return {
      state: "attention",
      headline: "Browser readiness is partially published",
      detail:
        "Desktop host bridge can read the last browser extraction result, but it does not publish the canonical extract entrypoint yet.",
      recommendedAction:
        "Publish the full browser extraction contract before treating browser extraction as runtime-ready.",
      runtimeHost,
      source: "partial_host_bridge",
      sourceLabel: "Partial desktop host bridge",
      extractionAvailable: false,
      localOnly: false,
      lastResult: null,
      capabilities: {
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: false,
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
      extractionAvailable: false,
      localOnly: true,
      lastResult: buildPlaceholderResult({
        status: "empty",
        message:
          "Browser extraction remains in placeholder mode until a host or runtime adapter publishes canonical extraction results.",
        errorCode: "LOCAL_PLACEHOLDER_STATE",
      }),
      capabilities: {
        browserDebug: hasBrowserDebugCapability,
        browserExtraction: false,
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
    extractionAvailable: false,
    localOnly: false,
    lastResult: buildPlaceholderResult({
      status: "failed",
      message:
        "No browser extraction capability, browser debug bridge, or WebMCP browser support is available on this host.",
      errorCode: "BROWSER_CAPABILITY_UNAVAILABLE",
    }),
    capabilities: {
      browserDebug: false,
      browserExtraction: false,
      webMcp: false,
    },
  };
}
