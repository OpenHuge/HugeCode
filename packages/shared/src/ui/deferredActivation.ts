import { useEffect, useState } from "react";

type IdleCallbackHandle = number;

type IdleCallbackOptions = {
  timeout?: number;
};

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

export type DeferredActivationOptions = {
  enabled?: boolean;
  idleTimeoutMs?: number;
  fallbackDelayMs?: number;
};

const DEFAULT_IDLE_TIMEOUT_MS = 250;
const DEFAULT_FALLBACK_DELAY_MS = 1_500;

function noop() {
  return;
}

export function scheduleDeferredActivation(
  listener: () => void,
  options: DeferredActivationOptions = {}
) {
  const enabled = options.enabled ?? true;
  if (!enabled) {
    listener();
    return noop;
  }

  if (typeof window === "undefined") {
    listener();
    return noop;
  }

  let settled = false;
  let cleanupIdleCallback = noop;

  const activate = () => {
    if (settled) {
      return;
    }
    settled = true;
    listener();
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleCallback,
      options?: IdleCallbackOptions
    ) => IdleCallbackHandle;
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };

  if (
    typeof idleWindow.requestIdleCallback === "function" &&
    typeof idleWindow.cancelIdleCallback === "function"
  ) {
    const idleHandle = idleWindow.requestIdleCallback(
      () => {
        activate();
      },
      { timeout: options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS }
    );
    cleanupIdleCallback = () => {
      idleWindow.cancelIdleCallback?.(idleHandle);
    };
  } else {
    const idleTimeoutHandle = window.setTimeout(() => {
      activate();
    }, options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS);
    cleanupIdleCallback = () => {
      window.clearTimeout(idleTimeoutHandle);
    };
  }

  const interactionEventOptions = { capture: true, passive: true, once: true } as const;
  window.addEventListener("pointerdown", activate, interactionEventOptions);
  window.addEventListener("keydown", activate, {
    capture: true,
    once: true,
  });

  const fallbackTimeoutHandle = window.setTimeout(() => {
    activate();
  }, options.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS);

  return () => {
    settled = true;
    cleanupIdleCallback();
    window.clearTimeout(fallbackTimeoutHandle);
    window.removeEventListener("pointerdown", activate, true);
    window.removeEventListener("keydown", activate, true);
  };
}

export function useDeferredActivation(options: DeferredActivationOptions = {}) {
  const enabled = options.enabled ?? true;
  const idleTimeoutMs = options.idleTimeoutMs;
  const fallbackDelayMs = options.fallbackDelayMs;
  const [activated, setActivated] = useState(() => !enabled);

  useEffect(() => {
    if (!enabled) {
      setActivated(true);
      return;
    }
    if (activated) {
      return;
    }
    return scheduleDeferredActivation(
      () => {
        setActivated(true);
      },
      {
        enabled,
        idleTimeoutMs,
        fallbackDelayMs,
      }
    );
  }, [activated, enabled, fallbackDelayMs, idleTimeoutMs]);

  return activated;
}
