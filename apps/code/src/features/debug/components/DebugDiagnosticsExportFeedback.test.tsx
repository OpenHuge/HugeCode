// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebugDiagnosticsExportFeedback } from "./DebugDiagnosticsExportFeedback";

describe("DebugDiagnosticsExportFeedback", () => {
  it("renders hint, error, and status independently", () => {
    render(
      <DebugDiagnosticsExportFeedback
        diagnosticsExportCapabilityResolved
        diagnosticsExportSupported={false}
        diagnosticsExportError="export failed"
        diagnosticsExportStatus="metadata ready"
      />
    );

    expect(screen.getByTestId("debug-diagnostics-export-hint").textContent).toContain(
      "Runtime does not support diagnostics export v1."
    );
    expect(screen.getByTestId("debug-diagnostics-export-error").textContent).toBe("export failed");
    expect(screen.getByTestId("debug-diagnostics-export-status").textContent).toBe(
      "metadata ready"
    );
  });

  it("renders nothing when no feedback is available", () => {
    const { container } = render(
      <DebugDiagnosticsExportFeedback
        diagnosticsExportCapabilityResolved={false}
        diagnosticsExportSupported
        diagnosticsExportError={null}
        diagnosticsExportStatus={null}
      />
    );

    expect(container.textContent).toBe("");
  });
});
