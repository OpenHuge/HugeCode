// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DebugRuntimeProbeFeedback } from "./DebugRuntimeProbeFeedback";

describe("DebugRuntimeProbeFeedback", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders status, error, and result independently", () => {
    render(
      <DebugRuntimeProbeFeedback
        runtimeProbeBusyLabel="health"
        runtimeProbeError="probe failed"
        runtimeProbeResult='{"ok":true}'
      />
    );

    expect(screen.getByTestId("debug-runtime-probe-status").textContent).toContain(
      "Running health..."
    );
    expect(screen.getByTestId("debug-runtime-probe-error").textContent).toBe("probe failed");
    expect(screen.getByTestId("debug-runtime-probe-result").textContent).toContain('"ok"');
  });

  it("renders nothing when there is no probe output", () => {
    const { container } = render(
      <DebugRuntimeProbeFeedback
        runtimeProbeBusyLabel={null}
        runtimeProbeError={null}
        runtimeProbeResult={null}
      />
    );

    expect(container.textContent).toBe("");
  });
});
