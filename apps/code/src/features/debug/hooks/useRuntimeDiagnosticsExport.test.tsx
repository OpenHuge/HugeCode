// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeDiagnosticsExportV1 } from "../../../application/runtime/ports/tauriRuntime";
import { useRuntimeDiagnosticsExport } from "./useRuntimeDiagnosticsExport";

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  runtimeDiagnosticsExportV1: vi.fn(),
}));

const runtimeDiagnosticsExportV1Mock = vi.mocked(runtimeDiagnosticsExportV1);

describe("useRuntimeDiagnosticsExport", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    runtimeDiagnosticsExportV1Mock.mockResolvedValue({
      schemaVersion: "runtime-diagnostics-export/v1",
      exportedAt: 1_770_000_000_000,
      source: "runtime-service",
      redactionLevel: "strict",
      filename: "runtime-diagnostics.zip",
      mimeType: "application/zip",
      sizeBytes: 123,
      zipBase64: "UEsDBAoAAAAAA",
      sections: ["manifest.json", "runtime/health.json"],
      warnings: [],
      redactionStats: {
        redactedKeys: 1,
        redactedValues: 2,
        hashedPaths: 3,
        hashedEmails: 4,
        hashedSecrets: 5,
      },
    });
  });

  it("downloads full diagnostics export and reports completion state", async () => {
    const createObjectUrlMock = vi.fn(() => "blob:runtime-diagnostics");
    const revokeObjectUrlMock = vi.fn();
    vi.stubGlobal(
      "atob",
      vi.fn(() => "PK")
    );
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useRuntimeDiagnosticsExport({ workspaceId: "workspace-debug-1" })
    );

    await act(async () => {
      await result.current.exportDiagnostics("full");
    });

    await waitFor(() => {
      expect(runtimeDiagnosticsExportV1Mock).toHaveBeenCalledWith({
        workspaceId: "workspace-debug-1",
        redactionLevel: "strict",
        includeTaskSummaries: false,
        includeEventTail: true,
        includeZipBase64: true,
      });
    });
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.diagnosticsExportStatus).toContain("Exported runtime-diagnostics.zip");
    expect(result.current.diagnosticsExportError).toBeNull();
    expect(result.current.diagnosticsExportBusy).toBe(false);

    anchorClickSpy.mockRestore();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("exports metadata without triggering zip download", async () => {
    runtimeDiagnosticsExportV1Mock.mockResolvedValue({
      schemaVersion: "runtime-diagnostics-export/v1",
      exportedAt: 1_770_000_000_100,
      source: "runtime-service",
      redactionLevel: "strict",
      filename: "runtime-diagnostics.zip",
      mimeType: "application/zip",
      sizeBytes: 0,
      zipBase64: null,
      sections: ["manifest.json", "runtime/health.json"],
      warnings: [],
      redactionStats: {
        redactedKeys: 0,
        redactedValues: 0,
        hashedPaths: 0,
        hashedEmails: 0,
        hashedSecrets: 0,
      },
    });
    const createObjectUrlMock = vi.fn(() => "blob:runtime-diagnostics");
    const originalCreateObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });

    const { result } = renderHook(() =>
      useRuntimeDiagnosticsExport({ workspaceId: "workspace-debug-meta" })
    );

    await act(async () => {
      await result.current.exportDiagnostics("metadata");
    });

    await waitFor(() => {
      expect(runtimeDiagnosticsExportV1Mock).toHaveBeenCalledWith({
        workspaceId: "workspace-debug-meta",
        redactionLevel: "strict",
        includeTaskSummaries: false,
        includeEventTail: true,
        includeZipBase64: false,
      });
    });
    expect(createObjectUrlMock).not.toHaveBeenCalled();
    expect(result.current.diagnosticsExportStatus).toContain("Exported diagnostics metadata");
    expect(result.current.diagnosticsExportError).toBeNull();
    expect(result.current.diagnosticsExportBusy).toBe(false);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  });

  it("surfaces unsupported-runtime errors without setting success state", async () => {
    runtimeDiagnosticsExportV1Mock.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useRuntimeDiagnosticsExport({ workspaceId: "workspace-debug-unsupported" })
    );

    await act(async () => {
      await result.current.exportDiagnostics("full");
    });

    expect(result.current.diagnosticsExportStatus).toBeNull();
    expect(result.current.diagnosticsExportError).toBe(
      "Runtime does not support diagnostics export v1."
    );
    expect(result.current.diagnosticsExportBusy).toBe(false);
  });
});
