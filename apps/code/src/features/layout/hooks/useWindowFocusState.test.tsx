/* @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@desktop-host/window", () => ({
  getCurrentWindow: vi.fn(() => {
    throw new Error("no desktop host window");
  }),
}));

import { useWindowFocusState } from "./useWindowFocusState";

describe("useWindowFocusState", () => {
  it("falls back to DOM focus state when desktop host window is unavailable", () => {
    const { result, unmount } = renderHook(() => useWindowFocusState());
    expect(typeof result.current).toBe("boolean");
    unmount();
  });
});
