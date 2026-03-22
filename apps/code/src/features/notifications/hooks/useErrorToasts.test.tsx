// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { useErrorToasts } from "./useErrorToasts";

describe("useErrorToasts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates repeated toasts that reuse the same id", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useErrorToasts());

    act(() => {
      pushErrorToast({
        id: "runtime-capability-contract",
        title: "Runtime capabilities are out of date",
        message: "Runtime RPC capabilities must advertise canonical methods only.",
      });
      pushErrorToast({
        id: "runtime-capability-contract",
        title: "Runtime capabilities are out of date",
        message: "Runtime RPC capabilities must advertise canonical methods only.",
      });
    });

    expect(result.current.errorToasts).toHaveLength(1);
    expect(result.current.errorToasts[0]).toMatchObject({
      id: "runtime-capability-contract",
      title: "Runtime capabilities are out of date",
    });
  });
});
