import { useEffect } from "react";
import { detectTauriRuntime } from "../application/runtime/ports/tauriEnvironment";
import {
  getDesktopArchitectureTag,
  getDesktopPlatformArchitectureTag,
  getDesktopPlatformTag,
  isMobilePlatform,
} from "../utils/platformPaths";

const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

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
  document.documentElement.dataset.tauriRuntime = (await detectTauriRuntime()) ? "true" : "false";
}

export function resetRuntimeBootstrapStateForTest() {
  sentryInitializationPromise = null;
}

export function RuntimeBootstrapEffects() {
  useEffect(() => {
    void applyRuntimeFlags();
    const cleanupZoom = installMobileZoomGesturePrevention();
    const cleanupViewport = installMobileViewportHeightSync();
    void ensureSentryInitialized();

    return () => {
      cleanupViewport();
      cleanupZoom();
    };
  }, []);

  return null;
}
