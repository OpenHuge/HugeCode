// @vitest-environment jsdom

import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebugEntryDiagnostics } from "../hooks/useDebugEntryDiagnostics";
import {
  createDebugDiagnosticsEntries,
  createFormattedDebugEntries,
  createRuntimeEventChannelDiagnostics,
  createRuntimeToolLifecycleEvent,
} from "../test/debugDiagnosticsFixtures";
import { createDebugPanelBodyProps } from "../test/debugPanelComponentFixtures";
import { DebugPanelBody } from "./DebugPanelBody";

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

describe("DebugPanelBody integration", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders hook-produced diagnostics through summary and event sections", () => {
    const entries = createDebugDiagnosticsEntries();
    const { result } = renderHook(() => useDebugEntryDiagnostics(entries, true, true));

    render(
      <DebugPanelBody
        {...createDebugPanelBodyProps({
          ...createProbeProps(),
          isOpen: true,
          observabilityCapabilityEnabled: true,
          distributedDiagnostics: result.current.distributedDiagnostics,
          hasRemoteExecutionDiagnostics: result.current.hasRemoteExecutionDiagnostics,
          agentTaskDurabilityDiagnostics: result.current.agentTaskDurabilityDiagnostics,
          eventChannelDiagnostics: createRuntimeEventChannelDiagnostics(),
          runtimeToolLifecycleHookCheckpoints: [],
          runtimeToolLifecycleEvents: [createRuntimeToolLifecycleEvent()],
          runtimeEventBridgePath: "v2",
          formattedEntries: createFormattedDebugEntries(),
        })}
      />
    );

    expect(screen.getByText("Distributed Diagnostics")).toBeTruthy();
    expect(screen.getByText("Agent Task Durability")).toBeTruthy();
    expect(screen.getByText("Event channels")).toBeTruthy();
    expect(screen.getByText("policy_rejected_local_access")).toBeTruthy();
    expect(screen.getByText("agent_task_durability_degraded")).toBeTruthy();
    expect(screen.getByText("runtime event path: v2")).toBeTruthy();
    expect(screen.getByText("runtime bridge")).toBeTruthy();
    expect(screen.getByText("tool/started")).toBeTruthy();
  });

  it("keeps durability diagnostics when hook disables distributed diagnostics", () => {
    const entries = createDebugDiagnosticsEntries();
    const { result } = renderHook(() => useDebugEntryDiagnostics(entries, false, true));

    render(
      <DebugPanelBody
        {...createDebugPanelBodyProps({
          ...createProbeProps(),
          isOpen: true,
          observabilityCapabilityEnabled: false,
          distributedDiagnostics: result.current.distributedDiagnostics,
          hasRemoteExecutionDiagnostics: result.current.hasRemoteExecutionDiagnostics,
          agentTaskDurabilityDiagnostics: result.current.agentTaskDurabilityDiagnostics,
          eventChannelDiagnostics: [],
          runtimeToolLifecycleHookCheckpoints: [],
          runtimeToolLifecycleEvents: [],
          runtimeEventBridgePath: "legacy",
          formattedEntries: createFormattedDebugEntries(),
        })}
      />
    );

    expect(screen.queryByText("Distributed Diagnostics")).toBeNull();
    expect(screen.getByText("Agent Task Durability")).toBeTruthy();
    expect(screen.getByText("agent_task_durability_degraded")).toBeTruthy();
  });
});
