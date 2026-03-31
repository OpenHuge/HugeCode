import { useEffect, useState } from "react";
import { getRuntimeCapabilitiesSummary } from "../../../application/runtime/ports/runtime";
import { BACKEND_PLACEMENT_OBSERVABILITY_CAPABILITY } from "../../settings/types/backendPool";

const RUNTIME_DIAGNOSTICS_EXPORT_METHOD = "code_runtime_diagnostics_export_v1";
const RUNTIME_DIAGNOSTICS_EXPORT_FEATURE = "runtime_diagnostics_export_v1";

type DebugRuntimeCapabilities = {
  observabilityCapabilityEnabled: boolean;
  diagnosticsExportCapabilityResolved: boolean;
  diagnosticsExportSupported: boolean;
};

const DEFAULT_DEBUG_RUNTIME_CAPABILITIES: DebugRuntimeCapabilities = {
  observabilityCapabilityEnabled: false,
  diagnosticsExportCapabilityResolved: false,
  diagnosticsExportSupported: false,
};

export function useDebugRuntimeCapabilities(): DebugRuntimeCapabilities {
  const [capabilities, setCapabilities] = useState<DebugRuntimeCapabilities>(
    DEFAULT_DEBUG_RUNTIME_CAPABILITIES
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const summary = await getRuntimeCapabilitiesSummary();
        if (cancelled) {
          return;
        }
        setCapabilities({
          observabilityCapabilityEnabled: summary.features.includes(
            BACKEND_PLACEMENT_OBSERVABILITY_CAPABILITY
          ),
          diagnosticsExportSupported:
            summary.methods.includes(RUNTIME_DIAGNOSTICS_EXPORT_METHOD) ||
            summary.features.includes(RUNTIME_DIAGNOSTICS_EXPORT_FEATURE),
          diagnosticsExportCapabilityResolved: true,
        });
      } catch {
        if (cancelled) {
          return;
        }
        setCapabilities({
          observabilityCapabilityEnabled: false,
          diagnosticsExportSupported: false,
          diagnosticsExportCapabilityResolved: true,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return capabilities;
}
