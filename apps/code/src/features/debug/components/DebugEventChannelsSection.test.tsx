// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeEventChannelDiagnostics } from "../test/debugDiagnosticsFixtures";
import { DebugEventChannelsSection } from "./DebugEventChannelsSection";

const populatedChannels = createRuntimeEventChannelDiagnostics();

describe("DebugEventChannelsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders runtime event path and empty state when no channels are available", () => {
    render(
      <DebugEventChannelsSection eventChannelDiagnostics={[]} runtimeEventBridgePath="legacy" />
    );

    expect(screen.getByTestId("debug-runtime-event-bridge-path").textContent).toContain(
      "runtime event path: legacy"
    );
    expect(screen.getByText("No channel diagnostics available yet.")).toBeTruthy();
  });

  it("renders channel diagnostics fields when channels are available", () => {
    render(
      <DebugEventChannelsSection
        eventChannelDiagnostics={populatedChannels}
        runtimeEventBridgePath="v2"
      />
    );

    const diagnostics = screen.getByTestId("debug-event-channel-diagnostics");
    expect(within(diagnostics).getByText("runtime bridge")).toBeTruthy();
    expect(within(diagnostics).getByText("server events")).toBeTruthy();
    expect(within(diagnostics).getByText("bridge")).toBeTruthy();
    expect(within(diagnostics).getByText("sse")).toBeTruthy();
    expect(within(diagnostics).getByText("connection lost")).toBeTruthy();
    expect(within(diagnostics).getByText("network")).toBeTruthy();
    expect(screen.queryByText("No channel diagnostics available yet.")).toBeNull();
  });

  it("preserves channel field order in each diagnostics card", () => {
    const { container } = render(
      <DebugEventChannelsSection
        eventChannelDiagnostics={populatedChannels}
        runtimeEventBridgePath="v2"
      />
    );

    const channelCards = container.querySelectorAll(".debug-event-channel-diagnostics-item");
    const firstCardTerms = Array.from(channelCards[0]?.querySelectorAll("dt") ?? []).map(
      (node) => node.textContent
    );

    expect(firstCardTerms).toEqual([
      "status",
      "transport",
      "retry_attempt",
      "retry_delay_ms",
      "last_error",
      "fallback_since_ms",
      "consecutive_failures",
      "last_transition_reason",
    ]);
  });
});
