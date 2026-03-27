/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeferredStartupActivation } from "./useDeferredStartupActivation";

describe("useDeferredStartupActivation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("activates on the first interaction", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useDeferredStartupActivation({ fallbackDelayMs: 5_000 }));

    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(result.current).toBe(true);
  });

  it("activates from the fallback timer when no interaction occurs", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useDeferredStartupActivation({ fallbackDelayMs: 250 }));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe(true);
  });
});
