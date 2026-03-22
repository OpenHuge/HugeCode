import { useCallback, useEffect, useState } from "react";
import {
  cancelNativeScheduleRun,
  createNativeSchedule,
  deleteNativeSchedule,
  listNativeSchedules,
  type NativeScheduleCreateRequest,
  type NativeScheduleRecord,
  type NativeScheduleRunRequest,
  type NativeScheduleUpdateRequest,
  runNativeScheduleNow,
  updateNativeSchedule,
} from "../ports/tauriRemoteServers";
import { formatErrorMessage } from "./runtimeOperationsShared";

type UseRuntimeAutomationSchedulesFacadeOptions = {
  activeSection: string;
};

export function useRuntimeAutomationSchedulesFacade({
  activeSection,
}: UseRuntimeAutomationSchedulesFacadeOptions) {
  const [automationSchedulesSnapshot, setAutomationSchedulesSnapshot] = useState<
    NativeScheduleRecord[]
  >([]);
  const [automationSchedulesLoading, setAutomationSchedulesLoading] = useState(false);
  const [automationSchedulesError, setAutomationSchedulesError] = useState<string | null>(null);
  const [automationSchedulesReadOnlyReason, setAutomationSchedulesReadOnlyReason] = useState<
    string | null
  >(null);

  const refreshAutomationSchedules = useCallback(async () => {
    setAutomationSchedulesLoading(true);
    setAutomationSchedulesError(null);
    try {
      const payload = await listNativeSchedules();
      if (payload === null) {
        setAutomationSchedulesSnapshot([]);
        setAutomationSchedulesReadOnlyReason("Runtime schedule RPC is unavailable.");
        return;
      }
      setAutomationSchedulesSnapshot(payload);
      setAutomationSchedulesReadOnlyReason(null);
    } catch (error) {
      setAutomationSchedulesError(
        formatErrorMessage(error, "Unable to load automation schedules.")
      );
    } finally {
      setAutomationSchedulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== "server") {
      return;
    }

    let cancelled = false;
    void (async () => {
      await refreshAutomationSchedules();
      if (cancelled) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSection, refreshAutomationSchedules]);

  return {
    automationSchedulesSnapshot,
    automationSchedulesLoading,
    automationSchedulesError,
    automationSchedulesReadOnlyReason,
    refreshAutomationSchedules,
    createAutomationSchedule: async (request: NativeScheduleCreateRequest) =>
      createNativeSchedule(request),
    updateAutomationSchedule: async (request: NativeScheduleUpdateRequest) =>
      updateNativeSchedule(request),
    deleteAutomationSchedule: async (request: {
      scheduleId: string;
      workspaceId?: string | null;
    }) => deleteNativeSchedule(request),
    runAutomationScheduleNow: async (request: NativeScheduleRunRequest) =>
      runNativeScheduleNow(request),
    cancelAutomationScheduleRun: async (request: NativeScheduleRunRequest) =>
      cancelNativeScheduleRun(request),
  };
}
