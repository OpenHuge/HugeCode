// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormattedDebugEntries } from "../test/debugDiagnosticsFixtures";
import {
  createDebugPanelBodyProps,
  createPopulatedDebugPanelBodyProps,
} from "../test/debugPanelComponentFixtures";
import { DebugPanelBody } from "./DebugPanelBody";

const formattedEntries = createFormattedDebugEntries();

function createProbeProps() {
  return {
    isRuntimeProbeBusy: false,
    runtimeProbeBusyLabel: null,
    runtimeProbeError: null,
    runtimeProbeResult: null,
    liveSkillId: "core-bash",
    liveSkillInput: "pwd",
    liveSkillPath: ".",
    liveSkillQuery: "",
    liveSkillMaxDepth: "2",
    liveSkillMaxResults: "10",
    liveSkillIncludeHidden: false,
    isCoreTreeSkillSelected: false,
    onLiveSkillIdChange: vi.fn(),
    onLiveSkillInputChange: vi.fn(),
    onLiveSkillPathChange: vi.fn(),
    onLiveSkillQueryChange: vi.fn(),
    onLiveSkillMaxDepthChange: vi.fn(),
    onLiveSkillMaxResultsChange: vi.fn(),
    onLiveSkillIncludeHiddenChange: vi.fn(),
    onRunHealthProbe: vi.fn(),
    onRunRemoteStatusProbe: vi.fn(),
    onRunTerminalStatusProbe: vi.fn(),
    onRunSettingsProbe: vi.fn(),
    onRunBootstrapProbe: vi.fn(),
    onRunLiveSkillProbe: vi.fn(),
  };
}

describe("DebugPanelBody", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders summary, event channel, probe, and entries content when open", () => {
    render(<DebugPanelBody {...createPopulatedDebugPanelBodyProps({ ...createProbeProps() })} />);

    expect(screen.getByTestId("debug-distributed-diagnostics")).toBeTruthy();
    expect(screen.getByTestId("debug-agent-task-durability-diagnostics")).toBeTruthy();
    expect(screen.getByTestId("debug-event-channel-diagnostics")).toBeTruthy();
    expect(screen.getByTestId("debug-runtime-probes")).toBeTruthy();
    expect(screen.getByText("runtime.updated")).toBeTruthy();
  });

  it("does not render entries list when closed", () => {
    render(
      <DebugPanelBody
        {...createDebugPanelBodyProps({
          ...createProbeProps(),
          isOpen: false,
          observabilityCapabilityEnabled: false,
          distributedDiagnostics: null,
          hasRemoteExecutionDiagnostics: false,
          agentTaskDurabilityDiagnostics: null,
          eventChannelDiagnostics: [],
          runtimeEventBridgePath: "legacy",
          formattedEntries,
        })}
      />
    );

    expect(screen.queryByText("runtime.updated")).toBeNull();
    expect(screen.getByTestId("debug-event-channel-diagnostics")).toBeTruthy();
    expect(screen.getByTestId("debug-runtime-probes")).toBeTruthy();
  });
});
