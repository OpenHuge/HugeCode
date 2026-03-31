import { useEffect } from "react";
import { isDesktopHostRuntime } from "../../../application/runtime/ports/desktopHostCore";
import { getCurrentWindow } from "../../../application/runtime/ports/desktopHostWindow";

export function useWindowDrag(targetId: string) {
  useEffect(() => {
    try {
      if (!isDesktopHostRuntime()) {
        return;
      }
    } catch {
      return;
    }

    const el = document.getElementById(targetId);
    if (!el) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (event.buttons !== 1) {
        return;
      }
      try {
        void getCurrentWindow()
          .startDragging()
          .catch(() => undefined);
      } catch {
        // Ignore startDragging failures in environments without a native window bridge.
      }
    };

    el.addEventListener("mousedown", handler);
    return () => {
      el.removeEventListener("mousedown", handler);
    };
  }, [targetId]);
}
