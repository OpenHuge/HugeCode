// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopLaunchIntent } from "@ku0/code-platform-interfaces";
import {
  consumePendingDesktopLaunchIntent,
  subscribeToDesktopLaunchIntents,
} from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { useDesktopLaunchIntentBootstrap } from "./useDesktopLaunchIntentBootstrap";

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  consumePendingDesktopLaunchIntent: vi.fn(async () => null),
  subscribeToDesktopLaunchIntents: vi.fn(() => () => undefined),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const consumePendingDesktopLaunchIntentMock = vi.mocked(consumePendingDesktopLaunchIntent);
const subscribeToDesktopLaunchIntentsMock = vi.mocked(subscribeToDesktopLaunchIntents);
const pushErrorToastMock = vi.mocked(pushErrorToast);

describe("useDesktopLaunchIntentBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeToDesktopLaunchIntentsMock.mockReturnValue(() => undefined);
  });

  it("records and surfaces protocol launch intents", async () => {
    consumePendingDesktopLaunchIntentMock
      .mockResolvedValueOnce({
        kind: "protocol",
        receivedAt: "2026-03-24T10:00:00.000Z",
        url: "hugecode://open/workspace/demo",
      })
      .mockResolvedValueOnce(null);
    const onDebug = vi.fn();

    renderHook(() => useDesktopLaunchIntentBootstrap({ onDebug }));

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "desktop/launch-intent",
          payload: "protocol: hugecode://open/workspace/demo",
        })
      );
    });
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "desktop-launch-intent-protocol-2026-03-24T10:00:00.000Z",
        title: "Deep link received",
      })
    );
  });

  it("does not emit a toast when there is no pending intent", async () => {
    consumePendingDesktopLaunchIntentMock.mockResolvedValue(null);
    const onDebug = vi.fn();

    renderHook(() => useDesktopLaunchIntentBootstrap({ onDebug }));

    await waitFor(() => {
      expect(consumePendingDesktopLaunchIntentMock).toHaveBeenCalledTimes(1);
    });
    expect(onDebug).not.toHaveBeenCalled();
    expect(pushErrorToastMock).not.toHaveBeenCalled();
  });

  it("surfaces workspace launch intents with the resolved workspace path", async () => {
    consumePendingDesktopLaunchIntentMock
      .mockResolvedValueOnce({
        kind: "workspace",
        launchPath: "/workspace/demo/src/main.ts",
        launchPathKind: "file",
        receivedAt: "2026-03-24T10:00:00.000Z",
        workspaceLabel: "demo",
        workspacePath: "/workspace/demo",
      })
      .mockResolvedValueOnce(null);
    const onDebug = vi.fn();

    renderHook(() => useDesktopLaunchIntentBootstrap({ onDebug }));

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "desktop/launch-intent",
          payload: "workspace: /workspace/demo/src/main.ts -> /workspace/demo",
        })
      );
    });
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "desktop-launch-intent-workspace-2026-03-24T10:00:00.000Z",
        title: "File opened in workspace",
        message: "HugeCode opened the containing workspace for /workspace/demo/src/main.ts.",
      })
    );
  });

  it("drains multiple queued cold-start launch intents in order", async () => {
    consumePendingDesktopLaunchIntentMock
      .mockResolvedValueOnce({
        kind: "workspace",
        launchPath: "/workspace/demo/src/main.ts",
        launchPathKind: "file",
        receivedAt: "2026-03-24T10:00:00.000Z",
        workspaceLabel: "demo",
        workspacePath: "/workspace/demo",
      })
      .mockResolvedValueOnce({
        kind: "protocol",
        receivedAt: "2026-03-24T10:00:01.000Z",
        url: "hugecode://open/workspace/demo",
      })
      .mockResolvedValueOnce(null);
    const onDebug = vi.fn();

    renderHook(() => useDesktopLaunchIntentBootstrap({ onDebug }));

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledTimes(2);
    });
    expect(onDebug).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        label: "desktop/launch-intent",
        payload: "workspace: /workspace/demo/src/main.ts -> /workspace/demo",
      })
    );
    expect(onDebug).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        label: "desktop/launch-intent",
        payload: "protocol: hugecode://open/workspace/demo",
      })
    );
  });

  it("subscribes to live launch intents and surfaces them through the same handler", async () => {
    let listener: ((intent: DesktopLaunchIntent) => void) | null = null;
    subscribeToDesktopLaunchIntentsMock.mockImplementation((nextListener) => {
      listener = nextListener as typeof listener;
      return () => {
        listener = null;
      };
    });
    const onDebug = vi.fn();

    renderHook(() => useDesktopLaunchIntentBootstrap({ onDebug }));

    listener?.({
      kind: "workspace",
      launchPath: "/workspace/demo/src/main.ts",
      launchPathKind: "file",
      receivedAt: "2026-03-25T10:00:00.000Z",
      workspaceLabel: "demo",
      workspacePath: "/workspace/demo",
    });

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "desktop/launch-intent",
          payload: "workspace: /workspace/demo/src/main.ts -> /workspace/demo",
        })
      );
    });
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "desktop-launch-intent-workspace-2026-03-25T10:00:00.000Z",
        title: "File opened in workspace",
      })
    );
  });
});
