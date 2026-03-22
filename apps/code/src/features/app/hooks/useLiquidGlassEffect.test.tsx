// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiquidGlassEffect } from "./useLiquidGlassEffect";

const isTauriMock = vi.fn();
const getCurrentWindowMock = vi.fn();
const isGlassSupportedMock = vi.fn();
const setLiquidGlassEffectMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  Effect: {
    HudWindow: "HudWindow",
  },
  EffectState: {
    Active: "Active",
  },
  getCurrentWindow: () => getCurrentWindowMock(),
}));

vi.mock("tauri-plugin-liquid-glass-api", () => ({
  GlassMaterialVariant: {
    Regular: "Regular",
  },
  isGlassSupported: () => isGlassSupportedMock(),
  setLiquidGlassEffect: (...args: unknown[]) => setLiquidGlassEffectMock(...args),
}));

describe("useLiquidGlassEffect", () => {
  beforeEach(() => {
    isTauriMock.mockReset();
    getCurrentWindowMock.mockReset();
    isGlassSupportedMock.mockReset();
    setLiquidGlassEffectMock.mockReset();
  });

  it("no-ops on web runtime", () => {
    isTauriMock.mockReturnValue(false);
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
