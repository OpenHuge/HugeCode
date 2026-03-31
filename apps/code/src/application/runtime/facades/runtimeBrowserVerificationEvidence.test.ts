import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopBrowserExtractionResult } from "@ku0/code-platform-interfaces";
import type { RuntimeBrowserReadinessSummary } from "../ports/browserCapability";
import {
  __resetRuntimeBrowserVerificationEvidenceForTests,
  attachRuntimeBrowserVerificationEvidence,
  ignoreRuntimeBrowserVerificationCandidate,
  listRuntimeBrowserVerificationAttachments,
  readRuntimeBrowserVerificationCandidate,
  recordRuntimeBrowserVerificationResult,
  recordRuntimeBrowserVerificationTriggered,
  subscribeRuntimeBrowserVerificationEvents,
} from "./runtimeBrowserVerificationEvidence";

vi.mock("../../../features/shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

function buildReadiness(
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

function buildExtractionResult(
  overrides: Partial<DesktopBrowserExtractionResult> = {}
): DesktopBrowserExtractionResult {
  return {
    status: "succeeded",
    normalizedText: "Browser verification captured the published UI state.",
    snippet: "Browser verification captured the published UI state.",
    sourceUrl: "https://example.com/review",
    title: "Review page",
    errorCode: null,
    errorMessage: null,
    traceId: "browser-trace-1",
    trace: [
      {
        stage: "availability",
        at: "2026-03-31T00:00:00.000Z",
        message: "Resolved a local Chrome DevTools endpoint for browser extraction.",
      },
      {
        stage: "capture",
        at: "2026-03-31T00:00:01.000Z",
        message: "Captured normalized browser text.",
      },
    ],
    ...overrides,
  };
}

describe("runtimeBrowserVerificationEvidence", () => {
  beforeEach(() => {
    __resetRuntimeBrowserVerificationEvidenceForTests();
    vi.clearAllMocks();
  });

  it("records extraction lifecycle events and attaches provenance-backed evidence to a review pack", () => {
    const events: string[] = [];
    const unsubscribe = subscribeRuntimeBrowserVerificationEvents((event) => {
      events.push(event.kind);
    });

    recordRuntimeBrowserVerificationTriggered({
      workspaceId: "workspace-1",
      readiness: buildReadiness(),
      input: {
        sourceUrl: "https://example.com/review",
        selector: "main article",
      },
    });

    recordRuntimeBrowserVerificationResult({
      workspaceId: "workspace-1",
      readiness: buildReadiness(),
      source: "extract",
      input: {
        sourceUrl: "https://example.com/review",
        selector: "main article",
      },
      result: buildExtractionResult(),
    });

    const attachment = attachRuntimeBrowserVerificationEvidence({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
    });

    unsubscribe();

    expect(events).toEqual(["triggered", "succeeded", "attached"]);
    expect(attachment).not.toBeNull();
    expect(attachment?.artifact.kind).toBe("evidence");
    expect(attachment?.artifact.label).toBe("Browser verification");
    expect(attachment?.sourceUrl).toBe("https://example.com/review");
    expect(attachment?.selector).toBe("main article");
    expect(attachment?.readinessSource).toBe("desktop_host_bridge");
    expect(attachment?.runtimeHost).toBe("electron");
    expect(attachment?.traceId).toBe("browser-trace-1");
    expect(
      listRuntimeBrowserVerificationAttachments({
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      })
    ).toEqual([attachment]);
    expect(readRuntimeBrowserVerificationCandidate("workspace-1")?.status).toBe("attached");
  });

  it("allows operators to ignore the latest browser verification candidate", () => {
    const events: string[] = [];
    const unsubscribe = subscribeRuntimeBrowserVerificationEvents((event) => {
      events.push(event.kind);
    });

    recordRuntimeBrowserVerificationResult({
      workspaceId: "workspace-1",
      readiness: buildReadiness(),
      source: "extract",
      input: {
        sourceUrl: "https://example.com/review",
        selector: "main article",
      },
      result: buildExtractionResult({
        status: "failed",
        normalizedText: null,
        snippet: null,
        errorCode: "LOCAL_CHROME_DEBUGGER_UNAVAILABLE",
        errorMessage: "Local Chrome DevTools is unavailable.",
      }),
    });

    ignoreRuntimeBrowserVerificationCandidate({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
    });

    unsubscribe();

    expect(events).toEqual(["failed", "ignored"]);
    expect(readRuntimeBrowserVerificationCandidate("workspace-1")?.status).toBe("ignored");
    expect(
      listRuntimeBrowserVerificationAttachments({
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      })
    ).toHaveLength(0);
  });

  it("does not let a review-scoped candidate attach to a different review pack in the same workspace", () => {
    recordRuntimeBrowserVerificationResult({
      workspaceId: "workspace-1",
      readiness: buildReadiness(),
      source: "extract",
      intendedScope: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
      result: buildExtractionResult(),
    });

    const wrongAttachment = attachRuntimeBrowserVerificationEvidence({
      workspaceId: "workspace-1",
      taskId: "task-2",
      runId: "run-2",
      reviewPackId: "review-pack-2",
    });
    const correctAttachment = attachRuntimeBrowserVerificationEvidence({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
    });

    expect(wrongAttachment).toBeNull();
    expect(correctAttachment).not.toBeNull();
    expect(
      listRuntimeBrowserVerificationAttachments({
        workspaceId: "workspace-1",
        taskId: "task-2",
        runId: "run-2",
        reviewPackId: "review-pack-2",
      })
    ).toEqual([]);
    expect(
      listRuntimeBrowserVerificationAttachments({
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      })
    ).toEqual([correctAttachment]);
  });
});
