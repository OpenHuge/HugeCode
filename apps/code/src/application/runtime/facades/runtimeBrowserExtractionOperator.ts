import { useCallback, useEffect, useMemo, useState } from "react";
import type { DesktopBrowserExtractionResult } from "@ku0/code-platform-interfaces";
import {
  extractBrowserContent,
  getLastBrowserExtractionResult,
  type RuntimeBrowserReadinessSummary,
} from "../ports/browserCapability";
import {
  recordRuntimeBrowserVerificationResult,
  recordRuntimeBrowserVerificationTriggered,
} from "./runtimeBrowserVerificationEvidence";

type RuntimeBrowserExtractionResultTone = "success" | "warning" | "danger";
type RuntimeBrowserExtractionResultSource = "readiness" | "extract" | "history" | null;
type RuntimeBrowserExtractionOperation = "extract" | "history" | null;

export type RuntimeBrowserExtractionResultPresentation = {
  statusLabel: "Succeeded" | "Partial" | "Empty" | "Failed";
  statusTone: RuntimeBrowserExtractionResultTone;
  headline: string;
  detail: string;
  recommendedAction: string | null;
  traceSummary: string | null;
  noDebugTargetDetail: string | null;
};

export type RuntimeBrowserExtractionOperatorState = {
  canExtract: boolean;
  canReviewLastResult: boolean;
  extractDisabledReason: string | null;
  reviewLastResultDisabledReason: string | null;
  loading: boolean;
  extracting: boolean;
  reviewingLastResult: boolean;
  input: {
    sourceUrl: string;
    selector: string;
  };
  setSourceUrl(value: string): void;
  setSelector(value: string): void;
  extract(): Promise<void>;
  reviewLastResult(): Promise<void>;
  result: DesktopBrowserExtractionResult | null;
  resultSourceLabel: string | null;
  resultPresentation: RuntimeBrowserExtractionResultPresentation | null;
  notice: {
    tone: "neutral" | "warning" | "danger";
    message: string;
  } | null;
};

export type RuntimeBrowserVerificationTelemetryContext = {
  workspaceId: string;
  taskId?: string | null;
  runId?: string | null;
  reviewPackId?: string | null;
  eventSource?: "mission_control" | "review_surface" | null;
};

const EMPTY_HISTORY_MESSAGE =
  "No browser extraction result has been recorded by the Electron bridge yet.";

function readTrimmedValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildResultTargetLabel(result: DesktopBrowserExtractionResult): string {
  const title = readTrimmedValue(result.title ?? "");
  if (title) {
    return title;
  }
  const sourceUrl = readTrimmedValue(result.sourceUrl ?? "");
  if (sourceUrl) {
    return sourceUrl;
  }
  return "the selected browser page";
}

function buildTraceSummary(result: DesktopBrowserExtractionResult): string | null {
  if (result.trace.length === 0) {
    return null;
  }
  return result.trace.map((entry) => entry.stage).join(" -> ");
}

function buildNoDebugTargetDetail(result: DesktopBrowserExtractionResult): string | null {
  switch (result.errorCode) {
    case "BROWSER_PAGE_TARGET_UNAVAILABLE":
      return "No local debuggable browser page is currently available. Open the intended page in a Chromium-based browser with remote debugging enabled, and if you are on Chrome 136 or later, use a non-default --user-data-dir before retrying.";
    case "BROWSER_SOURCE_URL_NOT_FOUND":
      return "HugeCode could not find a debuggable local browser tab for the requested page URL. Open that page locally or clear the URL filter and retry.";
    case "LOCAL_CHROME_DEBUGGER_UNAVAILABLE":
      return "HugeCode could not reach a local Chrome DevTools endpoint. Start Chrome or Chromium with remote debugging enabled in a non-default profile; Chrome 136 and later require --user-data-dir together with --remote-debugging-port before retrying extraction.";
    case "BROWSER_PAGE_TARGET_NOT_DEBUGGABLE":
      return "The selected local browser page was discovered, but it did not expose a debuggable DevTools page target.";
    default:
      return null;
  }
}

export function buildRuntimeBrowserExtractionResultPresentation(
  result: DesktopBrowserExtractionResult
): RuntimeBrowserExtractionResultPresentation {
  const targetLabel = buildResultTargetLabel(result);
  const traceSummary = buildTraceSummary(result);
  const noDebugTargetDetail = buildNoDebugTargetDetail(result);

  switch (result.status) {
    case "succeeded":
      return {
        statusLabel: "Succeeded",
        statusTone: "success",
        headline: "Browser extraction completed.",
        detail: `Normalized browser text is ready from ${targetLabel}.`,
        recommendedAction: "Review the extracted text below or rerun against a narrower selector.",
        traceSummary,
        noDebugTargetDetail,
      };
    case "partial":
      return {
        statusLabel: "Partial",
        statusTone: "warning",
        headline: "Browser extraction completed with truncation.",
        detail:
          result.errorMessage ??
          `HugeCode captured a truncated normalized excerpt from ${targetLabel}.`,
        recommendedAction:
          "Use a page URL or selector to narrow the capture target if you need a more focused excerpt.",
        traceSummary,
        noDebugTargetDetail,
      };
    case "empty":
      switch (result.errorCode) {
        case "BROWSER_PAGE_TARGET_UNAVAILABLE":
          return {
            statusLabel: "Empty",
            statusTone: "warning",
            headline: "No debuggable local browser page is available.",
            detail:
              result.errorMessage ??
              "HugeCode did not find a debuggable local browser page target for extraction.",
            recommendedAction:
              "Open the intended page in a local Chromium browser with remote debugging enabled. On Chrome 136 and later, use a non-default --user-data-dir before retrying extraction.",
            traceSummary,
            noDebugTargetDetail,
          };
        case "BROWSER_SOURCE_URL_NOT_FOUND":
          return {
            statusLabel: "Empty",
            statusTone: "warning",
            headline: "The requested page URL was not found.",
            detail:
              result.errorMessage ??
              "HugeCode could not match the requested page URL to a debuggable local browser target.",
            recommendedAction:
              "Open the requested page locally or clear the page URL filter to target the current debuggable page.",
            traceSummary,
            noDebugTargetDetail,
          };
        case "BROWSER_SELECTOR_NOT_FOUND":
          return {
            statusLabel: "Empty",
            statusTone: "warning",
            headline: "The requested selector was not found.",
            detail:
              result.errorMessage ??
              "HugeCode could not resolve the requested selector on the selected browser page.",
            recommendedAction:
              "Adjust the selector or clear it to extract text from the whole page.",
            traceSummary,
            noDebugTargetDetail,
          };
        case "BROWSER_TEXT_EMPTY":
          return {
            statusLabel: "Empty",
            statusTone: "warning",
            headline: "The selected page did not yield extractable text.",
            detail:
              result.errorMessage ??
              "HugeCode reached the page but no normalized text remained after extraction.",
            recommendedAction:
              "Retry on a content-bearing page or narrow the extraction to a selector that contains visible text.",
            traceSummary,
            noDebugTargetDetail,
          };
        default:
          return {
            statusLabel: "Empty",
            statusTone: "warning",
            headline: "Browser extraction returned no text.",
            detail:
              result.errorMessage ??
              "HugeCode did not receive normalized text from the selected page.",
            recommendedAction:
              "Retry with a different page or selector once the local browser target contains the content you need.",
            traceSummary,
            noDebugTargetDetail,
          };
      }
    case "failed":
      switch (result.errorCode) {
        case "LOCAL_CHROME_DEBUGGER_UNAVAILABLE":
          return {
            statusLabel: "Failed",
            statusTone: "danger",
            headline: "Local Chrome DevTools is unavailable.",
            detail:
              result.errorMessage ??
              "HugeCode could not reach a local Chromium DevTools endpoint for browser extraction.",
            recommendedAction:
              "Start Chrome or Chromium with remote debugging enabled in a non-default profile. Chrome 136 and later require --user-data-dir together with --remote-debugging-port.",
            traceSummary,
            noDebugTargetDetail,
          };
        case "BROWSER_PAGE_TARGET_NOT_DEBUGGABLE":
          return {
            statusLabel: "Failed",
            statusTone: "danger",
            headline: "The selected page is not debuggable.",
            detail:
              result.errorMessage ??
              "HugeCode found the page, but DevTools did not expose a debuggable page target.",
            recommendedAction:
              "Retry with a debuggable Chromium page or reopen the page in a local profile with DevTools support.",
            traceSummary,
            noDebugTargetDetail,
          };
        default:
          return {
            statusLabel: "Failed",
            statusTone: "danger",
            headline: "Browser extraction failed.",
            detail: result.errorMessage ?? "HugeCode hit an unexpected browser extraction failure.",
            recommendedAction:
              "Inspect the failure details below and retry when the local browser target and DevTools transport are stable.",
            traceSummary,
            noDebugTargetDetail,
          };
      }
  }
}

function buildRequest(input: { sourceUrl: string; selector: string }) {
  const sourceUrl = readTrimmedValue(input.sourceUrl);
  const selector = readTrimmedValue(input.selector);
  if (!sourceUrl && !selector) {
    return undefined;
  }
  return {
    sourceUrl: sourceUrl ?? undefined,
    selector: selector ?? undefined,
  };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return "HugeCode could not complete the browser extraction request.";
}

export function useRuntimeBrowserExtractionOperator(
  readiness: RuntimeBrowserReadinessSummary,
  telemetryContext?: RuntimeBrowserVerificationTelemetryContext
): RuntimeBrowserExtractionOperatorState {
  const [sourceUrl, setSourceUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [operation, setOperation] = useState<RuntimeBrowserExtractionOperation>(null);
  const [result, setResult] = useState<DesktopBrowserExtractionResult | null>(
    readiness.lastResult ?? null
  );
  const [resultSource, setResultSource] = useState<RuntimeBrowserExtractionResultSource>(
    readiness.lastResult ? "readiness" : null
  );
  const [notice, setNotice] = useState<RuntimeBrowserExtractionOperatorState["notice"]>(null);

  useEffect(() => {
    if (resultSource === "extract" || resultSource === "history") {
      return;
    }
    setResult(readiness.lastResult ?? null);
    setResultSource(readiness.lastResult ? "readiness" : null);
  }, [readiness.lastResult, resultSource]);

  const canExtract = readiness.extractionAvailable;
  const canReviewLastResult = readiness.historyAvailable;
  const extractDisabledReason = canExtract ? null : readiness.recommendedAction;
  const reviewLastResultDisabledReason = canReviewLastResult
    ? null
    : "This host does not publish browser extraction history through the canonical runtime boundary.";

  const extract = useCallback(async () => {
    if (!canExtract) {
      setNotice({
        tone: "warning",
        message: readiness.recommendedAction,
      });
      return;
    }

    setOperation("extract");
    setNotice(null);
    if (telemetryContext?.workspaceId) {
      recordRuntimeBrowserVerificationTriggered({
        workspaceId: telemetryContext.workspaceId,
        readiness,
        input: buildRequest({ sourceUrl, selector }),
        intendedScope:
          telemetryContext.taskId && telemetryContext.runId
            ? {
                workspaceId: telemetryContext.workspaceId,
                taskId: telemetryContext.taskId,
                runId: telemetryContext.runId,
                reviewPackId: telemetryContext.reviewPackId ?? null,
              }
            : null,
        eventSource: telemetryContext.eventSource ?? null,
      });
    }
    try {
      const nextResult = await extractBrowserContent(buildRequest({ sourceUrl, selector }));
      if (!nextResult) {
        setNotice({
          tone: "warning",
          message:
            "Electron bridge did not return a browser extraction result. Retry once the bridge is stable.",
        });
        return;
      }
      if (telemetryContext?.workspaceId) {
        recordRuntimeBrowserVerificationResult({
          workspaceId: telemetryContext.workspaceId,
          readiness,
          source: "extract",
          input: buildRequest({ sourceUrl, selector }),
          result: nextResult,
          intendedScope:
            telemetryContext.taskId && telemetryContext.runId
              ? {
                  workspaceId: telemetryContext.workspaceId,
                  taskId: telemetryContext.taskId,
                  runId: telemetryContext.runId,
                  reviewPackId: telemetryContext.reviewPackId ?? null,
                }
              : null,
          eventSource: telemetryContext.eventSource ?? null,
        });
      }
      setResult(nextResult);
      setResultSource("extract");
    } catch (error) {
      setNotice({
        tone: "danger",
        message: readErrorMessage(error),
      });
    } finally {
      setOperation(null);
    }
  }, [canExtract, readiness, selector, sourceUrl, telemetryContext]);

  const reviewLastResult = useCallback(async () => {
    if (!canReviewLastResult) {
      setNotice({
        tone: "warning",
        message: reviewLastResultDisabledReason ?? EMPTY_HISTORY_MESSAGE,
      });
      return;
    }

    setOperation("history");
    setNotice(null);
    try {
      const nextResult = await getLastBrowserExtractionResult();
      if (!nextResult) {
        setNotice({
          tone: "neutral",
          message: EMPTY_HISTORY_MESSAGE,
        });
        return;
      }
      if (telemetryContext?.workspaceId) {
        recordRuntimeBrowserVerificationResult({
          workspaceId: telemetryContext.workspaceId,
          readiness,
          source: "history",
          result: nextResult,
          intendedScope:
            telemetryContext.taskId && telemetryContext.runId
              ? {
                  workspaceId: telemetryContext.workspaceId,
                  taskId: telemetryContext.taskId,
                  runId: telemetryContext.runId,
                  reviewPackId: telemetryContext.reviewPackId ?? null,
                }
              : null,
          eventSource: telemetryContext.eventSource ?? null,
        });
      }
      setResult(nextResult);
      setResultSource("history");
    } catch (error) {
      setNotice({
        tone: "danger",
        message: readErrorMessage(error),
      });
    } finally {
      setOperation(null);
    }
  }, [canReviewLastResult, readiness, reviewLastResultDisabledReason, telemetryContext]);

  const resultPresentation = useMemo(
    () => (result ? buildRuntimeBrowserExtractionResultPresentation(result) : null),
    [result]
  );

  return {
    canExtract,
    canReviewLastResult,
    extractDisabledReason,
    reviewLastResultDisabledReason,
    loading: operation !== null,
    extracting: operation === "extract",
    reviewingLastResult: operation === "history",
    input: {
      sourceUrl,
      selector,
    },
    setSourceUrl,
    setSelector,
    extract,
    reviewLastResult,
    result,
    resultSourceLabel:
      resultSource === "extract"
        ? "Latest extraction"
        : resultSource === "history"
          ? "Last host result"
          : resultSource === "readiness"
            ? "Readiness placeholder"
            : null,
    resultPresentation,
    notice,
  };
}
