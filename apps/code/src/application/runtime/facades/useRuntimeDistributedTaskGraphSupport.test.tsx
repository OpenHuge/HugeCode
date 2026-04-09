// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRuntimeDistributedTaskGraphSupport } from "./runtimeDistributedTaskGraphFacade";
import {
  resetRuntimeDistributedTaskGraphSupportStoreForTests,
  useRuntimeDistributedTaskGraphSupport,
} from "./useRuntimeDistributedTaskGraphSupport";

vi.mock("./runtimeDistributedTaskGraphFacade", () => ({
  readRuntimeDistributedTaskGraphSupport: vi.fn(),
  DEFAULT_RUNTIME_DISTRIBUTED_TASK_GRAPH_SUPPORT: {
    capabilityEnabled: false,
    interruptEnabled: false,
    retryEnabled: false,
    actionsEnabled: false,
    readOnlyReason: null,
  },
}));

const readRuntimeDistributedTaskGraphSupportMock = vi.mocked(
  readRuntimeDistributedTaskGraphSupport
);

describe("useRuntimeDistributedTaskGraphSupport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRuntimeDistributedTaskGraphSupportStoreForTests();
    readRuntimeDistributedTaskGraphSupportMock.mockResolvedValue({
      capabilityEnabled: true,
      interruptEnabled: true,
      retryEnabled: true,
      actionsEnabled: true,
      readOnlyReason: null,
    });
  });

  it("loads runtime graph support into the shared store", async () => {
    const { result } = renderHook(() => useRuntimeDistributedTaskGraphSupport());

    await waitFor(() => {
      expect(result.current.capabilityEnabled).toBe(true);
    });
    expect(readRuntimeDistributedTaskGraphSupportMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a read-only reason when runtime support loading fails", async () => {
    readRuntimeDistributedTaskGraphSupportMock.mockRejectedValue(
      new Error("runtime graph support probe failed")
    );

    const { result } = renderHook(() => useRuntimeDistributedTaskGraphSupport());

    await waitFor(() => {
      expect(result.current.readOnlyReason).toBe("runtime graph support probe failed");
    });
    expect(result.current.capabilityEnabled).toBe(false);
    expect(result.current.actionsEnabled).toBe(false);
  });
});
