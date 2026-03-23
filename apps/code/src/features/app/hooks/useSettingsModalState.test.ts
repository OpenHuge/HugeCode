import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsModalState } from "./useSettingsModalState";

const { preloadSettingsViewMock } = vi.hoisted(() => ({
  preloadSettingsViewMock: vi.fn(),
}));

vi.mock("../../settings/components/settingsViewLoader", () => ({
  preloadSettingsView: preloadSettingsViewMock,
}));

describe("useSettingsModalState", () => {
  beforeEach(() => {
    preloadSettingsViewMock.mockClear();
  });

  it("preloads settings before opening the modal", async () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      result.current.openSettings();
    });
    await vi.dynamicImportSettled();

    expect(preloadSettingsViewMock).toHaveBeenCalledTimes(1);
    expect(result.current.settingsOpen).toBe(true);
  });

  it("opens settings with no section by default", () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      result.current.openSettings();
    });

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsSection).toBeNull();
  });

  it("treats retired dictation as an invalid section value", () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      result.current.openSettings("dictation" as never);
    });

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsSection).toBeNull();
  });

  it("ignores invalid section payloads", () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      result.current.openSettings(new MouseEvent("click") as unknown as never);
    });

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsSection).toBeNull();
  });

  it("does not let a generic open request erase an explicit section in the same turn", async () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      result.current.openSettings("codex");
      result.current.openSettings();
    });
    await vi.dynamicImportSettled();

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsSection).toBe("codex");
  });

  it("stays consistent through rapid open/close cycles", async () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      for (let index = 0; index < 50; index += 1) {
        result.current.openSettings("codex");
        result.current.closeSettings();
      }
      result.current.openSettings("server");
    });
    await vi.dynamicImportSettled();

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsSection).toBe("server");

    act(() => {
      result.current.closeSettings();
    });

    expect(result.current.settingsOpen).toBe(false);
    expect(result.current.settingsSection).toBeNull();
  });
});
