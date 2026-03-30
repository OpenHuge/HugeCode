import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelRuntimeAutomationScheduleRun,
  createRuntimeAutomationSchedule,
  deleteRuntimeAutomationSchedule,
  listRuntimeAutomationSchedules,
  readRuntimeAutomationSchedulesAccess,
  type RuntimeAutomationScheduleCreateRequest,
  type RuntimeAutomationScheduleRecord,
  type RuntimeAutomationScheduleRunRequest,
  type RuntimeAutomationScheduleUpdateRequest,
  runRuntimeAutomationScheduleNow,
  updateRuntimeAutomationSchedule,
  type RuntimeAutomationSchedulesAccess,
} from "../ports/runtimeAutomationSchedules";
import { formatErrorMessage } from "./runtimeOperationsShared";

type UseRuntimeAutomationSchedulesFacadeOptions = {
  activeSection: string;
};

export function useRuntimeAutomationSchedulesFacade({
  activeSection,
}: UseRuntimeAutomationSchedulesFacadeOptions) {
  const [automationSchedulesCapabilityEnabled, setAutomationSchedulesCapabilityEnabled] =
    useState(false);
  const [automationSchedulesSnapshot, setAutomationSchedulesSnapshot] = useState<
    RuntimeAutomationScheduleRecord[]
  >([]);
  const [automationSchedulesLoading, setAutomationSchedulesLoading] = useState(false);
  const [automationSchedulesError, setAutomationSchedulesError] = useState<string | null>(null);
  const [automationSchedulesUnavailableReason, setAutomationSchedulesUnavailableReason] = useState<
    string | null
  >(null);
  const [automationSchedulesReadOnlyReason, setAutomationSchedulesReadOnlyReason] = useState<
    string | null
  >(null);
  const [automationSchedulesCreateEnabled, setAutomationSchedulesCreateEnabled] = useState(false);
  const [automationSchedulesUpdateEnabled, setAutomationSchedulesUpdateEnabled] = useState(false);
  const [automationSchedulesDeleteEnabled, setAutomationSchedulesDeleteEnabled] = useState(false);
  const [automationSchedulesRunNowEnabled, setAutomationSchedulesRunNowEnabled] = useState(false);
  const [automationSchedulesCancelRunEnabled, setAutomationSchedulesCancelRunEnabled] =
    useState(false);
  const accessRef = useRef<RuntimeAutomationSchedulesAccess>({
    scheduleSurfaceEnabled: false,
    listEnabled: false,
    createEnabled: false,
    updateEnabled: false,
    deleteEnabled: false,
    runNowEnabled: false,
    cancelRunEnabled: false,
    unavailableReason: "Runtime schedule control is unavailable in current runtime.",
    readOnlyReason: null,
  });

  const applyAutomationSchedulesAccess = useCallback((access: RuntimeAutomationSchedulesAccess) => {
    accessRef.current = access;
    setAutomationSchedulesCapabilityEnabled(access.scheduleSurfaceEnabled);
    setAutomationSchedulesCreateEnabled(access.createEnabled);
    setAutomationSchedulesUpdateEnabled(access.updateEnabled);
    setAutomationSchedulesDeleteEnabled(access.deleteEnabled);
    setAutomationSchedulesRunNowEnabled(access.runNowEnabled);
    setAutomationSchedulesCancelRunEnabled(access.cancelRunEnabled);
    setAutomationSchedulesUnavailableReason(access.unavailableReason);
    setAutomationSchedulesReadOnlyReason(access.readOnlyReason);
  }, []);

  const refreshAutomationSchedules = useCallback(
    async (accessOverride?: RuntimeAutomationSchedulesAccess) => {
      const access = accessOverride ?? (await readRuntimeAutomationSchedulesAccess());
      applyAutomationSchedulesAccess(access);
      setAutomationSchedulesError(null);

      if (!access.scheduleSurfaceEnabled) {
        setAutomationSchedulesLoading(false);
        setAutomationSchedulesSnapshot([]);
        setAutomationSchedulesUnavailableReason(
          access.unavailableReason ?? "Runtime schedule control is unavailable in current runtime."
        );
        return;
      }

      if (!access.listEnabled) {
        setAutomationSchedulesLoading(false);
        setAutomationSchedulesSnapshot([]);
        setAutomationSchedulesUnavailableReason(
          access.unavailableReason ??
            "Runtime schedule summaries are unavailable in current runtime."
        );
        return;
      }

      setAutomationSchedulesUnavailableReason(null);
      setAutomationSchedulesLoading(true);
      try {
        const payload = await listRuntimeAutomationSchedules();
        if (payload === null) {
          setAutomationSchedulesSnapshot([]);
          setAutomationSchedulesUnavailableReason(
            "Runtime schedule summaries are unavailable in current runtime."
          );
          return;
        }
        setAutomationSchedulesSnapshot(payload);
        setAutomationSchedulesUnavailableReason(null);
      } catch (error) {
        setAutomationSchedulesError(
          formatErrorMessage(error, "Unable to load automation schedules.")
        );
      } finally {
        setAutomationSchedulesLoading(false);
      }
    },
    [applyAutomationSchedulesAccess]
  );

  useEffect(() => {
    if (activeSection !== "server") {
      return;
    }

    let cancelled = false;
    void (async () => {
      const access = await readRuntimeAutomationSchedulesAccess();
      if (cancelled) {
        return;
      }
      applyAutomationSchedulesAccess(access);
      if (!access.scheduleSurfaceEnabled || !access.listEnabled) {
        setAutomationSchedulesLoading(false);
        setAutomationSchedulesError(null);
        setAutomationSchedulesSnapshot([]);
        return;
      }
      await refreshAutomationSchedules(access);
      if (cancelled) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSection, applyAutomationSchedulesAccess, refreshAutomationSchedules]);

  const ensureRuntimeAutomationScheduleActionEnabled = useCallback(
    (enabled: boolean, reason: string, fallbackReadOnlyReason: string): void => {
      if (enabled) {
        return;
      }
      const readOnlyReason =
        accessRef.current.readOnlyReason ??
        accessRef.current.unavailableReason ??
        fallbackReadOnlyReason;
      setAutomationSchedulesReadOnlyReason(readOnlyReason);
      throw new Error(reason);
    },
    []
  );

  return {
    automationSchedulesCapabilityEnabled,
    automationSchedulesSnapshot,
    automationSchedulesLoading,
    automationSchedulesError,
    automationSchedulesUnavailableReason,
    automationSchedulesReadOnlyReason,
    automationSchedulesCreateEnabled,
    automationSchedulesUpdateEnabled,
    automationSchedulesDeleteEnabled,
    automationSchedulesRunNowEnabled,
    automationSchedulesCancelRunEnabled,
    refreshAutomationSchedules,
    createAutomationSchedule: async (request: RuntimeAutomationScheduleCreateRequest) => {
      ensureRuntimeAutomationScheduleActionEnabled(
        accessRef.current.createEnabled,
        "Runtime schedule create is unavailable in current runtime.",
        "Runtime schedule actions are unavailable in current runtime."
      );
      return createRuntimeAutomationSchedule(request);
    },
    updateAutomationSchedule: async (request: RuntimeAutomationScheduleUpdateRequest) => {
      ensureRuntimeAutomationScheduleActionEnabled(
        accessRef.current.updateEnabled,
        "Runtime schedule update is unavailable in current runtime.",
        "Runtime schedule actions are unavailable in current runtime."
      );
      return updateRuntimeAutomationSchedule(request);
    },
    deleteAutomationSchedule: async (request: {
      scheduleId: string;
      workspaceId?: string | null;
    }) => {
      ensureRuntimeAutomationScheduleActionEnabled(
        accessRef.current.deleteEnabled,
        "Runtime schedule delete is unavailable in current runtime.",
        "Runtime schedule actions are unavailable in current runtime."
      );
      return deleteRuntimeAutomationSchedule(request);
    },
    runAutomationScheduleNow: async (request: RuntimeAutomationScheduleRunRequest) => {
      ensureRuntimeAutomationScheduleActionEnabled(
        accessRef.current.runNowEnabled,
        "Runtime schedule run-now is unavailable in current runtime.",
        "Some runtime schedule actions are unavailable in current runtime."
      );
      return runRuntimeAutomationScheduleNow(request);
    },
    cancelAutomationScheduleRun: async (request: RuntimeAutomationScheduleRunRequest) => {
      ensureRuntimeAutomationScheduleActionEnabled(
        accessRef.current.cancelRunEnabled,
        "Runtime schedule cancel-run is unavailable in current runtime.",
        "Some runtime schedule actions are unavailable in current runtime."
      );
      return cancelRuntimeAutomationScheduleRun(request);
    },
  };
}
