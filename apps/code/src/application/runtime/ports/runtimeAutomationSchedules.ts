import { getRuntimeCapabilitiesSummary } from "./tauriRuntime";
export type {
  NativeScheduleCreateRequest as RuntimeAutomationScheduleCreateRequest,
  NativeScheduleDeleteRequest as RuntimeAutomationScheduleDeleteRequest,
  NativeScheduleRecord as RuntimeAutomationScheduleRecord,
  NativeScheduleRunRequest as RuntimeAutomationScheduleRunRequest,
  NativeScheduleUpdateRequest as RuntimeAutomationScheduleUpdateRequest,
} from "./tauriRuntimeSchedules";
export {
  cancelNativeScheduleRun as cancelRuntimeAutomationScheduleRun,
  createNativeSchedule as createRuntimeAutomationSchedule,
  deleteNativeSchedule as deleteRuntimeAutomationSchedule,
  listNativeSchedules as listRuntimeAutomationSchedules,
  runNativeScheduleNow as runRuntimeAutomationScheduleNow,
  updateNativeSchedule as updateRuntimeAutomationSchedule,
} from "./tauriRuntimeSchedules";

export const RUNTIME_AUTOMATION_SCHEDULE_METHODS = {
  list: "native_schedules_list",
  create: "native_schedule_create",
  update: "native_schedule_update",
  delete: "native_schedule_delete",
  runNow: "native_schedule_run_now",
  cancelRun: "native_schedule_cancel_run",
} as const;

export type RuntimeAutomationSchedulesAccess = {
  scheduleSurfaceEnabled: boolean;
  listEnabled: boolean;
  createEnabled: boolean;
  updateEnabled: boolean;
  deleteEnabled: boolean;
  runNowEnabled: boolean;
  cancelRunEnabled: boolean;
  readOnlyReason: string | null;
};

export async function readRuntimeAutomationSchedulesAccess(): Promise<RuntimeAutomationSchedulesAccess> {
  const summary = await getRuntimeCapabilitiesSummary();
  const methodSet = new Set(summary.methods);
  const hasFeature = summary.features.includes("schedules");
  const hasAnyMethod = Object.values(RUNTIME_AUTOMATION_SCHEDULE_METHODS).some((method) =>
    methodSet.has(method)
  );
  const scheduleSurfaceEnabled = hasFeature || hasAnyMethod;
  const listEnabled =
    scheduleSurfaceEnabled &&
    methodSet.has(RUNTIME_AUTOMATION_SCHEDULE_METHODS.list) &&
    !summary.error;
  const createEnabled =
    scheduleSurfaceEnabled &&
    methodSet.has(RUNTIME_AUTOMATION_SCHEDULE_METHODS.create) &&
    !summary.error;
  const updateEnabled =
    scheduleSurfaceEnabled &&
    methodSet.has(RUNTIME_AUTOMATION_SCHEDULE_METHODS.update) &&
    !summary.error;
  const deleteEnabled =
    scheduleSurfaceEnabled &&
    methodSet.has(RUNTIME_AUTOMATION_SCHEDULE_METHODS.delete) &&
    !summary.error;
  const runNowEnabled =
    scheduleSurfaceEnabled &&
    methodSet.has(RUNTIME_AUTOMATION_SCHEDULE_METHODS.runNow) &&
    !summary.error;
  const cancelRunEnabled =
    scheduleSurfaceEnabled &&
    methodSet.has(RUNTIME_AUTOMATION_SCHEDULE_METHODS.cancelRun) &&
    !summary.error;
  const actionEnabledCount = [
    createEnabled,
    updateEnabled,
    deleteEnabled,
    runNowEnabled,
    cancelRunEnabled,
  ].filter(Boolean).length;
  const totalActionCount = 5;

  if (summary.error) {
    return {
      scheduleSurfaceEnabled,
      listEnabled,
      createEnabled,
      updateEnabled,
      deleteEnabled,
      runNowEnabled,
      cancelRunEnabled,
      readOnlyReason: summary.error,
    };
  }

  if (!scheduleSurfaceEnabled) {
    return {
      scheduleSurfaceEnabled,
      listEnabled,
      createEnabled,
      updateEnabled,
      deleteEnabled,
      runNowEnabled,
      cancelRunEnabled,
      readOnlyReason: "Runtime schedule control is unavailable in current runtime.",
    };
  }

  if (!listEnabled) {
    return {
      scheduleSurfaceEnabled,
      listEnabled,
      createEnabled,
      updateEnabled,
      deleteEnabled,
      runNowEnabled,
      cancelRunEnabled,
      readOnlyReason: "Runtime schedule summaries are unavailable in current runtime.",
    };
  }

  if (actionEnabledCount === 0) {
    return {
      scheduleSurfaceEnabled,
      listEnabled,
      createEnabled,
      updateEnabled,
      deleteEnabled,
      runNowEnabled,
      cancelRunEnabled,
      readOnlyReason: "Runtime schedule actions are unavailable in current runtime.",
    };
  }

  if (actionEnabledCount < totalActionCount) {
    return {
      scheduleSurfaceEnabled,
      listEnabled,
      createEnabled,
      updateEnabled,
      deleteEnabled,
      runNowEnabled,
      cancelRunEnabled,
      readOnlyReason: "Some runtime schedule actions are unavailable in current runtime.",
    };
  }

  return {
    scheduleSurfaceEnabled,
    listEnabled,
    createEnabled,
    updateEnabled,
    deleteEnabled,
    runNowEnabled,
    cancelRunEnabled,
    readOnlyReason: null,
  };
}
