export function DebugDiagnosticsExportFeedback({
  diagnosticsExportCapabilityResolved,
  diagnosticsExportSupported,
  diagnosticsExportError,
  diagnosticsExportStatus,
}: {
  diagnosticsExportCapabilityResolved: boolean;
  diagnosticsExportSupported: boolean;
  diagnosticsExportError: string | null;
  diagnosticsExportStatus: string | null;
}) {
  return (
    <>
      {diagnosticsExportCapabilityResolved && !diagnosticsExportSupported ? (
        <div className="debug-runtime-probe-status" data-testid="debug-diagnostics-export-hint">
          Runtime does not support diagnostics export v1.
        </div>
      ) : null}
      {diagnosticsExportError ? (
        <div className="debug-runtime-probe-error" data-testid="debug-diagnostics-export-error">
          {diagnosticsExportError}
        </div>
      ) : null}
      {diagnosticsExportStatus ? (
        <div className="debug-runtime-probe-status" data-testid="debug-diagnostics-export-status">
          {diagnosticsExportStatus}
        </div>
      ) : null}
    </>
  );
}
