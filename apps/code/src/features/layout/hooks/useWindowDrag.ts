import { useEffect } from "react";
import { isTauri } from "../../../application/runtime/ports/tauriCore";
import { getCurrentWindow } from "../../../application/runtime/ports/tauriWindow";

export function useWindowDrag(targetId: string) {
  useEffect(() => {
    try {
      if (!isTauri()) {
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
