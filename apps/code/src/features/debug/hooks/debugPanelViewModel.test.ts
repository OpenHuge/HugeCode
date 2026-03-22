// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createDebugPanelViewModelBuilderParams,
  createDebugRuntimeCapabilitiesState,
  createRuntimeDiagnosticsExportState,
} from "../test/debugPanelHookFixtures";
import { createDebugPanelViewModel, isDebugPanelVisible } from "./debugPanelViewModel";

describe("isDebugPanelVisible", () => {
  it("keeps full panels visible and dock panels gated by open state", () => {
    expect(isDebugPanelVisible({ isOpen: false, variant: "full" })).toBe(true);
    expect(isDebugPanelVisible({ isOpen: true, variant: "dock" })).toBe(true);
    expect(isDebugPanelVisible({ isOpen: false, variant: "dock" })).toBe(false);
  });
});

describe("createDebugPanelViewModel", () => {
  it("maps composed state into shell and body props", () => {
    const exportDiagnostics = vi.fn();
    const onClear = vi.fn();
    const onCopy = vi.fn();
    const onResizeStart = vi.fn();

    const result = createDebugPanelViewModel(
      createDebugPanelViewModelBuilderParams({
        onClear,
        onCopy,
        onResizeStart,
        runtimeCapabilities: createDebugRuntimeCapabilitiesState({
          observabilityCapabilityEnabled: true,
          diagnosticsExportCapabilityResolved: true,
          diagnosticsExportSupported: true,
        }),
        diagnosticsExport: createRuntimeDiagnosticsExportState({
          diagnosticsExportBusy: true,
          diagnosticsExportError: "failed",
          diagnosticsExportStatus: "metadata ready",
          exportDiagnostics,
        }),
      })
    );

    expect(result.isVisible).toBe(true);
    expect(result.shellProps.variant).toBe("dock");
    expect(result.shellProps.onClear).toBe(onClear);
    expect(result.shellProps.onCopy).toBe(onCopy);
    expect(result.shellProps.onResizeStart).toBe(onResizeStart);
    expect(result.shellProps.diagnosticsExportBusy).toBe(true);
    expect(result.shellProps.diagnosticsExportError).toBe("failed");
    expect(result.bodyProps.isOpen).toBe(true);
    expect(result.bodyProps.observabilityCapabilityEnabled).toBe(true);
    expect(result.bodyProps.formattedEntries).toEqual([]);

    result.shellProps.onExportDiagnostics("metadata");

    expect(exportDiagnostics).toHaveBeenCalledWith("metadata");
  });

  it("keeps dock panels hidden when closed and full panels visible", () => {
    const hiddenDock = createDebugPanelViewModel(
      createDebugPanelViewModelBuilderParams({ isOpen: false, variant: "dock" })
    );
    const visibleFull = createDebugPanelViewModel(
      createDebugPanelViewModelBuilderParams({ isOpen: false, variant: "full" })
    );

    expect(hiddenDock.isVisible).toBe(false);
    expect(visibleFull.isVisible).toBe(true);
  });
});
