import { useCallback, useEffect, useState } from "react";
import type {
  RuntimeMiniProgramAction,
  RuntimeMiniProgramActionRunRequest,
  RuntimeMiniProgramActionRunResponse,
  RuntimeMiniProgramStatusResponse,
} from "@ku0/code-runtime-host-contract";
import { readRuntimeErrorMessage } from "../ports/runtimeErrorClassifier";
import {
  getRuntimeMiniProgramStatus,
  runRuntimeMiniProgramAction,
} from "../ports/runtimeAutomation";

export type RuntimeMiniProgramOperatorNotice = {
  tone: "info" | "warning" | "danger";
  message: string;
} | null;

export type RuntimeMiniProgramOperatorState = {
  status: RuntimeMiniProgramStatusResponse | null;
  loading: boolean;
  refreshing: boolean;
  runningAction: RuntimeMiniProgramAction | null;
  lastActionResult: RuntimeMiniProgramActionRunResponse | null;
  error: string | null;
  notice: RuntimeMiniProgramOperatorNotice;
  refresh: () => Promise<void>;
  runAction: (request: Omit<RuntimeMiniProgramActionRunRequest, "workspaceId">) => Promise<void>;
};

function buildNotice(
  status: RuntimeMiniProgramStatusResponse | null,
  actionResult: RuntimeMiniProgramActionRunResponse | null,
  error: string | null
): RuntimeMiniProgramOperatorNotice {
  if (error) {
    return {
      tone: "danger",
      message: error,
    };
  }
  if (actionResult && actionResult.status !== "completed") {
    return {
      tone: actionResult.status === "blocked" ? "warning" : "danger",
      message: actionResult.message,
    };
  }
  if (status?.warnings?.[0]) {
    return {
      tone: status.status === "blocked" || status.status === "unavailable" ? "warning" : "info",
      message: status.warnings[0],
    };
  }
  return null;
}

export function useRuntimeMiniProgramOperator(
  workspaceId: string
): RuntimeMiniProgramOperatorState {
  const [status, setStatus] = useState<RuntimeMiniProgramStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningAction, setRunningAction] = useState<RuntimeMiniProgramAction | null>(null);
  const [lastActionResult, setLastActionResult] =
    useState<RuntimeMiniProgramActionRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const nextStatus = await getRuntimeMiniProgramStatus(workspaceId);
      setStatus(nextStatus);
      setError(null);
    } catch (readError) {
      setError(readRuntimeErrorMessage(readError) ?? "Failed to read mini program status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setRefreshing(false);
    setError(null);
    setStatus(null);
    setLastActionResult(null);
    void getRuntimeMiniProgramStatus(workspaceId)
      .then((nextStatus) => {
        if (!mounted) {
          return;
        }
        setStatus(nextStatus);
      })
      .catch((readError) => {
        if (!mounted) {
          return;
        }
        setError(readRuntimeErrorMessage(readError) ?? "Failed to read mini program status.");
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  const runAction = useCallback(
    async (request: Omit<RuntimeMiniProgramActionRunRequest, "workspaceId">) => {
      setRunningAction(request.action);
      setError(null);
      try {
        const result = await runRuntimeMiniProgramAction({
          workspaceId,
          ...request,
        });
        setLastActionResult(result);
        const nextStatus = await getRuntimeMiniProgramStatus(workspaceId);
        setStatus(nextStatus);
      } catch (runError) {
        setError(readRuntimeErrorMessage(runError) ?? "Failed to run mini program action.");
      } finally {
        setRunningAction(null);
      }
    },
    [workspaceId]
  );

  return {
    status,
    loading,
    refreshing,
    runningAction,
    lastActionResult,
    error,
    notice: buildNotice(status, lastActionResult, error),
    refresh,
    runAction,
  };
}
