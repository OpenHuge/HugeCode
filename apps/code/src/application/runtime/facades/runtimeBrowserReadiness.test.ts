import { beforeEach, describe, expect, it, vi } from "vitest";
import { readBrowserReadiness } from "./runtimeBrowserReadiness";

const { getDesktopHostBridgeMock, supportsWebMcpMock } = vi.hoisted(() => ({
  getDesktopHostBridgeMock: vi.fn(),
  supportsWebMcpMock: vi.fn(),
}));

vi.mock("../ports/desktopHostBridge", () => ({
  getDesktopHostBridge: getDesktopHostBridgeMock,
}));

vi.mock("./runtimeWebMcpBridgeFacade", () => ({
  supportsWebMcp: supportsWebMcpMock,
}));

describe("runtimeBrowserReadiness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDesktopHostBridgeMock.mockReturnValue(null);
    supportsWebMcpMock.mockReturnValue(false);
  });

  it("reports ready when the desktop host publishes browser extraction capability", () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      browserExtraction: {
        extract: async () => null,
      },
    });

    const summary = readBrowserReadiness();

    expect(summary.state).toBe("ready");
    expect(summary.runtimeHost).toBe("electron");
    expect(summary.assessmentAvailable).toBe(false);
    expect(summary.assessmentHistoryAvailable).toBe(false);
    expect(summary.extractionAvailable).toBe(true);
    expect(summary.historyAvailable).toBe(false);
    expect(summary.localOnly).toBe(false);
    expect(summary.capabilities.browserExtraction).toBe(true);
    expect(summary.capabilities.browserExtractionHistory).toBe(false);
    expect(summary.source).toBe("desktop_host_bridge");
  });

  it("reports partial host attention when only browser extraction history is published", () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      browserExtraction: {
        getLastResult: async () => null,
      },
    });

    const summary = readBrowserReadiness();

    expect(summary.state).toBe("attention");
    expect(summary.runtimeHost).toBe("electron");
    expect(summary.assessmentAvailable).toBe(false);
    expect(summary.assessmentHistoryAvailable).toBe(false);
    expect(summary.extractionAvailable).toBe(false);
    expect(summary.historyAvailable).toBe(true);
    expect(summary.localOnly).toBe(false);
    expect(summary.capabilities.browserExtractionHistory).toBe(true);
    expect(summary.source).toBe("partial_host_bridge");
    expect(summary.headline).toContain("partially published");
  });

  it("reports local placeholder attention when browser runtime integrations are present", () => {
    supportsWebMcpMock.mockReturnValue(true);

    const summary = readBrowserReadiness();

    expect(summary.state).toBe("attention");
    expect(summary.runtimeHost).toBe("browser");
    expect(summary.assessmentAvailable).toBe(false);
    expect(summary.assessmentHistoryAvailable).toBe(false);
    expect(summary.extractionAvailable).toBe(false);
    expect(summary.historyAvailable).toBe(false);
    expect(summary.localOnly).toBe(true);
    expect(summary.capabilities.webMcp).toBe(true);
    expect(summary.capabilities.browserExtractionHistory).toBe(false);
    expect(summary.recommendedAction).toContain("placeholder");
    expect(summary.lastResult?.status).toBe("empty");
    expect(summary.lastResult?.trace[0]?.stage).toBe("availability");
  });

  it("treats browser debug as an attention signal until extraction is wired", () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      browserDebug: {
        listLocalChromeDebuggerEndpoints: async () => [],
      },
    });

    const summary = readBrowserReadiness();

    expect(summary.state).toBe("attention");
    expect(summary.capabilities.browserDebug).toBe(true);
    expect(summary.capabilities.browserAssessment).toBe(false);
    expect(summary.extractionAvailable).toBe(false);
    expect(summary.historyAvailable).toBe(false);
    expect(summary.localOnly).toBe(true);
    expect(summary.lastResult?.errorCode).toBe("LOCAL_PLACEHOLDER_STATE");
  });

  it("reports blocked in a plain browser runtime without browser signals", () => {
    const summary = readBrowserReadiness();

    expect(summary.state).toBe("blocked");
    expect(summary.runtimeHost).toBe("browser");
    expect(summary.assessmentAvailable).toBe(false);
    expect(summary.historyAvailable).toBe(false);
    expect(summary.localOnly).toBe(false);
    expect(summary.source).toBe("unavailable");
    expect(summary.lastResult?.errorCode).toBe("BROWSER_CAPABILITY_UNAVAILABLE");
  });

  it("reports blocked when no browser capability surface is available on an electron host", () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
    });

    const summary = readBrowserReadiness();

    expect(summary.state).toBe("blocked");
    expect(summary.runtimeHost).toBe("electron");
    expect(summary.capabilities.browserDebug).toBe(false);
    expect(summary.capabilities.browserAssessment).toBe(false);
    expect(summary.capabilities.browserAssessmentHistory).toBe(false);
    expect(summary.capabilities.browserExtraction).toBe(false);
    expect(summary.capabilities.browserExtractionHistory).toBe(false);
    expect(summary.capabilities.webMcp).toBe(false);
    expect(summary.extractionAvailable).toBe(false);
    expect(summary.historyAvailable).toBe(false);
    expect(summary.localOnly).toBe(false);
    expect(summary.lastResult?.status).toBe("failed");
    expect(summary.lastResult?.errorCode).toBe("BROWSER_CAPABILITY_UNAVAILABLE");
  });
});
