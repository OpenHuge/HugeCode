import { useCallback, useEffect, useRef, useState } from "react";
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

function readMiniProgramErrorMessage(error: unknown, fallback: string) {
  return readRuntimeErrorMessage(error) ?? fallback;
}

export function buildRuntimeMiniProgramNotice(
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
  const mountedRef = useRef(true);
  const initialLoadIdRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setStateIfMounted = useCallback(
    <TValue>(setter: (value: TValue) => void, value: TValue) => {
      if (!mountedRef.current) {
        return;
      }
      setter(value);
    },
    []
  );

  const readStatus = useCallback(
    async (mode: "initial" | "refresh" | "after_action", initialLoadId?: number) => {
      const isStaleInitialLoad = () =>
        mode === "initial" &&
        typeof initialLoadId === "number" &&
        initialLoadId !== initialLoadIdRef.current;
      try {
        const nextStatus = await getRuntimeMiniProgramStatus(workspaceId);
        if (isStaleInitialLoad()) {
          return null;
        }
        setStateIfMounted(setStatus, nextStatus);
        setStateIfMounted(setError, null);
        return nextStatus;
      } catch (readError) {
        if (isStaleInitialLoad()) {
          return null;
        }
        setStateIfMounted(
          setError,
          readMiniProgramErrorMessage(readError, "Failed to read mini program status.")
        );
        return null;
      } finally {
        if (mode === "initial") {
          if (!isStaleInitialLoad()) {
            setStateIfMounted(setLoading, false);
          }
        }
        if (mode === "refresh") {
          setStateIfMounted(setLoading, false);
          setStateIfMounted(setRefreshing, false);
        }
      }
    },
    [setStateIfMounted, workspaceId]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await readStatus("refresh");
  }, [readStatus]);

  useEffect(() => {
    const initialLoadId = initialLoadIdRef.current + 1;
    initialLoadIdRef.current = initialLoadId;
    setLoading(true);
    setRefreshing(false);
    setError(null);
    setStatus(null);
    setLastActionResult(null);
    void readStatus("initial", initialLoadId);
  }, [readStatus, workspaceId]);

  const runAction = useCallback(
    async (request: Omit<RuntimeMiniProgramActionRunRequest, "workspaceId">) => {
      setRunningAction(request.action);
      setError(null);
      try {
        const result = await runRuntimeMiniProgramAction({
          workspaceId,
          ...request,
        });
        setStateIfMounted(setLastActionResult, result);
        await readStatus("after_action");
      } catch (runError) {
        setStateIfMounted(
          setError,
          readMiniProgramErrorMessage(runError, "Failed to run mini program action.")
        );
      } finally {
        setStateIfMounted(setRunningAction, null);
      }
    },
    [readStatus, setStateIfMounted, workspaceId]
  );

  return {
    status,
    loading,
    refreshing,
    runningAction,
    lastActionResult,
    error,
    notice: buildRuntimeMiniProgramNotice(status, lastActionResult, error),
    refresh,
    runAction,
  };
}
