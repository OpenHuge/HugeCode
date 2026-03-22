// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSettingsViewNavigation } from "./useSettingsViewNavigation";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
});

describe("useSettingsViewNavigation", () => {
  it("remains stable when matchMedia result has no listener APIs", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "(max-width: 720px)",
        onchange: null,
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList),
    });

    const { result } = renderHook(() => useSettingsViewNavigation({}));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.useMobileMasterDetail).toBe(false);
    expect(result.current.activeSection).toBe("projects");

    act(() => {
      result.current.handleSelectSection("codex");
    });
    expect(result.current.activeSection).toBe("codex");
  });

  it("falls back safely when matchMedia returns malformed results", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(null as unknown as MediaQueryList),
    });

    const { result } = renderHook(() => useSettingsViewNavigation({}));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.useMobileMasterDetail).toBe(false);
    expect(result.current.showMobileDetail).toBe(false);
  });

  it("remains stable when matchMedia throws", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn(() => {
        throw new Error("matchMedia blocked");
      }),
    });

    const { result } = renderHook(() => useSettingsViewNavigation({}));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.useMobileMasterDetail).toBe(false);
    expect(result.current.activeSection).toBe("projects");
  });
});
