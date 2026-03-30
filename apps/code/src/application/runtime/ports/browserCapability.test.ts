import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractBrowserContent, getLastBrowserExtractionResult } from "./browserCapability";

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
      browserExtraction: {
        extract: extractMock,
        getLastResult: getLastResultMock,
      },
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
    expect(getLastResultMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the desktop host does not publish browser extraction", async () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      browserExtraction: {},
    });

    await expect(extractBrowserContent()).resolves.toBeNull();
    await expect(getLastBrowserExtractionResult()).resolves.toBeNull();
  });
});
