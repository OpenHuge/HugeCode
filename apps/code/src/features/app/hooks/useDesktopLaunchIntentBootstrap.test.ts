// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumePendingDesktopLaunchIntent } from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { useDesktopLaunchIntentBootstrap } from "./useDesktopLaunchIntentBootstrap";

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  consumePendingDesktopLaunchIntent: vi.fn(async () => null),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const consumePendingDesktopLaunchIntentMock = vi.mocked(consumePendingDesktopLaunchIntent);
const pushErrorToastMock = vi.mocked(pushErrorToast);

describe("useDesktopLaunchIntentBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records and surfaces protocol launch intents", async () => {
    consumePendingDesktopLaunchIntentMock.mockResolvedValue({
      kind: "protocol",
      receivedAt: "2026-03-24T10:00:00.000Z",
      url: "hugecode://open/workspace/demo",
    });
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
});
