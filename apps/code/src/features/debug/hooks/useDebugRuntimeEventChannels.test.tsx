// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRuntimeEventBridgeV2Enabled } from "../../../application/runtime/ports/events";
import {
  readRuntimeEventChannelDiagnostics,
  subscribeRuntimeEventChannelDiagnostics,
} from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";
import { createRuntimeEventChannelDiagnostic } from "../test/debugDiagnosticsFixtures";
import { useDebugRuntimeEventChannels } from "./useDebugRuntimeEventChannels";

vi.mock("../../../application/runtime/ports/events", () => ({
  isRuntimeEventBridgeV2Enabled: vi.fn(() => false),
}));

vi.mock("../../../application/runtime/ports/runtimeEventChannelDiagnostics", () => ({
  readRuntimeEventChannelDiagnostics: vi.fn(() => []),
  subscribeRuntimeEventChannelDiagnostics: vi.fn(() => () => undefined),
}));

const isRuntimeEventBridgeV2EnabledMock = vi.mocked(isRuntimeEventBridgeV2Enabled);
const readRuntimeEventChannelDiagnosticsMock = vi.mocked(readRuntimeEventChannelDiagnostics);
const subscribeRuntimeEventChannelDiagnosticsMock = vi.mocked(
  subscribeRuntimeEventChannelDiagnostics
);

describe("useDebugRuntimeEventChannels", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads the initial event channel snapshot and bridge path", async () => {
    readRuntimeEventChannelDiagnosticsMock.mockReturnValue([
      createRuntimeEventChannelDiagnostic({
        id: "app-server-bridge",
        label: "App server bridge",
        status: "reconnecting",
        retryDelayMs: 800,
        lastError: "network timeout",
        fallbackSinceMs: 1234,
        consecutiveFailures: 5,
        lastTransitionReason: "bridge-start-failed",
        updatedAt: 5678,
      }),
    ]);
    isRuntimeEventBridgeV2EnabledMock.mockReturnValue(true);

    const { result } = renderHook(() => useDebugRuntimeEventChannels());

    await waitFor(() => {
      expect(result.current.eventChannelDiagnostics).toHaveLength(1);
    });

    expect(result.current.runtimeEventBridgePath).toBe("v2");
    expect(result.current.eventChannelDiagnostics[0]?.label).toBe("App server bridge");
  });

  it("updates diagnostics when the subscription emits", async () => {
    let emit: ((channels: ReturnType<typeof readRuntimeEventChannelDiagnostics>) => void) | null =
      null;
    readRuntimeEventChannelDiagnosticsMock.mockReturnValue([]);
    subscribeRuntimeEventChannelDiagnosticsMock.mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });

    const { result } = renderHook(() => useDebugRuntimeEventChannels());

    await waitFor(() => {
      expect(subscribeRuntimeEventChannelDiagnosticsMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      emit?.([
        createRuntimeEventChannelDiagnostic({
          id: "runtime-events",
          label: "Runtime events",
          status: "connected",
          retryAttempt: 0,
          retryDelayMs: null,
          lastError: null,
          fallbackSinceMs: null,
          consecutiveFailures: 0,
          lastTransitionReason: "initial-connect",
          updatedAt: 9999,
        }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.eventChannelDiagnostics).toHaveLength(1);
    });

    expect(result.current.eventChannelDiagnostics[0]?.status).toBe("connected");
  });
});
