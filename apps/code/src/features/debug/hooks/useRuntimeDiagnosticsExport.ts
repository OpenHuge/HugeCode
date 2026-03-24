import { useCallback, useState } from "react";
import {
  filterRuntimeToolLifecycleSnapshot,
  getRuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import { runtimeDiagnosticsExportV1 } from "../../../application/runtime/ports/tauriRuntime";

type UseRuntimeDiagnosticsExportOptions = {
  workspaceId?: string | null;
};

type RuntimeDiagnosticsExportMode = "full" | "metadata";
type DiagnosticsMetadataArtifact = {
  schemaVersion: string;
  exportedAt: number;
  workspaceId: string | null;
  runtimeDiagnostics: {
    schemaVersion: string;
    filename: string;
    source: string;
    redactionLevel: string;
    sizeBytes: number;
    sections: string[];
    warnings: string[];
    redactionStats: unknown;
  };
  lifecycle: {
    revision: number;
    lastEvent: unknown;
    recentEvents: unknown[];
  };
};

function countLifecycleEvents(artifact: DiagnosticsMetadataArtifact): number {
  const eventIds = new Set<string>();
  if (
    artifact.lifecycle.lastEvent &&
    typeof artifact.lifecycle.lastEvent === "object" &&
    "id" in artifact.lifecycle.lastEvent &&
    typeof artifact.lifecycle.lastEvent.id === "string"
  ) {
    eventIds.add(artifact.lifecycle.lastEvent.id);
  }
  for (const event of artifact.lifecycle.recentEvents) {
    if (event && typeof event === "object" && "id" in event && typeof event.id === "string") {
      eventIds.add(event.id);
    }
  }
  return eventIds.size;
}

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
  payload: BlobPart,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([payload], { type: mimeType });
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

function triggerDiagnosticsZipDownload(
  zipBase64: string,
  filename: string,
  mimeType: string
): void {
  const bytes = decodeBase64ToBytes(zipBase64);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  triggerDiagnosticsExportDownload(arrayBuffer, filename, mimeType);
}

function toMetadataArtifactFilename(filename: string): string {
  return filename.endsWith(".zip")
    ? `${filename.slice(0, -4)}.metadata.json`
    : `${filename}.metadata.json`;
}

function createDiagnosticsMetadataArtifact(input: {
  exported: NonNullable<Awaited<ReturnType<typeof runtimeDiagnosticsExportV1>>>;
  workspaceId: string | null;
}): DiagnosticsMetadataArtifact {
  const lifecycleSnapshot = filterRuntimeToolLifecycleSnapshot(
    getRuntimeToolLifecycleSnapshot(),
    input.workspaceId
  );

  return {
    schemaVersion: "runtime-diagnostics-metadata/v1",
    exportedAt: Date.now(),
    workspaceId: input.workspaceId,
    runtimeDiagnostics: {
      schemaVersion: input.exported.schemaVersion,
      filename: input.exported.filename,
      source: input.exported.source,
      redactionLevel: input.exported.redactionLevel,
      sizeBytes: input.exported.sizeBytes,
      sections: input.exported.sections,
      warnings: input.exported.warnings,
      redactionStats: input.exported.redactionStats,
    },
    lifecycle: {
      revision: lifecycleSnapshot.revision,
      lastEvent: lifecycleSnapshot.lastEvent,
      recentEvents: lifecycleSnapshot.recentEvents,
    },
  };
}

function formatDiagnosticsExportStatus(options: {
  includeZipBase64: boolean;
  artifactFilename: string;
  sizeBytes: number;
  sectionCount: number;
  lifecycleEventCount: number;
  warnings: string[];
}): string {
  const statusPrefix = options.includeZipBase64
    ? `Exported ${options.artifactFilename} (${options.sizeBytes} bytes).`
    : `Exported ${options.artifactFilename} (${options.sectionCount} sections, ${options.lifecycleEventCount} lifecycle events).`;
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
        let artifactFilename = exported.filename;
        let lifecycleEventCount = 0;
        if (includeZipBase64) {
          if (typeof exported.zipBase64 !== "string" || exported.zipBase64.trim().length === 0) {
            setDiagnosticsExportError(
              "Diagnostics export payload omitted zipBase64; retry with full export."
            );
            return;
          }
          triggerDiagnosticsZipDownload(exported.zipBase64, exported.filename, exported.mimeType);
        } else if (exported.zipBase64 !== null) {
          setDiagnosticsExportError(
            "Diagnostics metadata export returned unexpected zip payload; expected zipBase64=null."
          );
          return;
        } else {
          artifactFilename = toMetadataArtifactFilename(exported.filename);
          const metadataArtifact = createDiagnosticsMetadataArtifact({
            exported,
            workspaceId,
          });
          lifecycleEventCount = countLifecycleEvents(metadataArtifact);
          triggerDiagnosticsExportDownload(
            JSON.stringify(metadataArtifact, null, 2),
            artifactFilename,
            "application/json"
          );
        }
        setDiagnosticsExportStatus(
          formatDiagnosticsExportStatus({
            includeZipBase64,
            artifactFilename,
            sizeBytes: exported.sizeBytes,
            sectionCount: exported.sections.length,
            lifecycleEventCount,
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
