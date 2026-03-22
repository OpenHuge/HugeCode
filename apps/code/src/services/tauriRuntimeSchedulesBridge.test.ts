import { invoke, isTauri } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectRuntimeMode } from "./runtimeClient";
import {
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "./runtimeErrorClassifier";
import {
  cancelNativeScheduleRun,
  createNativeSchedule,
  deleteNativeSchedule,
  listNativeSchedules,
  runNativeScheduleNow,
  updateNativeSchedule,
} from "./tauriRuntimeSchedulesBridge";

const { webRuntimeDirectRpcMock, warnMock } = vi.hoisted(() => ({
  webRuntimeDirectRpcMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(),
}));

vi.mock("./runtimeErrorClassifier", () => ({
  isRuntimeMethodUnsupportedError: vi.fn(),
  isWebRuntimeConnectionError: vi.fn(),
}));

vi.mock("./runtimeWebDirectRpc", () => ({
  invokeWebRuntimeDirectRpc: webRuntimeDirectRpcMock,
}));

vi.mock("./logger", () => ({
  logger: {
    warn: warnMock,
  },
}));

describe("tauriRuntimeSchedulesBridge", () => {
  const invokeMock = vi.mocked(invoke);
  const isTauriMock = vi.mocked(isTauri);
  const detectRuntimeModeMock = vi.mocked(detectRuntimeMode);
  const isRuntimeMethodUnsupportedErrorMock = vi.mocked(isRuntimeMethodUnsupportedError);
  const isWebRuntimeConnectionErrorMock = vi.mocked(isWebRuntimeConnectionError);
  const webRuntimeDirectRpcSpy = vi.mocked(webRuntimeDirectRpcMock);
  const warnSpy = warnMock;

  const listSchedule = {
    id: "schedule-1",
    enabled: true,
    name: "Nightly sync",
    status: "idle",
    cron: "0 1 * * *",
    updatedAt: 1710800000000,
    lastActionAt: 1710799900000,
    source: "native",
  };

  const createdSchedule = {
    id: "schedule-2",
    enabled: true,
    name: "Staging deploy",
    status: "idle",
    cron: "15 2 * * 1-5",
    updatedAt: 1710800100000,
    lastActionAt: null,
  };

  const updatedSchedule = {
    id: "schedule-2",
    enabled: true,
    name: "Staging deploy",
    status: "paused",
    cron: "30 2 * * 1-5",
    updatedAt: 1710800200000,
    lastActionAt: 1710800200000,
  };

  const runningSchedule = {
    id: "schedule-2",
    enabled: true,
    name: "Staging deploy",
    status: "running",
    cron: "30 2 * * 1-5",
    updatedAt: 1710800300000,
    lastActionAt: 1710800300000,
  };

  const cancelledSchedule = {
    id: "schedule-2",
    enabled: true,
    name: "Staging deploy",
    status: "cancelled",
    cron: "30 2 * * 1-5",
    updatedAt: 1710800400000,
    lastActionAt: 1710800400000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(true);
    detectRuntimeModeMock.mockReturnValue("tauri");
    isRuntimeMethodUnsupportedErrorMock.mockReturnValue(false);
    isWebRuntimeConnectionErrorMock.mockReturnValue(false);
    invokeMock.mockReset();
    webRuntimeDirectRpcSpy.mockReset();
    warnSpy.mockReset();
  });

  it("routes native schedule CRUD operations through Tauri invoke", async () => {
    invokeMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      switch (method) {
        case "native_schedules_list":
          expect(params).toEqual({});
          return [listSchedule];
        case "native_schedule_create":
          expect(params).toEqual({
            scheduleId: "schedule-2",
            schedule: {
              name: "Staging deploy",
              cron: "15 2 * * 1-5",
            },
          });
          return createdSchedule;
        case "native_schedule_update":
          expect(params).toEqual({
            scheduleId: "schedule-2",
            schedule: {
              name: "Staging deploy",
              cron: "30 2 * * 1-5",
            },
          });
          return updatedSchedule;
        case "native_schedule_delete":
          expect(params).toEqual({ scheduleId: "schedule-2" });
          return true;
        case "native_schedule_run_now":
          expect(params).toEqual({ scheduleId: "schedule-2" });
          return runningSchedule;
        case "native_schedule_cancel_run":
          expect(params).toEqual({ scheduleId: "schedule-2" });
          return cancelledSchedule;
        default:
          throw new Error(`Unexpected method: ${method}`);
      }
    });

    await expect(listNativeSchedules()).resolves.toEqual([
      expect.objectContaining({
        id: "schedule-1",
        enabled: true,
        name: "Nightly sync",
        status: "idle",
        cron: "0 1 * * *",
      }),
    ]);
    await expect(
      createNativeSchedule({
        scheduleId: "schedule-2",
        schedule: {
          name: "Staging deploy",
          cron: "15 2 * * 1-5",
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "schedule-2",
        name: "Staging deploy",
        cron: "15 2 * * 1-5",
        status: "idle",
      })
    );
    await expect(
      updateNativeSchedule({
        scheduleId: "schedule-2",
        schedule: {
          name: "Staging deploy",
          cron: "30 2 * * 1-5",
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "schedule-2",
        name: "Staging deploy",
        cron: "30 2 * * 1-5",
        status: "paused",
      })
    );
    await expect(deleteNativeSchedule({ scheduleId: "schedule-2" })).resolves.toBe(true);
    await expect(runNativeScheduleNow({ scheduleId: "schedule-2" })).resolves.toEqual(
      expect.objectContaining({
        id: "schedule-2",
        status: "running",
      })
    );
    await expect(cancelNativeScheduleRun({ scheduleId: "schedule-2" })).resolves.toEqual(
      expect.objectContaining({
        id: "schedule-2",
        status: "cancelled",
      })
    );

    expect(webRuntimeDirectRpcSpy).not.toHaveBeenCalled();
  });

  it("uses direct web runtime rpc in runtime-gateway-web mode", async () => {
    isTauriMock.mockReturnValue(false);
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    webRuntimeDirectRpcSpy.mockImplementation(
      async (method: string, params: Record<string, unknown>) => {
        switch (method) {
          case "native_schedules_list":
            expect(params).toEqual({});
            return [listSchedule];
          case "native_schedule_create":
            expect(params).toEqual({
              scheduleId: "schedule-2",
              schedule: {
                name: "Staging deploy",
                cron: "15 2 * * 1-5",
              },
            });
            return createdSchedule;
          case "native_schedule_update":
            expect(params).toEqual({
              scheduleId: "schedule-2",
              schedule: {
                name: "Staging deploy",
                cron: "30 2 * * 1-5",
              },
            });
            return updatedSchedule;
          case "native_schedule_delete":
            expect(params).toEqual({ scheduleId: "schedule-2" });
            return true;
          case "native_schedule_run_now":
            expect(params).toEqual({ scheduleId: "schedule-2" });
            return runningSchedule;
          case "native_schedule_cancel_run":
            expect(params).toEqual({ scheduleId: "schedule-2" });
            return cancelledSchedule;
          default:
            throw new Error(`Unexpected method: ${method}`);
        }
      }
    );

    await expect(listNativeSchedules()).resolves.toEqual([
      expect.objectContaining({
        id: "schedule-1",
        name: "Nightly sync",
      }),
    ]);
    await expect(
      createNativeSchedule({
        scheduleId: "schedule-2",
        schedule: {
          name: "Staging deploy",
          cron: "15 2 * * 1-5",
        },
      })
    ).resolves.toEqual(expect.objectContaining({ id: "schedule-2", status: "idle" }));
    await expect(
      updateNativeSchedule({
        scheduleId: "schedule-2",
        schedule: {
          name: "Staging deploy",
          cron: "30 2 * * 1-5",
        },
      })
    ).resolves.toEqual(expect.objectContaining({ id: "schedule-2", status: "paused" }));
    await expect(deleteNativeSchedule({ scheduleId: "schedule-2" })).resolves.toBe(true);
    await expect(runNativeScheduleNow({ scheduleId: "schedule-2" })).resolves.toEqual(
      expect.objectContaining({ id: "schedule-2", status: "running" })
    );
    await expect(cancelNativeScheduleRun({ scheduleId: "schedule-2" })).resolves.toEqual(
      expect.objectContaining({ id: "schedule-2", status: "cancelled" })
    );

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns graceful fallbacks when the runtime method is unsupported", async () => {
    const unsupportedError = new Error("Unsupported RPC method: native_schedules_list");
    invokeMock.mockRejectedValueOnce(unsupportedError);
    invokeMock.mockRejectedValueOnce(unsupportedError);
    isRuntimeMethodUnsupportedErrorMock.mockReturnValue(true);

    await expect(listNativeSchedules()).resolves.toBeNull();
    await expect(deleteNativeSchedule({ scheduleId: "schedule-unsupported" })).resolves.toBe(false);
    expect(webRuntimeDirectRpcSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs and returns a null fallback when the web runtime connection is unavailable", async () => {
    isTauriMock.mockReturnValue(false);
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    const connectionError = new Error("fetch failed");
    webRuntimeDirectRpcSpy.mockRejectedValueOnce(connectionError);
    isWebRuntimeConnectionErrorMock.mockReturnValue(true);

    await expect(listNativeSchedules({ workspaceId: "ws-1" })).resolves.toBeNull();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Web native schedules list unavailable"),
      expect.objectContaining({
        workspaceId: "ws-1",
        error: "fetch failed",
      })
    );
  });
});
