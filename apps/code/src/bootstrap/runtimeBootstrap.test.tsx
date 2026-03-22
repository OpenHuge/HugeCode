/** @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeBootstrapStateForTest, RuntimeBootstrapEffects } from "./runtimeBootstrap";

const { detectTauriRuntimeMock, sentryInitMock, sentryMetricsCountMock, isMobilePlatformMock } =
  vi.hoisted(() => ({
    detectTauriRuntimeMock: vi.fn(),
    sentryInitMock: vi.fn(),
    sentryMetricsCountMock: vi.fn(),
    isMobilePlatformMock: vi.fn(),
  }));

vi.mock("@sentry/react", () => ({
  init: sentryInitMock,
  metrics: {
    count: sentryMetricsCountMock,
  },
}));

vi.mock("../application/runtime/ports/tauriEnvironment", () => ({
  detectTauriRuntime: detectTauriRuntimeMock,
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
    detectTauriRuntimeMock.mockReset();
    sentryInitMock.mockClear();
    sentryMetricsCountMock.mockClear();
    isMobilePlatformMock.mockReset();
    detectTauriRuntimeMock.mockResolvedValue(false);
    isMobilePlatformMock.mockReturnValue(false);
    document.documentElement.removeAttribute("data-tauri-runtime");
    document.documentElement.removeAttribute("data-mobile-composer-focus");
    document.documentElement.style.removeProperty("--app-height");
  });

  it("applies the tauri runtime flag without mobile listeners by default", async () => {
    detectTauriRuntimeMock.mockResolvedValue(true);
    const addDocumentListenerSpy = vi.spyOn(document, "addEventListener");
    const addWindowListenerSpy = vi.spyOn(window, "addEventListener");

    try {
      render(<RuntimeBootstrapEffects />);
      await waitFor(() => {
        expect(document.documentElement.dataset.tauriRuntime).toBe("true");
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
    vi.stubEnv("VITE_SENTRY_ENABLED", "true");
    vi.stubEnv("VITE_SENTRY_DSN", "https://examplePublicKey@o0.ingest.us.sentry.io/0");

    const first = render(<RuntimeBootstrapEffects />);
    await waitFor(() => {
      expect(sentryInitMock).toHaveBeenCalledTimes(1);
    });
    first.unmount();

    render(<RuntimeBootstrapEffects />);
    await waitFor(() => {
      expect(sentryInitMock).toHaveBeenCalledTimes(1);
    });
    expect(sentryMetricsCountMock).toHaveBeenCalledTimes(1);
  });
});
