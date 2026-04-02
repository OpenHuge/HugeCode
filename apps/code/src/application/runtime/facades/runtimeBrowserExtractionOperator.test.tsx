// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeBrowserReadinessSummary } from "../ports/browserCapability";
import {
  buildRuntimeBrowserExtractionResultPresentation,
  useRuntimeBrowserExtractionOperator,
} from "./runtimeBrowserExtractionOperator";

const { extractBrowserContentMock, getLastBrowserExtractionResultMock } = vi.hoisted(() => ({
  extractBrowserContentMock: vi.fn(),
  getLastBrowserExtractionResultMock: vi.fn(),
}));

vi.mock("../ports/browserCapability", () => ({
  extractBrowserContent: extractBrowserContentMock,
  getLastBrowserExtractionResult: getLastBrowserExtractionResultMock,
}));

function createReadinessSummary(
  overrides: Partial<RuntimeBrowserReadinessSummary> = {}
): RuntimeBrowserReadinessSummary {
  return {
    state: "ready",
    headline: "Browser readiness confirmed",
    detail: "Desktop host bridge publishes the browser extraction contract.",
    recommendedAction: "Use the desktop-host browser extraction contract.",
    runtimeHost: "electron",
    source: "desktop_host_bridge",
    sourceLabel: "Desktop host bridge",
    assessmentAvailable: false,
    assessmentHistoryAvailable: false,
    extractionAvailable: true,
    historyAvailable: true,
    localOnly: false,
    lastAssessmentResult: null,
    lastResult: null,
    capabilities: {
      browserAssessment: false,
      browserAssessmentHistory: false,
      browserDebug: true,
      browserExtraction: true,
      browserExtractionHistory: true,
      webMcp: false,
    },
    ...overrides,
  };
}

describe("runtimeBrowserExtractionOperator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    extractBrowserContentMock.mockResolvedValue(null);
    getLastBrowserExtractionResultMock.mockResolvedValue(null);
  });

  it("keeps readiness placeholder results when live extraction is unavailable", () => {
    const placeholderResult = {
      status: "empty" as const,
      normalizedText: null,
      snippet: null,
      errorCode: "LOCAL_PLACEHOLDER_STATE",
      errorMessage: "Placeholder browser extraction state only.",
      traceId: null,
      trace: [],
    };
    const { result } = renderHook(() =>
      useRuntimeBrowserExtractionOperator(
        createReadinessSummary({
          state: "attention",
          source: "local_placeholder",
          sourceLabel: "Local placeholder",
          extractionAvailable: false,
          historyAvailable: false,
          localOnly: true,
          lastResult: placeholderResult,
        })
      )
    );

    expect(result.current.canExtract).toBe(false);
    expect(result.current.canReviewLastResult).toBe(false);
    expect(result.current.result).toEqual(placeholderResult);
    expect(result.current.resultSourceLabel).toBe("Readiness placeholder");
  });

  it("blocks history review when the host does not publish a last-result capability", async () => {
    const { result } = renderHook(() =>
      useRuntimeBrowserExtractionOperator(
        createReadinessSummary({
          historyAvailable: false,
          capabilities: {
            browserAssessment: false,
            browserAssessmentHistory: false,
            browserDebug: true,
            browserExtraction: true,
            browserExtractionHistory: false,
            webMcp: false,
          },
        })
      )
    );

    await act(async () => {
      await result.current.reviewLastResult();
    });

    expect(getLastBrowserExtractionResultMock).not.toHaveBeenCalled();
    expect(result.current.canExtract).toBe(true);
    expect(result.current.canReviewLastResult).toBe(false);
    expect(result.current.notice).toEqual({
      tone: "warning",
      message:
        "This host does not publish browser extraction history through the canonical runtime boundary.",
    });
  });

  it("submits trimmed browser extraction input through the canonical boundary", async () => {
    extractBrowserContentMock.mockResolvedValue({
      status: "succeeded",
      normalizedText: "Mission Control browser extraction is ready.",
      snippet: "Mission Control browser extraction is ready.",
      sourceUrl: "https://example.com/browser-readiness",
      title: "Browser readiness",
      traceId: "browser-trace-1",
      trace: [],
    });

    const { result } = renderHook(() =>
      useRuntimeBrowserExtractionOperator(createReadinessSummary())
    );

    act(() => {
      result.current.setSourceUrl("  https://example.com/browser-readiness  ");
      result.current.setSelector("  main article  ");
    });

    await act(async () => {
      await result.current.extract();
    });

    expect(extractBrowserContentMock).toHaveBeenCalledWith({
      sourceUrl: "https://example.com/browser-readiness",
      selector: "main article",
    });
    expect(result.current.result?.status).toBe("succeeded");
    expect(result.current.resultSourceLabel).toBe("Latest extraction");
    expect(result.current.notice).toBeNull();
  });

  it("can review the last host result without overwriting the current result when history is empty", async () => {
    getLastBrowserExtractionResultMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useRuntimeBrowserExtractionOperator(createReadinessSummary())
    );

    await act(async () => {
      await result.current.reviewLastResult();
    });

    expect(getLastBrowserExtractionResultMock).toHaveBeenCalledTimes(1);
    expect(result.current.result).toBeNull();
    expect(result.current.notice).toEqual({
      tone: "neutral",
      message: "No browser extraction result has been recorded by the Electron bridge yet.",
    });
  });

  it("describes no-local-target empty results without reinterpreting readiness state", () => {
    const presentation = buildRuntimeBrowserExtractionResultPresentation({
      status: "empty",
      normalizedText: null,
      snippet: null,
      errorCode: "BROWSER_PAGE_TARGET_UNAVAILABLE",
      errorMessage: "No debuggable browser page target is currently available for extraction.",
      traceId: "browser-trace-2",
      trace: [
        {
          stage: "availability",
          at: "2026-03-30T00:00:00.000Z",
          message: "Resolved a local Chrome DevTools endpoint for browser extraction.",
        },
        {
          stage: "capture",
          at: "2026-03-30T00:00:01.000Z",
          message: "No debuggable browser page target was available for extraction.",
        },
      ],
    });

    expect(presentation.statusLabel).toBe("Empty");
    expect(presentation.headline).toContain("No debuggable local browser page");
    expect(presentation.noDebugTargetDetail).toContain("No local debuggable browser page");
    expect(presentation.traceSummary).toBe("availability -> capture");
  });

  it("surfaces Chrome 136+ remote-debugging remediation when DevTools is unavailable", () => {
    const presentation = buildRuntimeBrowserExtractionResultPresentation({
      status: "failed",
      normalizedText: null,
      snippet: null,
      errorCode: "LOCAL_CHROME_DEBUGGER_UNAVAILABLE",
      errorMessage: "Local Chrome DevTools is unavailable.",
      traceId: "browser-trace-3",
      trace: [
        {
          stage: "availability",
          at: "2026-03-30T00:00:00.000Z",
          message: "No local Chrome DevTools endpoint with an HTTP base URL is available.",
        },
      ],
    });

    expect(presentation.statusLabel).toBe("Failed");
    expect(presentation.detail).toContain("Local Chrome DevTools is unavailable");
    expect(presentation.recommendedAction).toContain("--user-data-dir");
    expect(presentation.noDebugTargetDetail).toContain("--user-data-dir");
  });
});
