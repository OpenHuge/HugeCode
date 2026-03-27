import { useEffect } from "react";
import type { DebugEntry } from "../../../types";

type Params = {
  enabled?: boolean;
  reduceTransparency: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

export function useLiquidGlassEffect({ enabled = true, reduceTransparency, onDebug }: Params) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    void reduceTransparency;
    void onDebug;
  }, [enabled, onDebug, reduceTransparency]);
}
