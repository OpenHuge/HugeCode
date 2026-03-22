// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeAutomationSchedulesFacade } from "./runtimeAutomationSchedulesFacade";

vi.mock("../ports/tauriRemoteServers", () => ({
  cancelNativeScheduleRun: vi.fn(),
  createNativeSchedule: vi.fn(),
  deleteNativeSchedule: vi.fn(),
  listNativeSchedules: vi.fn(),
  runNativeScheduleNow: vi.fn(),
  updateNativeSchedule: vi.fn(),
}));

import { listNativeSchedules } from "../ports/tauriRemoteServers";

const listNativeSchedulesMock = vi.mocked(listNativeSchedules);

describe("useRuntimeAutomationSchedulesFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNativeSchedulesMock.mockResolvedValue([
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
  });

  it("loads runtime-native schedule summaries when the server section opens", async () => {
    const { result } = renderHook(() =>
      useRuntimeAutomationSchedulesFacade({
        activeSection: "server",
      })
    );

    await waitFor(() => {
      expect(result.current.automationSchedulesSnapshot).toHaveLength(1);
    });

    expect(result.current.automationSchedulesReadOnlyReason).toBeNull();
    expect(result.current.automationSchedulesSnapshot[0]).toMatchObject({
      id: "schedule-1",
      name: "Nightly review",
      cron: "0 23 * * *",
    });
  });
});
