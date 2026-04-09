/** @vitest-environment jsdom */
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeBootstrapStateForTest, RuntimeBootstrapEffects } from "./runtimeBootstrap";

const {
  detectDesktopRuntimeHostMock,
  sentryInitMock,
  sentryMetricsCountMock,
  isMobilePlatformMock,
  recordSentryMetricIfAvailableMock,
} = vi.hoisted(() => ({
  detectDesktopRuntimeHostMock: vi.fn(),
  sentryInitMock: vi.fn(),
  sentryMetricsCountMock: vi.fn(),
  isMobilePlatformMock: vi.fn(),
  recordSentryMetricIfAvailableMock: vi.fn(async () => true),
}));

vi.mock("@sentry/react", () => ({
  init: sentryInitMock,
  metrics: {
    count: sentryMetricsCountMock,
  },
}));

vi.mock("../application/runtime/facades/desktopHostFacade", () => ({
  detectDesktopRuntimeHost: detectDesktopRuntimeHostMock,
}));

vi.mock("../features/shared/sentry", () => ({
  recordSentryMetricIfAvailable: recordSentryMetricIfAvailableMock,
}));

vi.mock("../utils/platformPaths", () => ({
  getDesktopArchitectureTag: () => "x64",
  getDesktopPlatformArchitectureTag: () => "windows-x64",
  getDesktopPlatformTag: () => "windows",
  isMobilePlatform: isMobilePlatformMock,
}));

describe("RuntimeBootstrapEffects", () => {
  beforeEach(() => {
    resetRuntimeBootstrapStateForTest();
    vi.unstubAllEnvs();
    detectDesktopRuntimeHostMock.mockReset();
    sentryInitMock.mockClear();
    sentryMetricsCountMock.mockClear();
    isMobilePlatformMock.mockReset();
    recordSentryMetricIfAvailableMock.mockClear();
    detectDesktopRuntimeHostMock.mockResolvedValue("browser");
    isMobilePlatformMock.mockReturnValue(false);
    document.documentElement.removeAttribute("data-desktop-runtime");
    document.documentElement.removeAttribute("data-electron-runtime");
    document.documentElement.removeAttribute("data-mobile-composer-focus");
    document.documentElement.style.removeProperty("--app-height");
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "PerformanceObserver", {
      configurable: true,
      value: undefined,
    });
  });

  it("applies the desktop runtime flags without mobile listeners by default", async () => {
    detectDesktopRuntimeHostMock.mockResolvedValue("electron");
    const addDocumentListenerSpy = vi.spyOn(document, "addEventListener");
    const addWindowListenerSpy = vi.spyOn(window, "addEventListener");

    try {
      render(<RuntimeBootstrapEffects />);
      await waitFor(() => {
        expect(document.documentElement.dataset.desktopRuntime).toBe("electron");
        expect(document.documentElement.dataset.electronRuntime).toBe("true");
        expect(document.documentElement.hasAttribute("data-desktop-runtime")).toBe(true);
      });
      expect(addDocumentListenerSpy).not.toHaveBeenCalledWith(
        "gesturestart",
        expect.any(Function),
        expect.anything()
      );
      expect(addWindowListenerSpy).not.toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
        expect.anything()
      );
    } finally {
      addDocumentListenerSpy.mockRestore();
      addWindowListenerSpy.mockRestore();
    }
  });

  it("registers and cleans mobile listeners on unmount", async () => {
    isMobilePlatformMock.mockReturnValue(true);
    const addDocumentListenerSpy = vi.spyOn(document, "addEventListener");
    const removeDocumentListenerSpy = vi.spyOn(document, "removeEventListener");
    const addWindowListenerSpy = vi.spyOn(window, "addEventListener");
    const removeWindowListenerSpy = vi.spyOn(window, "removeEventListener");
    const visualViewport = {
      height: 720,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    });

    try {
      const result = render(<RuntimeBootstrapEffects />);
      await waitFor(() => {
        expect(addDocumentListenerSpy).toHaveBeenCalledWith("gesturestart", expect.any(Function), {
          passive: false,
        });
      });
      result.unmount();

      expect(removeDocumentListenerSpy).toHaveBeenCalledWith("gesturestart", expect.any(Function));
      expect(removeDocumentListenerSpy).toHaveBeenCalledWith("focusout", expect.any(Function));
      expect(addWindowListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function), {
        passive: true,
      });
      expect(removeWindowListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(visualViewport.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function), {
        passive: true,
      });
      expect(visualViewport.removeEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function)
      );
    } finally {
      addDocumentListenerSpy.mockRestore();
      removeDocumentListenerSpy.mockRestore();
      addWindowListenerSpy.mockRestore();
      removeWindowListenerSpy.mockRestore();
    }
  });

  it("initializes sentry only once across repeated mounts", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SENTRY_ENABLED", "true");
    vi.stubEnv("VITE_SENTRY_DSN", "https://examplePublicKey@o0.ingest.us.sentry.io/0");

    const first = render(<RuntimeBootstrapEffects />);
    expect(sentryInitMock).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
      vi.runAllTimers();
      await vi.dynamicImportSettled();
    });
    expect(sentryInitMock).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<RuntimeBootstrapEffects />);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      vi.runAllTimers();
      await vi.dynamicImportSettled();
    });
    expect(sentryInitMock).toHaveBeenCalledTimes(1);
    expect(sentryMetricsCountMock).toHaveBeenCalledTimes(1);
  });

  it("records startup long tasks when the browser supports longtask observation", async () => {
    vi.useFakeTimers();
    const disconnectMock = vi.fn();
    const observeMock = vi.fn();

    class MockPerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(
        private readonly callback: (list: { getEntries: () => Array<{ duration: number }> }) => void
      ) {}
      observe = observeMock;
      disconnect = disconnectMock;
      emit(duration: number) {
        this.callback({
          getEntries: () => [{ duration }],
        });
      }
    }

    let observerInstance: MockPerformanceObserver | null = null;
    Object.defineProperty(window, "PerformanceObserver", {
      configurable: true,
      value: class extends MockPerformanceObserver {
        constructor(callback: (list: { getEntries: () => Array<{ duration: number }> }) => void) {
          super(callback);
          observerInstance = this;
        }
      },
    });

    const result = render(<RuntimeBootstrapEffects />);

    expect(observeMock).toHaveBeenCalledWith({ type: "longtask", buffered: true });

    await act(async () => {
      observerInstance?.emit(180);
      await Promise.resolve();
    });

    expect(recordSentryMetricIfAvailableMock).toHaveBeenCalledWith("startup_long_task", 1, {
      attributes: { duration_bucket: "100_249" },
    });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    expect(disconnectMock).toHaveBeenCalled();
    result.unmount();
  });
});
