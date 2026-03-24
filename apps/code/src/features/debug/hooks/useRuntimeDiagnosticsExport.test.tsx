// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeDiagnosticsExportV1 } from "../../../application/runtime/ports/tauriRuntime";
import {
  filterRuntimeToolLifecycleSnapshot,
  getRuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import { useRuntimeDiagnosticsExport } from "./useRuntimeDiagnosticsExport";

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  runtimeDiagnosticsExportV1: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeToolLifecycle", () => ({
  filterRuntimeToolLifecycleSnapshot: vi.fn(
    (
      snapshot: {
        recentEvents: Array<{ workspaceId: string | null }>;
        lastEvent: { workspaceId: string | null } | null;
        revision: number;
      },
      workspaceId: string | null
    ) => {
      const recentEvents = snapshot.recentEvents.filter(
        (event) => !workspaceId || event.workspaceId === workspaceId
      );
      const lastEvent =
        snapshot.lastEvent && (!workspaceId || snapshot.lastEvent.workspaceId === workspaceId)
          ? snapshot.lastEvent
          : (recentEvents.at(-1) ?? null);
      return {
        revision: snapshot.revision,
        lastEvent,
        recentEvents,
      };
    }
  ),
  getRuntimeToolLifecycleSnapshot: vi.fn(),
  runtimeToolLifecycleEventMatchesWorkspace: vi.fn(
    (event: { workspaceId: string | null }, workspaceId: string | null) =>
      !workspaceId || event.workspaceId === workspaceId
  ),
}));

const filterRuntimeToolLifecycleSnapshotMock = vi.mocked(filterRuntimeToolLifecycleSnapshot);
const runtimeDiagnosticsExportV1Mock = vi.mocked(runtimeDiagnosticsExportV1);
const getRuntimeToolLifecycleSnapshotMock = vi.mocked(getRuntimeToolLifecycleSnapshot);

describe("useRuntimeDiagnosticsExport", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    getRuntimeToolLifecycleSnapshotMock.mockReturnValue({
      revision: 1,
      lastEvent: {
        id: "tool-started-1",
        kind: "tool",
        phase: "started",
        source: "app-event",
        workspaceId: "workspace-debug-meta",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        status: "in_progress",
        at: 1_770_000_000_000,
        errorCode: null,
      },
      recentEvents: [],
    });
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

  it("exports metadata as a downloadable JSON artifact with lifecycle context", async () => {
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
    const createObjectUrlMock = vi.fn(() => "blob:runtime-diagnostics-metadata");
    const revokeObjectUrlMock = vi.fn();
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
    expect(getRuntimeToolLifecycleSnapshotMock).toHaveBeenCalledTimes(1);
    expect(filterRuntimeToolLifecycleSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 1 }),
      "workspace-debug-meta"
    );
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    const metadataBlob = createObjectUrlMock.mock.calls[0]?.[0];
    expect(metadataBlob).toBeInstanceOf(Blob);
    await expect(metadataBlob.text()).resolves.toContain(
      '"schemaVersion": "runtime-diagnostics-export/v1"'
    );
    await expect(metadataBlob.text()).resolves.toContain('"lifecycle"');
    await expect(metadataBlob.text()).resolves.toContain('"tool-started-1"');
    expect(result.current.diagnosticsExportStatus).toContain(
      "Exported runtime-diagnostics.metadata.json"
    );
    expect(result.current.diagnosticsExportStatus).toContain("1 lifecycle events");
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
