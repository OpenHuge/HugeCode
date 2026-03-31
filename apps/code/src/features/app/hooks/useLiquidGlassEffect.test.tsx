// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiquidGlassEffect } from "./useLiquidGlassEffect";

const isDesktopHostRuntimeMock = vi.fn();
const getCurrentWindowMock = vi.fn();
const isGlassSupportedMock = vi.fn();
const setLiquidGlassEffectMock = vi.fn();

vi.mock("@desktop-host/core", () => ({
  isDesktopHostRuntime: () => isDesktopHostRuntimeMock(),
}));

vi.mock("@desktop-host/window", () => ({
  Effect: {
    HudWindow: "HudWindow",
  },
  EffectState: {
    Active: "Active",
  },
  getCurrentWindow: () => getCurrentWindowMock(),
}));

vi.mock("@desktop-host/liquid-glass", () => ({
  GlassMaterialVariant: {
    Regular: "Regular",
  },
  isGlassSupported: () => isGlassSupportedMock(),
  setLiquidGlassEffect: (...args: unknown[]) => setLiquidGlassEffectMock(...args),
}));

describe("useLiquidGlassEffect", () => {
  beforeEach(() => {
    isDesktopHostRuntimeMock.mockReset();
    getCurrentWindowMock.mockReset();
    isGlassSupportedMock.mockReset();
    setLiquidGlassEffectMock.mockReset();
  });

  it("no-ops on web runtime", () => {
    isDesktopHostRuntimeMock.mockReturnValue(false);
    const onDebug = vi.fn();

    renderHook(() =>
      useLiquidGlassEffect({
        reduceTransparency: false,
        onDebug,
      })
    );

    expect(getCurrentWindowMock).not.toHaveBeenCalled();
    expect(isGlassSupportedMock).not.toHaveBeenCalled();
    expect(setLiquidGlassEffectMock).not.toHaveBeenCalled();
    expect(onDebug).not.toHaveBeenCalled();
  });
});
