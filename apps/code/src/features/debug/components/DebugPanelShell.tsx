import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { DebugDiagnosticsExportFeedback } from "./DebugDiagnosticsExportFeedback";
import { DebugPanelHeader } from "./DebugPanelHeader";

export type DebugPanelShellProps = {
  variant: "dock" | "full";
  isOpen: boolean;
  onResizeStart?: (event: ReactMouseEvent) => void;
  diagnosticsExportBusy: boolean;
  diagnosticsExportSupported: boolean;
  onExportDiagnostics: (mode: "full" | "metadata") => void;
  onCopy: () => void;
  onClear: () => void;
  diagnosticsExportCapabilityResolved: boolean;
  diagnosticsExportError: string | null;
  diagnosticsExportStatus: string | null;
  children: ReactNode;
};

export function DebugPanelShell({
  variant,
  isOpen,
  onResizeStart,
  diagnosticsExportBusy,
  diagnosticsExportSupported,
  onExportDiagnostics,
  onCopy,
  onClear,
  diagnosticsExportCapabilityResolved,
  diagnosticsExportError,
  diagnosticsExportStatus,
  children,
}: DebugPanelShellProps) {
  return (
    <section className={`debug-panel ${variant === "full" ? "full" : isOpen ? "open" : ""}`}>
      {variant !== "full" && isOpen && onResizeStart ? (
        <button
          type="button"
          className="debug-panel-resizer"
          aria-label="Resize debug panel"
          onMouseDown={onResizeStart}
        />
      ) : null}
      <DebugPanelHeader
        diagnosticsExportBusy={diagnosticsExportBusy}
        diagnosticsExportSupported={diagnosticsExportSupported}
        onExportDiagnostics={onExportDiagnostics}
        onCopy={onCopy}
        onClear={onClear}
      />
      <DebugDiagnosticsExportFeedback
        diagnosticsExportCapabilityResolved={diagnosticsExportCapabilityResolved}
        diagnosticsExportSupported={diagnosticsExportSupported}
        diagnosticsExportError={diagnosticsExportError}
        diagnosticsExportStatus={diagnosticsExportStatus}
      />
      {children}
    </section>
  );
}
