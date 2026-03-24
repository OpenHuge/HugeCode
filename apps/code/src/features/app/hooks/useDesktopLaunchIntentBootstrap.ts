import { useEffect } from "react";
import type { DesktopLaunchIntent } from "@ku0/code-platform-interfaces";
import { consumePendingDesktopLaunchIntent } from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { DebugEntry } from "../../../types";

type UseDesktopLaunchIntentBootstrapInput = {
  enabled?: boolean;
  onDebug: (entry: DebugEntry) => void;
};

function describeLaunchIntent(intent: DesktopLaunchIntent) {
  switch (intent.kind) {
    case "protocol":
      return {
        message:
          "HugeCode received a hugecode:// link. This beta records the link, but in-app deep-link routing is still limited.",
        title: "Deep link received",
      };
    case "post-install":
      return {
        message: "HugeCode finished installing and desktop integrations are ready.",
        title: "HugeCode is ready",
      };
    case "post-update":
      return {
        message: "HugeCode restarted after applying an update.",
        title: "HugeCode updated",
      };
    case "launch":
    default:
      return null;
  }
}

export function useDesktopLaunchIntentBootstrap({
  enabled = true,
  onDebug,
}: UseDesktopLaunchIntentBootstrapInput) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    void consumePendingDesktopLaunchIntent()
      .then((intent) => {
        if (!active || !intent) {
          return;
        }

        onDebug({
          id: `${Date.now()}-desktop-launch-intent`,
          timestamp: Date.now(),
          source: "client",
          label: "desktop/launch-intent",
          payload: intent.url ? `${intent.kind}: ${intent.url}` : intent.kind,
        });

        const toast = describeLaunchIntent(intent);
        if (!toast) {
          return;
        }

        pushErrorToast({
          id: `desktop-launch-intent-${intent.kind}-${intent.receivedAt}`,
          title: toast.title,
          message: toast.message,
          durationMs: 7000,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        onDebug({
          id: `${Date.now()}-desktop-launch-intent-error`,
          timestamp: Date.now(),
          source: "error",
          label: "desktop/launch-intent-error",
          payload: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
    };
  }, [enabled, onDebug]);
}
