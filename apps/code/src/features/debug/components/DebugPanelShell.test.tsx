// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugPanelShell } from "./DebugPanelShell";

describe("DebugPanelShell", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders shell layout, resizer, and composed content for dock mode", () => {
    const onResizeStart = vi.fn();
    const onExportDiagnostics = vi.fn();
    const onCopy = vi.fn();
    const onClear = vi.fn();

    render(
      <DebugPanelShell
        variant="dock"
        isOpen
        onResizeStart={onResizeStart}
        diagnosticsExportBusy={false}
        diagnosticsExportSupported
        onExportDiagnostics={onExportDiagnostics}
        onCopy={onCopy}
        onClear={onClear}
        diagnosticsExportCapabilityResolved
        diagnosticsExportError="export failed"
        diagnosticsExportStatus="metadata ready"
      >
        <div data-testid="debug-shell-child">body</div>
      </DebugPanelShell>
    );

    fireEvent.mouseDown(screen.getByLabelText("Resize debug panel"));
    fireEvent.click(screen.getByTestId("debug-diagnostics-export-button"));
    fireEvent.click(screen.getByText("Copy"));
    fireEvent.click(screen.getByText("Clear"));

    expect(screen.getByText("Debug")).toBeTruthy();
    expect(screen.getByTestId("debug-diagnostics-export-error").textContent).toBe("export failed");
    expect(screen.getByTestId("debug-diagnostics-export-status").textContent).toBe(
      "metadata ready"
    );
    expect(screen.getByTestId("debug-shell-child")).toBeTruthy();
    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(onExportDiagnostics).toHaveBeenCalledWith("full");
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("omits resizer in full mode", () => {
    render(
      <DebugPanelShell
        variant="full"
        isOpen
        diagnosticsExportBusy={false}
        diagnosticsExportSupported={false}
        onExportDiagnostics={vi.fn()}
        onCopy={vi.fn()}
        onClear={vi.fn()}
        diagnosticsExportCapabilityResolved={false}
        diagnosticsExportError={null}
        diagnosticsExportStatus={null}
      >
        <div>body</div>
      </DebugPanelShell>
    );

    expect(screen.queryByLabelText("Resize debug panel")).toBeNull();
  });
});
