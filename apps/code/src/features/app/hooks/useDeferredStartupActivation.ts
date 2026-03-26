import { useEffect, useState } from "react";

type UseDeferredStartupActivationOptions = {
  fallbackDelayMs?: number;
};

const DEFAULT_FALLBACK_DELAY_MS = 1_500;

function noop() {
  return;
}

export function useDeferredStartupActivation({
  fallbackDelayMs = DEFAULT_FALLBACK_DELAY_MS,
}: UseDeferredStartupActivationOptions = {}) {
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (activated || typeof window === "undefined") {
      return;
    }

    let settled = false;
    let cleanupIdleCallback = noop;

    const activate = () => {
      if (settled) {
        return;
      }
      settled = true;
      setActivated(true);
    };

    const scheduleIdleActivation = () => {
      if (typeof window.requestIdleCallback === "function") {
        const idleHandle = window.requestIdleCallback(() => {
          activate();
        });
        cleanupIdleCallback = () => {
          window.cancelIdleCallback?.(idleHandle);
        };
        return;
      }

      const idleTimeoutHandle = window.setTimeout(() => {
        activate();
      }, 0);
      cleanupIdleCallback = () => {
        window.clearTimeout(idleTimeoutHandle);
      };
    };

    const interactionEventOptions = { capture: true, passive: true, once: true } as const;
    window.addEventListener("pointerdown", activate, interactionEventOptions);
    window.addEventListener("keydown", activate, {
      capture: true,
      once: true,
    });

    scheduleIdleActivation();

    const fallbackTimeoutHandle = window.setTimeout(() => {
      activate();
    }, fallbackDelayMs);

    return () => {
      settled = true;
      cleanupIdleCallback();
      window.clearTimeout(fallbackTimeoutHandle);
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("keydown", activate, true);
    };
  }, [activated, fallbackDelayMs]);

  return activated;
}
