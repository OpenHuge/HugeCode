// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeToolLifecycleEvent } from "../test/debugDiagnosticsFixtures";
import { DebugRuntimeToolLifecycleSection } from "./DebugRuntimeToolLifecycleSection";

describe("DebugRuntimeToolLifecycleSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders lifecycle cards when lifecycle events are available", () => {
    render(
      <DebugRuntimeToolLifecycleSection
        lifecycleEvents={[
          createRuntimeToolLifecycleEvent(),
          createRuntimeToolLifecycleEvent({
            id: "guardrail-1",
            kind: "guardrail",
            phase: "evaluated",
            source: "telemetry",
            status: "blocked",
            toolCallId: null,
          }),
        ]}
      />
    );

    expect(screen.getByTestId("debug-runtime-tool-lifecycle")).toBeTruthy();
    expect(screen.getByText("tool/started")).toBeTruthy();
    expect(screen.getByText("guardrail/evaluated")).toBeTruthy();
    expect(screen.getAllByText("bash").length).toBeGreaterThan(0);
  });

  it("renders an empty state when no lifecycle events exist", () => {
    render(<DebugRuntimeToolLifecycleSection lifecycleEvents={[]} />);

    expect(screen.getByText("No lifecycle activity observed yet.")).toBeTruthy();
  });
});
