// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSharedAppSettingsState } from "@ku0/code-workspace-client/settings-state";
import { runCodexDoctor } from "../../../application/runtime/ports/tauriCodexOperations";
import { useAppSettings } from "./useAppSettings";

vi.mock("@ku0/code-workspace-client/settings-state", () => ({
  useSharedAppSettingsState: vi.fn(() => ({
    settings: { theme: "system" },
    setSettings: vi.fn(),
    saveSettings: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("../../../application/runtime/ports/tauriCodexOperations", () => ({
  runCodexDoctor: vi.fn(),
}));

const useSharedAppSettingsStateMock = vi.mocked(useSharedAppSettingsState);
const runCodexDoctorMock = vi.mocked(runCodexDoctor);

describe("useAppSettings", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads settings through the shared settings state", () => {
    renderHook(() => useAppSettings());

    expect(useSharedAppSettingsStateMock).toHaveBeenCalledTimes(1);
    expect(useSharedAppSettingsStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        buildDefaultSettings: expect.any(Function),
        normalizeSettings: expect.any(Function),
      })
    );
  });

  it("delegates doctor checks to the codex port", async () => {
    runCodexDoctorMock.mockResolvedValue({ ok: true } as never);
    const { result } = renderHook(() => useAppSettings());

    await result.current.doctor("/bin/codex", "--profile dev");

    expect(runCodexDoctorMock).toHaveBeenCalledWith("/bin/codex", "--profile dev");
  });
});
