import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessBrowserSurface,
  extractBrowserContent,
  getLastBrowserAssessmentResult,
  getLastBrowserExtractionResult,
} from "./browserCapability";

const { getDesktopHostBridgeMock } = vi.hoisted(() => ({
  getDesktopHostBridgeMock: vi.fn(),
}));

vi.mock("./desktopHostBridge", () => ({
  getDesktopHostBridge: getDesktopHostBridgeMock,
}));

describe("browserCapability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDesktopHostBridgeMock.mockReturnValue(null);
  });

  it("reads browser extraction through the approved desktop host boundary", async () => {
    const assessMock = vi.fn(async () => ({
      status: "passed" as const,
      target: {
        kind: "fixture" as const,
        fixtureName: "mission-control",
      },
      domSnapshot: {
        childElementCount: 3,
        html: "<main>Mission Control</main>",
        selector: "main",
        selectorMatched: true,
        text: "Mission Control",
      },
      consoleEntries: [],
      accessibilityFailures: [],
      traceId: "browser-assessment-1",
      trace: [],
    }));
    const getLastAssessmentResultMock = vi.fn(async () => ({
      status: "failed" as const,
      target: {
        kind: "route" as const,
        routePath: "/workspace/alpha",
      },
      domSnapshot: null,
      consoleEntries: [{ level: "error" as const, message: "render failed" }],
      accessibilityFailures: [],
      errorCode: "BROWSER_ASSESSMENT_RENDER_FAILED",
      errorMessage: "The localized renderer did not settle.",
      traceId: "browser-assessment-2",
      trace: [],
    }));
    const extractMock = vi.fn(async () => ({
      status: "succeeded" as const,
      normalizedText: "Mission Control browser extraction",
      snippet: "Mission Control browser extraction",
      traceId: "browser-trace-1",
      trace: [],
    }));
    const getLastResultMock = vi.fn(async () => ({
      status: "failed" as const,
      normalizedText: null,
      snippet: null,
      errorCode: "LOCAL_CHROME_DEBUGGER_UNAVAILABLE",
      errorMessage: "Chrome DevTools is unavailable.",
      traceId: "browser-trace-2",
      trace: [],
    }));

    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      browserAssessment: {
        assess: assessMock,
        getLastResult: getLastAssessmentResultMock,
      },
      browserExtraction: {
        extract: extractMock,
        getLastResult: getLastResultMock,
      },
    });

    await expect(
      assessBrowserSurface({
        target: {
          kind: "fixture",
          fixtureName: "mission-control",
        },
        selector: "main",
      })
    ).resolves.toEqual({
      status: "passed",
      target: {
        kind: "fixture",
        fixtureName: "mission-control",
      },
      domSnapshot: {
        childElementCount: 3,
        html: "<main>Mission Control</main>",
        selector: "main",
        selectorMatched: true,
        text: "Mission Control",
      },
      consoleEntries: [],
      accessibilityFailures: [],
      traceId: "browser-assessment-1",
      trace: [],
    });
    await expect(getLastBrowserAssessmentResult()).resolves.toEqual({
      status: "failed",
      target: {
        kind: "route",
        routePath: "/workspace/alpha",
      },
      domSnapshot: null,
      consoleEntries: [{ level: "error", message: "render failed" }],
      accessibilityFailures: [],
      errorCode: "BROWSER_ASSESSMENT_RENDER_FAILED",
      errorMessage: "The localized renderer did not settle.",
      traceId: "browser-assessment-2",
      trace: [],
    });
    await expect(
      extractBrowserContent({
        sourceUrl: "https://example.com/browser-readiness",
        selector: "main",
      })
    ).resolves.toEqual({
      status: "succeeded",
      normalizedText: "Mission Control browser extraction",
      snippet: "Mission Control browser extraction",
      traceId: "browser-trace-1",
      trace: [],
    });
    await expect(getLastBrowserExtractionResult()).resolves.toEqual({
      status: "failed",
      normalizedText: null,
      snippet: null,
      errorCode: "LOCAL_CHROME_DEBUGGER_UNAVAILABLE",
      errorMessage: "Chrome DevTools is unavailable.",
      traceId: "browser-trace-2",
      trace: [],
    });

    expect(extractMock).toHaveBeenCalledWith({
      sourceUrl: "https://example.com/browser-readiness",
      selector: "main",
    });
    expect(assessMock).toHaveBeenCalledWith({
      target: {
        kind: "fixture",
        fixtureName: "mission-control",
      },
      selector: "main",
    });
    expect(getLastAssessmentResultMock).toHaveBeenCalledTimes(1);
    expect(getLastResultMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the desktop host does not publish browser assessment or extraction", async () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      browserAssessment: {},
      browserExtraction: {},
    });

    await expect(
      assessBrowserSurface({
        target: {
          kind: "route",
          routePath: "/workspace/alpha",
        },
      })
    ).resolves.toBeNull();
    await expect(getLastBrowserAssessmentResult()).resolves.toBeNull();
    await expect(extractBrowserContent()).resolves.toBeNull();
    await expect(getLastBrowserExtractionResult()).resolves.toBeNull();
  });
});
