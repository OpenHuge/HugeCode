import { useCallback, useEffect, useMemo, useState } from "react";
import type { DesktopBrowserAssessmentResult } from "@ku0/code-platform-interfaces";
import {
  assessBrowserSurface,
  getLastBrowserAssessmentResult,
  type RuntimeBrowserReadinessSummary,
} from "../ports/browserCapability";
import {
  reportRuntimeToolExecutionAttempted,
  reportRuntimeToolExecutionCompleted,
  reportRuntimeToolExecutionStarted,
} from "../../../services/runtimeToolExecutionMetricsReporter";

type RuntimeBrowserAssessmentResultTone = "success" | "warning" | "danger";
type RuntimeBrowserAssessmentResultSource = "assessment" | "history" | null;
type RuntimeBrowserAssessmentOperation = "assess" | "history" | null;

export type RuntimeBrowserAssessmentResultPresentation = {
  detail: string;
  headline: string;
  statusLabel: "Passed" | "Failed" | "Error";
  statusTone: RuntimeBrowserAssessmentResultTone;
  traceSummary: string | null;
};

export type RuntimeBrowserAssessmentOperatorState = {
  assess(): Promise<void>;
  assessDisabledReason: string | null;
  canAssess: boolean;
  canReviewLastResult: boolean;
  input: {
    selector: string;
    targetKind: "fixture" | "route";
    targetValue: string;
  };
  loading: boolean;
  notice: {
    message: string;
    tone: "neutral" | "warning" | "danger";
  } | null;
  result: DesktopBrowserAssessmentResult | null;
  resultPresentation: RuntimeBrowserAssessmentResultPresentation | null;
  resultSourceLabel: string | null;
  reviewLastResult(): Promise<void>;
  reviewLastResultDisabledReason: string | null;
  reviewingLastResult: boolean;
  runningAssessment: boolean;
  setSelector(value: string): void;
  setTargetKind(value: "fixture" | "route"): void;
  setTargetValue(value: string): void;
};

const EMPTY_HISTORY_MESSAGE =
  "No browser assessment result has been recorded by the Electron bridge yet.";
const TOOL_NAME = "assess-runtime-browser-surface";

function readTrimmedValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildTraceSummary(result: DesktopBrowserAssessmentResult): string | null {
  if (result.trace.length === 0) {
    return null;
  }
  return result.trace.map((entry) => entry.stage).join(" -> ");
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return "HugeCode could not complete the browser assessment request.";
}

export function buildRuntimeBrowserAssessmentResultPresentation(
  result: DesktopBrowserAssessmentResult
): RuntimeBrowserAssessmentResultPresentation {
  const traceSummary = buildTraceSummary(result);
  if (result.status === "passed") {
    return {
      statusLabel: "Passed",
      statusTone: "success",
      headline: "Browser assessment passed.",
      detail:
        "The localized render completed without detected console errors or accessibility failures.",
      traceSummary,
    };
  }
  if (result.status === "failed") {
    const accessibilityCount = result.accessibilityFailures.length;
    const consoleErrorCount = result.consoleEntries.filter(
      (entry) => entry.level === "error"
    ).length;
    return {
      statusLabel: "Failed",
      statusTone: "warning",
      headline: "Browser assessment found issues.",
      detail:
        result.errorMessage ??
        `Detected ${accessibilityCount} accessibility issue(s) and ${consoleErrorCount} console error(s) in the localized render.`,
      traceSummary,
    };
  }
  return {
    statusLabel: "Error",
    statusTone: "danger",
    headline: "Browser assessment could not complete.",
    detail:
      result.errorMessage ??
      "HugeCode could not collect the localized browser surface through the canonical proxy.",
    traceSummary,
  };
}

function buildRequest(input: {
  selector: string;
  targetKind: "fixture" | "route";
  targetValue: string;
}) {
  const targetValue = readTrimmedValue(input.targetValue);
  if (!targetValue) {
    return null;
  }
  return {
    selector: readTrimmedValue(input.selector) ?? undefined,
    target:
      input.targetKind === "fixture"
        ? {
            kind: "fixture" as const,
            fixtureName: targetValue,
          }
        : {
            kind: "route" as const,
            routePath: targetValue,
          },
  };
}

export function useRuntimeBrowserAssessmentOperator(
  workspaceId: string,
  readiness: RuntimeBrowserReadinessSummary
): RuntimeBrowserAssessmentOperatorState {
  const [targetKind, setTargetKind] = useState<"fixture" | "route">("fixture");
  const [targetValue, setTargetValue] = useState("");
  const [selector, setSelector] = useState("");
  const [operation, setOperation] = useState<RuntimeBrowserAssessmentOperation>(null);
  const [result, setResult] = useState<DesktopBrowserAssessmentResult | null>(
    readiness.lastAssessmentResult ?? null
  );
  const [resultSource, setResultSource] = useState<RuntimeBrowserAssessmentResultSource>(null);
  const [notice, setNotice] = useState<RuntimeBrowserAssessmentOperatorState["notice"]>(null);

  useEffect(() => {
    if (resultSource === "assessment" || resultSource === "history") {
      return;
    }
    setResult(readiness.lastAssessmentResult ?? null);
  }, [readiness.lastAssessmentResult, resultSource]);

  useEffect(() => {
    if (!readiness.assessmentHistoryAvailable || resultSource !== null || result !== null) {
      return;
    }
    let active = true;
    void getLastBrowserAssessmentResult()
      .then((nextResult) => {
        if (!active || !nextResult) {
          return;
        }
        setResult(nextResult);
        setResultSource("history");
      })
      .catch(() => {
        /* best-effort hydration only */
      });
    return () => {
      active = false;
    };
  }, [readiness.assessmentHistoryAvailable, result, resultSource]);

  const canAssess = readiness.assessmentAvailable;
  const canReviewLastResult = readiness.assessmentHistoryAvailable;
  const assessDisabledReason = canAssess
    ? targetValue.trim().length > 0
      ? null
      : "Provide a fixture name or route path before running the browser assessment."
    : readiness.recommendedAction;
  const reviewLastResultDisabledReason = canReviewLastResult
    ? null
    : "This host does not publish browser assessment history through the canonical runtime boundary.";

  const assess = useCallback(async () => {
    const request = buildRequest({
      selector,
      targetKind,
      targetValue,
    });
    if (!canAssess || !request) {
      setNotice({
        tone: canAssess ? "warning" : "danger",
        message: assessDisabledReason ?? "Browser assessment is unavailable on this host.",
      });
      return;
    }

    const startedAt = Date.now();
    setOperation("assess");
    setNotice(null);
    await reportRuntimeToolExecutionAttempted({
      toolName: TOOL_NAME,
      scope: "computer_observe",
      metadata: { workspaceId },
    }).catch(() => undefined);
    await reportRuntimeToolExecutionStarted({
      toolName: TOOL_NAME,
      scope: "computer_observe",
      metadata: { workspaceId },
    }).catch(() => undefined);

    try {
      const nextResult = await assessBrowserSurface(request);
      if (!nextResult) {
        setNotice({
          tone: "danger",
          message: "Browser assessment capability is unavailable on this host.",
        });
        await reportRuntimeToolExecutionCompleted({
          toolName: TOOL_NAME,
          scope: "computer_observe",
          status: "runtime_failed",
          errorCode: "BROWSER_ASSESSMENT_UNAVAILABLE",
          durationMs: Date.now() - startedAt,
          metadata: { workspaceId },
        }).catch(() => undefined);
        return;
      }
      setResult(nextResult);
      setResultSource("assessment");
      setNotice(null);
      await reportRuntimeToolExecutionCompleted({
        toolName: TOOL_NAME,
        scope: "computer_observe",
        status: nextResult.status === "passed" ? "success" : "runtime_failed",
        errorCode: nextResult.errorCode ?? null,
        durationMs: Date.now() - startedAt,
        metadata: { workspaceId },
      }).catch(() => undefined);
    } catch (error) {
      const message = readErrorMessage(error);
      setNotice({
        tone: "danger",
        message,
      });
      await reportRuntimeToolExecutionCompleted({
        toolName: TOOL_NAME,
        scope: "computer_observe",
        status: "runtime_failed",
        errorCode: "BROWSER_ASSESSMENT_FAILED",
        durationMs: Date.now() - startedAt,
        metadata: { workspaceId },
      }).catch(() => undefined);
    } finally {
      setOperation(null);
    }
  }, [assessDisabledReason, canAssess, selector, targetKind, targetValue, workspaceId]);

  const reviewLastResult = useCallback(async () => {
    if (!canReviewLastResult) {
      setNotice({
        tone: "warning",
        message:
          reviewLastResultDisabledReason ??
          "Browser assessment history is unavailable on this host.",
      });
      return;
    }

    setOperation("history");
    try {
      const nextResult = await getLastBrowserAssessmentResult();
      if (!nextResult) {
        setNotice({
          tone: "neutral",
          message: EMPTY_HISTORY_MESSAGE,
        });
        return;
      }
      setResult(nextResult);
      setResultSource("history");
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "danger",
        message: readErrorMessage(error),
      });
    } finally {
      setOperation(null);
    }
  }, [canReviewLastResult, reviewLastResultDisabledReason]);

  const resultSourceLabel = useMemo(() => {
    if (resultSource === "assessment") {
      return "Latest assessment";
    }
    if (resultSource === "history") {
      return "Recorded assessment";
    }
    return null;
  }, [resultSource]);

  const resultPresentation = useMemo(
    () => (result ? buildRuntimeBrowserAssessmentResultPresentation(result) : null),
    [result]
  );

  return {
    assess,
    assessDisabledReason,
    canAssess,
    canReviewLastResult,
    input: {
      selector,
      targetKind,
      targetValue,
    },
    loading: operation !== null,
    notice,
    result,
    resultPresentation,
    resultSourceLabel,
    reviewLastResult,
    reviewLastResultDisabledReason,
    reviewingLastResult: operation === "history",
    runningAssessment: operation === "assess",
    setSelector,
    setTargetKind,
    setTargetValue,
  };
}
