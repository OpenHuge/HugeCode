import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cancelNativeScheduleRun,
  createNativeSchedule,
  deleteNativeSchedule,
  listNativeSchedules,
  runNativeScheduleNow,
  updateNativeSchedule,
} from "./tauriRuntimeSchedules";
import {
  cancelNativeScheduleRun as cancelNativeScheduleRunBridge,
  createNativeSchedule as createNativeScheduleBridge,
  deleteNativeSchedule as deleteNativeScheduleBridge,
  listNativeSchedules as listNativeSchedulesBridge,
  runNativeScheduleNow as runNativeScheduleNowBridge,
  updateNativeSchedule as updateNativeScheduleBridge,
} from "../../../services/tauriRuntimeSchedulesBridge";

describe("tauri runtime schedules port contract", () => {
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
      expect(exportedValue, `${name} should come from tauriRuntimeSchedulesBridge`).toBe(
        bridgeValue
      );
    }
  });

  it("retires the deprecated tauri compat port for schedule controls", () => {
    const source = path.resolve(import.meta.dirname, "tauri.ts");

    expect(existsSync(source)).toBe(false);
  });

  it("keeps tauriRemoteServers schedule exports off the deprecated tauri aggregation port", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "tauriRemoteServers.ts"), "utf8");

    expect(source).not.toMatch(
      /cancelNativeScheduleRun[\s\S]*createNativeSchedule[\s\S]*deleteNativeSchedule[\s\S]*listNativeSchedules[\s\S]*runNativeScheduleNow[\s\S]*updateNativeSchedule[\s\S]*from\s+["']\.\/tauri["']/
    );
  });
});
