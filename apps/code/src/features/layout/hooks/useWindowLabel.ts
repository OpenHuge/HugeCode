import { useEffect, useState } from "react";
import { resolveWindowLabel } from "../../../application/runtime/facades/desktopHostFacade";

export function useWindowLabel(defaultLabel = "main") {
  const [label, setLabel] = useState(defaultLabel);

  useEffect(() => {
    let cancelled = false;

    void resolveWindowLabel(defaultLabel).then((nextLabel) => {
      if (!cancelled) {
        setLabel(nextLabel);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [defaultLabel]);

  return label;
}
