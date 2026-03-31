import { useEffect } from "react";
import { scheduleDeferredActivation } from "@ku0/shared";
import { detectDesktopRuntimeHost } from "../application/runtime/facades/desktopHostFacade";
import { recordSentryMetricIfAvailable } from "../features/shared/sentry";
import {
  getDesktopArchitectureTag,
  getDesktopPlatformArchitectureTag,
  getDesktopPlatformTag,
  isMobilePlatform,
} from "../utils/platformPaths";

const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const SENTRY_FALLBACK_INITIALIZATION_DELAY_MS = 5_000;
const STARTUP_LONG_TASK_OBSERVER_WINDOW_MS = 15_000;

let sentryInitializationPromise: Promise<void> | null = null;

function noop() {
  return;
}

async function initializeSentry() {
  const sentryDsn =
    typeof import.meta.env.VITE_SENTRY_DSN === "string"
      ? import.meta.env.VITE_SENTRY_DSN.trim()
      : "";
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    release: appVersion,
  });

  Sentry.metrics.count("app_open", 1, {
    attributes: {
      env: import.meta.env.MODE,
      platform: getDesktopPlatformTag(),
      architecture: getDesktopArchitectureTag(),
      platformArch: getDesktopPlatformArchitectureTag(),
    },
  });
}

export function ensureSentryInitialized() {
  const sentryDsn =
    typeof import.meta.env.VITE_SENTRY_DSN === "string"
      ? import.meta.env.VITE_SENTRY_DSN.trim()
      : "";
  const sentryEnabled =
    import.meta.env.VITE_SENTRY_ENABLED === "1" ||
    import.meta.env.VITE_SENTRY_ENABLED === "true" ||
    import.meta.env.VITE_SENTRY_ENABLED === "yes" ||
    import.meta.env.VITE_SENTRY_ENABLED === "on";
  if (!sentryEnabled || !sentryDsn) {
    return Promise.resolve();
  }
  if (sentryInitializationPromise) {
    return sentryInitializationPromise;
  }
  sentryInitializationPromise = initializeSentry().catch((error) => {
    sentryInitializationPromise = null;
    throw error;
  });
  return sentryInitializationPromise;
}

function scheduleSentryInitialization() {
  return scheduleDeferredActivation(
    () => {
      void ensureSentryInitialized();
    },
    {
      idleTimeoutMs: 0,
      fallbackDelayMs: SENTRY_FALLBACK_INITIALIZATION_DELAY_MS,
    }
  );
}

function installStartupLongTaskObserver() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return noop;
  }

  const supportedEntryTypes = PerformanceObserver.supportedEntryTypes ?? [];
  if (!supportedEntryTypes.includes("longtask")) {
    return noop;
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const duration = Math.round(entry.duration);
      void recordSentryMetricIfAvailable("startup_long_task", 1, {
        attributes: {
          duration_bucket: duration >= 250 ? "250_plus" : duration >= 100 ? "100_249" : "50_99",
        },
      });
    }
  });

  observer.observe({ type: "longtask", buffered: true });

  const timeoutHandle = window.setTimeout(() => {
    observer.disconnect();
  }, STARTUP_LONG_TASK_OBSERVER_WINDOW_MS);

  return () => {
    window.clearTimeout(timeoutHandle);
    observer.disconnect();
  };
}

export function installMobileZoomGesturePrevention() {
  if (!isMobilePlatform() || typeof document === "undefined") {
    return noop;
  }

  const preventGesture = (event: Event) => event.preventDefault();
  const preventPinch = (event: TouchEvent) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  };

  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("gestureend", preventGesture, { passive: false });
  document.addEventListener("touchmove", preventPinch, { passive: false });

  return () => {
    document.removeEventListener("gesturestart", preventGesture);
    document.removeEventListener("gesturechange", preventGesture);
    document.removeEventListener("gestureend", preventGesture);
    document.removeEventListener("touchmove", preventPinch);
  };
}

export function installMobileViewportHeightSync() {
  if (!isMobilePlatform() || typeof window === "undefined" || typeof document === "undefined") {
    return noop;
  }

  let rafHandle = 0;

  const setViewportHeight = () => {
    const visualViewport = window.visualViewport;
    const viewportHeight = visualViewport
      ? visualViewport.height + visualViewport.offsetTop
      : window.innerHeight;
    const nextHeight = Math.round(viewportHeight);
    document.documentElement.style.setProperty("--app-height", `${nextHeight}px`);
  };

  const scheduleViewportHeight = () => {
    if (rafHandle) {
      return;
    }
    rafHandle = window.requestAnimationFrame(() => {
      rafHandle = 0;
      setViewportHeight();
    });
  };

  const setComposerFocusState = () => {
    const activeElement = document.activeElement;
    const isComposerTextareaFocused =
      activeElement instanceof HTMLTextAreaElement && activeElement.closest(".composer") !== null;
    document.documentElement.dataset.mobileComposerFocus = isComposerTextareaFocused
      ? "true"
      : "false";
  };

  const handleFocusOut = () => {
    requestAnimationFrame(setComposerFocusState);
  };

  setViewportHeight();
  setComposerFocusState();
  window.addEventListener("resize", scheduleViewportHeight, { passive: true });
  window.addEventListener("orientationchange", scheduleViewportHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleViewportHeight, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleViewportHeight, { passive: true });
  document.addEventListener("focusin", setComposerFocusState);
  document.addEventListener("focusout", handleFocusOut);

  return () => {
    if (rafHandle) {
      window.cancelAnimationFrame(rafHandle);
    }
    window.removeEventListener("resize", scheduleViewportHeight);
    window.removeEventListener("orientationchange", scheduleViewportHeight);
    window.visualViewport?.removeEventListener("resize", scheduleViewportHeight);
    window.visualViewport?.removeEventListener("scroll", scheduleViewportHeight);
    document.removeEventListener("focusin", setComposerFocusState);
    document.removeEventListener("focusout", handleFocusOut);
  };
}

export async function applyRuntimeFlags() {
  if (typeof document === "undefined") {
    return;
  }
  const runtimeHost = await detectDesktopRuntimeHost();
  document.documentElement.dataset.desktopRuntime = runtimeHost;
  document.documentElement.dataset.electronRuntime = runtimeHost === "electron" ? "true" : "false";
  document.documentElement.removeAttribute("data-desktop-host-runtime");
}

export function resetRuntimeBootstrapStateForTest() {
  sentryInitializationPromise = null;
}

export function RuntimeBootstrapEffects() {
  useEffect(() => {
    void applyRuntimeFlags();
    const cleanupZoom = installMobileZoomGesturePrevention();
    const cleanupViewport = installMobileViewportHeightSync();
    const cleanupSentry = scheduleSentryInitialization();
    const cleanupLongTaskObserver = installStartupLongTaskObserver();

    return () => {
      cleanupLongTaskObserver();
      cleanupSentry();
      cleanupViewport();
      cleanupZoom();
    };
  }, []);

  return null;
}
