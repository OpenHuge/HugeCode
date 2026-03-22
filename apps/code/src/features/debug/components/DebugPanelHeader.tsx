import { Button } from "../../../design-system";

export function DebugPanelHeader({
  diagnosticsExportBusy,
  diagnosticsExportSupported,
  onExportDiagnostics,
  onCopy,
  onClear,
}: {
  diagnosticsExportBusy: boolean;
  diagnosticsExportSupported: boolean;
  onExportDiagnostics: (mode: "full" | "metadata") => void;
  onCopy: () => void;
  onClear: () => void;
}) {
  return (
    <div className="debug-header">
      <div className="debug-title">Debug</div>
      <div className="debug-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExportDiagnostics("full")}
          disabled={!diagnosticsExportSupported || diagnosticsExportBusy}
          data-testid="debug-diagnostics-export-button"
        >
          {diagnosticsExportBusy ? "Exporting..." : "Export"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExportDiagnostics("metadata")}
          disabled={!diagnosticsExportSupported || diagnosticsExportBusy}
          data-testid="debug-diagnostics-export-metadata-button"
        >
          {diagnosticsExportBusy ? "Exporting..." : "Export Metadata"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
