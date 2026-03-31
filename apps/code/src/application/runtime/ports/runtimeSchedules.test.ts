import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cancelNativeScheduleRun,
  createNativeSchedule,
  deleteNativeSchedule,
  listNativeSchedules,
  runNativeScheduleNow,
  updateNativeSchedule,
} from "./runtimeSchedules";
import {
  cancelNativeScheduleRun as cancelNativeScheduleRunBridge,
  createNativeSchedule as createNativeScheduleBridge,
  deleteNativeSchedule as deleteNativeScheduleBridge,
  listNativeSchedules as listNativeSchedulesBridge,
  runNativeScheduleNow as runNativeScheduleNowBridge,
  updateNativeSchedule as updateNativeScheduleBridge,
} from "../../../services/runtimeSchedulesBridge";

describe("runtimeSchedules port contract", () => {
  it("re-exports the narrow schedules bridge directly", () => {
    const exports = [
      ["listNativeSchedules", listNativeSchedules, listNativeSchedulesBridge],
      ["createNativeSchedule", createNativeSchedule, createNativeScheduleBridge],
      ["updateNativeSchedule", updateNativeSchedule, updateNativeScheduleBridge],
      ["deleteNativeSchedule", deleteNativeSchedule, deleteNativeScheduleBridge],
      ["runNativeScheduleNow", runNativeScheduleNow, runNativeScheduleNowBridge],
      ["cancelNativeScheduleRun", cancelNativeScheduleRun, cancelNativeScheduleRunBridge],
    ] as const;

    for (const [name, exportedValue, bridgeValue] of exports) {
      expect(exportedValue, `${name} should come from runtimeSchedulesBridge`).toBe(bridgeValue);
    }
  });

  it("retires the deprecated legacy host compat ports for schedule controls", () => {
    const legacySchedulesCompatSource = path.resolve(
      import.meta.dirname,
      "tauriRuntimeSchedules.ts"
    );
    const legacyRemoteServersCompatSource = path.resolve(
      import.meta.dirname,
      "tauriRemoteServers.ts"
    );

    expect(existsSync(legacySchedulesCompatSource)).toBe(false);
    expect(existsSync(legacyRemoteServersCompatSource)).toBe(false);
  });
});
