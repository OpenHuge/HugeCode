import { useCallback, useState } from "react";
import { runtimeDiagnosticsExportV1 } from "../../../application/runtime/ports/tauriRuntime";

type UseRuntimeDiagnosticsExportOptions = {
  workspaceId?: string | null;
};

type RuntimeDiagnosticsExportMode = "full" | "metadata";

function decodeBase64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  const decoded = globalThis.atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function triggerDiagnosticsExportDownload(
  zipBase64: string,
  filename: string,
  mimeType: string
): void {
  const bytes = decodeBase64ToBytes(zipBase64);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function formatDiagnosticsExportStatus(options: {
  includeZipBase64: boolean;
  filename: string;
  sizeBytes: number;
  sectionCount: number;
  warnings: string[];
}): string {
  const statusPrefix = options.includeZipBase64
    ? `Exported ${options.filename} (${options.sizeBytes} bytes).`
    : `Exported diagnostics metadata for ${options.filename} (${options.sectionCount} sections).`;
  const warningsSuffix =
    options.warnings.length > 0 ? ` Warnings: ${options.warnings.join(" | ")}` : "";
  return `${statusPrefix}${warningsSuffix}`;
}

export function useRuntimeDiagnosticsExport({
  workspaceId = null,
}: UseRuntimeDiagnosticsExportOptions) {
  const [diagnosticsExportBusy, setDiagnosticsExportBusy] = useState(false);
  const [diagnosticsExportStatus, setDiagnosticsExportStatus] = useState<string | null>(null);
  const [diagnosticsExportError, setDiagnosticsExportError] = useState<string | null>(null);

  const exportDiagnostics = useCallback(
    async (mode: RuntimeDiagnosticsExportMode) => {
      const includeZipBase64 = mode === "full";
      setDiagnosticsExportBusy(true);
      setDiagnosticsExportError(null);
      setDiagnosticsExportStatus(null);
      try {
        const exported = await runtimeDiagnosticsExportV1({
          workspaceId,
          redactionLevel: "strict",
          includeTaskSummaries: false,
          includeEventTail: true,
          includeZipBase64,
        });
        if (!exported) {
          setDiagnosticsExportError("Runtime does not support diagnostics export v1.");
          return;
        }
        if (includeZipBase64) {
          if (typeof exported.zipBase64 !== "string" || exported.zipBase64.trim().length === 0) {
            setDiagnosticsExportError(
              "Diagnostics export payload omitted zipBase64; retry with full export."
            );
            return;
          }
          triggerDiagnosticsExportDownload(
            exported.zipBase64,
            exported.filename,
            exported.mimeType
          );
        } else if (exported.zipBase64 !== null) {
          setDiagnosticsExportError(
            "Diagnostics metadata export returned unexpected zip payload; expected zipBase64=null."
          );
          return;
        }
        setDiagnosticsExportStatus(
          formatDiagnosticsExportStatus({
            includeZipBase64,
            filename: exported.filename,
            sizeBytes: exported.sizeBytes,
            sectionCount: exported.sections.length,
            warnings: exported.warnings,
          })
        );
      } catch (error) {
        setDiagnosticsExportError(error instanceof Error ? error.message : String(error));
      } finally {
        setDiagnosticsExportBusy(false);
      }
    },
    [workspaceId]
  );

  return {
    diagnosticsExportBusy,
    diagnosticsExportError,
    diagnosticsExportStatus,
    exportDiagnostics,
  };
}
