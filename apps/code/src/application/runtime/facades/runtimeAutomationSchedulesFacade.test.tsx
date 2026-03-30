// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeAutomationSchedulesFacade } from "./runtimeAutomationSchedulesFacade";

vi.mock("../ports/runtimeAutomationSchedules", () => ({
  cancelRuntimeAutomationScheduleRun: vi.fn(),
  createRuntimeAutomationSchedule: vi.fn(),
  deleteRuntimeAutomationSchedule: vi.fn(),
  listRuntimeAutomationSchedules: vi.fn(),
  readRuntimeAutomationSchedulesAccess: vi.fn(),
  runRuntimeAutomationScheduleNow: vi.fn(),
  updateRuntimeAutomationSchedule: vi.fn(),
}));

import {
  cancelRuntimeAutomationScheduleRun,
  createRuntimeAutomationSchedule,
  listRuntimeAutomationSchedules,
  readRuntimeAutomationSchedulesAccess,
  runRuntimeAutomationScheduleNow,
  updateRuntimeAutomationSchedule,
} from "../ports/runtimeAutomationSchedules";

const readRuntimeAutomationSchedulesAccessMock = vi.mocked(readRuntimeAutomationSchedulesAccess);
const listRuntimeAutomationSchedulesMock = vi.mocked(listRuntimeAutomationSchedules);
const createRuntimeAutomationScheduleMock = vi.mocked(createRuntimeAutomationSchedule);
const updateRuntimeAutomationScheduleMock = vi.mocked(updateRuntimeAutomationSchedule);
const runRuntimeAutomationScheduleNowMock = vi.mocked(runRuntimeAutomationScheduleNow);
const cancelRuntimeAutomationScheduleRunMock = vi.mocked(cancelRuntimeAutomationScheduleRun);

describe("useRuntimeAutomationSchedulesFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readRuntimeAutomationSchedulesAccessMock.mockResolvedValue({
      scheduleSurfaceEnabled: true,
      listEnabled: true,
      createEnabled: true,
      updateEnabled: true,
      deleteEnabled: true,
      runNowEnabled: true,
      cancelRunEnabled: true,
      unavailableReason: null,
      readOnlyReason: null,
    });
    listRuntimeAutomationSchedulesMock.mockResolvedValue([
      {
        id: "schedule-1",
        enabled: true,
        name: "Nightly review",
        prompt: "Review the latest runs.",
        cadenceLabel: "Every day at 23:00",
        cron: "0 23 * * *",
        status: "idle",
        updatedAt: 1,
        nextRunAt: 2,
      },
    ] as never);
    createRuntimeAutomationScheduleMock.mockResolvedValue({ id: "schedule-2" } as never);
    updateRuntimeAutomationScheduleMock.mockResolvedValue({ id: "schedule-1" } as never);
    runRuntimeAutomationScheduleNowMock.mockResolvedValue({ id: "schedule-1" } as never);
    cancelRuntimeAutomationScheduleRunMock.mockResolvedValue({ id: "schedule-1" } as never);
  });

  it("loads runtime-confirmed schedule summaries when the server section opens", async () => {
    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesSnapshot).toHaveLength(1);
    });

    expect(result.current.automationSchedulesCapabilityEnabled).toBe(true);
    expect(result.current.automationSchedulesUnavailableReason).toBeNull();
    expect(result.current.automationSchedulesReadOnlyReason).toBeNull();
    expect(result.current.automationSchedulesCreateEnabled).toBe(true);
    expect(result.current.automationSchedulesUpdateEnabled).toBe(true);
    expect(result.current.automationSchedulesRunNowEnabled).toBe(true);
    expect(result.current.automationSchedulesCancelRunEnabled).toBe(true);
    expect(result.current.automationSchedulesSnapshot[0]).toMatchObject({
      id: "schedule-1",
      name: "Nightly review",
      cron: "0 23 * * *",
    });
  });

  it("keeps a stable empty state when the runtime publishes no schedules", async () => {
    listRuntimeAutomationSchedulesMock.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesCapabilityEnabled).toBe(true);
      expect(result.current.automationSchedulesSnapshot).toEqual([]);
      expect(result.current.automationSchedulesUnavailableReason).toBeNull();
    });

    expect(result.current.automationSchedulesSnapshot).toEqual([]);
    expect(result.current.automationSchedulesError).toBeNull();
    expect(result.current.automationSchedulesReadOnlyReason).toBeNull();
  });

  it("surfaces an explicit unavailable reason when runtime schedule summaries are unavailable", async () => {
    readRuntimeAutomationSchedulesAccessMock.mockResolvedValue({
      scheduleSurfaceEnabled: true,
      listEnabled: false,
      createEnabled: false,
      updateEnabled: false,
      deleteEnabled: false,
      runNowEnabled: false,
      cancelRunEnabled: false,
      unavailableReason: "Runtime schedule summaries are unavailable in current runtime.",
      readOnlyReason: null,
    });

    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesUnavailableReason).toBe(
        "Runtime schedule summaries are unavailable in current runtime."
      );
    });

    expect(listRuntimeAutomationSchedulesMock).not.toHaveBeenCalled();
    expect(result.current.automationSchedulesCapabilityEnabled).toBe(true);
    expect(result.current.automationSchedulesSnapshot).toEqual([]);
    expect(result.current.automationSchedulesReadOnlyReason).toBeNull();
    expect(result.current.automationSchedulesCreateEnabled).toBe(false);
    expect(result.current.automationSchedulesUpdateEnabled).toBe(false);
    expect(result.current.automationSchedulesRunNowEnabled).toBe(false);
    expect(result.current.automationSchedulesCancelRunEnabled).toBe(false);
  });

  it("marks the surface unavailable when schedule capability is missing entirely", async () => {
    readRuntimeAutomationSchedulesAccessMock.mockResolvedValue({
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

    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesUnavailableReason).toBe(
        "Runtime schedule control is unavailable in current runtime."
      );
    });

    expect(result.current.automationSchedulesCapabilityEnabled).toBe(false);
    expect(result.current.automationSchedulesSnapshot).toEqual([]);
    expect(result.current.automationSchedulesReadOnlyReason).toBeNull();
    expect(listRuntimeAutomationSchedulesMock).not.toHaveBeenCalled();
  });

  it("rejects update actions when runtime schedule mutation support is unavailable", async () => {
    readRuntimeAutomationSchedulesAccessMock.mockResolvedValue({
      scheduleSurfaceEnabled: true,
      listEnabled: true,
      createEnabled: true,
      updateEnabled: false,
      deleteEnabled: false,
      runNowEnabled: true,
      cancelRunEnabled: true,
      unavailableReason: null,
      readOnlyReason: "Some runtime schedule actions are unavailable in current runtime.",
    });

    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesLoading).toBe(false);
    });

    await expect(
      result.current.updateAutomationSchedule({
        scheduleId: "schedule-1",
        schedule: {},
      })
    ).rejects.toThrow("Runtime schedule update is unavailable in current runtime.");
  });

  it("rejects run-now and cancel-run actions with clear runtime-owned reasons", async () => {
    readRuntimeAutomationSchedulesAccessMock.mockResolvedValue({
      scheduleSurfaceEnabled: true,
      listEnabled: true,
      createEnabled: true,
      updateEnabled: true,
      deleteEnabled: true,
      runNowEnabled: false,
      cancelRunEnabled: false,
      unavailableReason: null,
      readOnlyReason: "Some runtime schedule actions are unavailable in current runtime.",
    });

    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesReadOnlyReason).toBe(
        "Some runtime schedule actions are unavailable in current runtime."
      );
    });

    expect(result.current.automationSchedulesUnavailableReason).toBeNull();
    await expect(
      result.current.runAutomationScheduleNow({
        scheduleId: "schedule-1",
        workspaceId: "workspace-1",
      })
    ).rejects.toThrow("Runtime schedule run-now is unavailable in current runtime.");
    await expect(
      result.current.cancelAutomationScheduleRun({
        scheduleId: "schedule-1",
        workspaceId: "workspace-1",
      })
    ).rejects.toThrow("Runtime schedule cancel-run is unavailable in current runtime.");
  });

  it("refreshes schedules on demand after the initial load", async () => {
    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesLoading).toBe(false);
    });

    listRuntimeAutomationSchedulesMock.mockResolvedValue([
      {
        id: "schedule-2",
        enabled: true,
        name: "Midday review",
        prompt: "Check the queue at lunch.",
        cadenceLabel: "Every weekday at 12:00",
        cron: "0 12 * * 1-5",
        status: "idle",
        updatedAt: 3,
      },
    ] as never);

    await act(async () => {
      await result.current.refreshAutomationSchedules();
    });

    expect(result.current.automationSchedulesSnapshot).toMatchObject([
      {
        id: "schedule-2",
        name: "Midday review",
      },
    ]);
  });
});
