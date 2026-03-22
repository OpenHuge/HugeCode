import { describe, expect, it, vi } from "vitest";
import { logger } from "./logger";
import {
  exportRuntimeDiagnosticsWithFallback,
  RuntimeDiagnosticsExportPayloadInvalidError,
} from "./runtimeClientDiagnosticsExport";
import type { RuntimeClient } from "./runtimeClientTypes";

function createBaseResponse() {
  return {
    schemaVersion: "runtime-diagnostics-export/v1" as const,
    exportedAt: 1_770_000_000_000,
    source: "runtime-service" as const,
    redactionLevel: "strict" as const,
    filename: "runtime-diagnostics-1.zip",
    mimeType: "application/zip" as const,
    sizeBytes: 120,
    zipBase64: "UEsDBAoAAAAAA",
    sections: ["manifest.json", "runtime/health.json"],
    warnings: [],
    redactionStats: {
      redactedKeys: 2,
      redactedValues: 1,
      hashedPaths: 3,
      hashedEmails: 0,
      hashedSecrets: 1,
    },
  };
}

describe("runtimeClientDiagnosticsExport", () => {
  it("normalizes request defaults and returns validated response", async () => {
    const runtimeDiagnosticsExportV1 = vi.fn().mockResolvedValue(createBaseResponse());
    const client = {
      runtimeDiagnosticsExportV1,
    } as unknown as RuntimeClient;

    const result = await exportRuntimeDiagnosticsWithFallback(client, {
      workspaceId: "ws-1",
      includeTaskSummaries: true,
    });

    expect(runtimeDiagnosticsExportV1).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      redactionLevel: "strict",
      includeTaskSummaries: true,
      includeEventTail: true,
      includeZipBase64: true,
    });
    expect(result).toEqual(createBaseResponse());
  });

  it("returns null on METHOD_NOT_FOUND", async () => {
    const runtimeDiagnosticsExportV1 = vi.fn().mockRejectedValue({
      code: "METHOD_NOT_FOUND",
      message: "Unknown method code_runtime_diagnostics_export_v1",
    });
    const client = {
      runtimeDiagnosticsExportV1,
    } as unknown as RuntimeClient;

    await expect(exportRuntimeDiagnosticsWithFallback(client)).resolves.toBeNull();
  });

  it("throws validation error and logs diagnostics when response shape is invalid", async () => {
    const runtimeDiagnosticsExportV1 = vi.fn().mockResolvedValue({
      schemaVersion: "runtime-diagnostics-export/v1",
      exportedAt: 1,
      source: "runtime-service",
      redactionLevel: "strict",
      filename: "runtime.zip",
      mimeType: "application/zip",
      sizeBytes: 1,
      zipBase64: "UEs",
      sections: ["manifest.json"],
      warnings: [],
      redactionStats: {
        redactedKeys: 0,
        redactedValues: 0,
        hashedPaths: 0,
        hashedEmails: 0,
      },
    });
    const loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const client = {
      runtimeDiagnosticsExportV1,
    } as unknown as RuntimeClient;

    await expect(exportRuntimeDiagnosticsWithFallback(client)).rejects.toBeInstanceOf(
      RuntimeDiagnosticsExportPayloadInvalidError
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "Runtime diagnostics export schema validation failed.",
      expect.objectContaining({ reason: expect.stringContaining("redactionStats") })
    );

    loggerWarnSpy.mockRestore();
  });

  it("accepts lightweight diagnostics response when zipBase64 is null", async () => {
    const runtimeDiagnosticsExportV1 = vi.fn().mockResolvedValue({
      ...createBaseResponse(),
      zipBase64: null,
    });
    const client = {
      runtimeDiagnosticsExportV1,
    } as unknown as RuntimeClient;

    const result = await exportRuntimeDiagnosticsWithFallback(client, {
      includeZipBase64: false,
    });

    expect(runtimeDiagnosticsExportV1).toHaveBeenCalledWith({
      workspaceId: null,
      redactionLevel: "strict",
      includeTaskSummaries: false,
      includeEventTail: true,
      includeZipBase64: false,
    });
    expect(result).not.toBeNull();
    expect(result?.zipBase64).toBeNull();
  });
});
