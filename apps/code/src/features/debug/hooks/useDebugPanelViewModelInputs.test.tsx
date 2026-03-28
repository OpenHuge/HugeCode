// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRuntimeToolLifecyclePresentationSummary } from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  createDebugEntryDiagnosticsState,
  createDebugPanelViewModelBuilderParams,
  createDebugRuntimeCapabilitiesState,
  createDebugRuntimeEventChannelsState,
  createDebugRuntimeProbeState,
  createRuntimeDiagnosticsExportState,
} from "../test/debugPanelHookFixtures";
import { useDebugEntryDiagnostics } from "./useDebugEntryDiagnostics";
import { useDebugPanelViewModelInputs } from "./useDebugPanelViewModelInputs";
import { useDebugRuntimeCapabilities } from "./useDebugRuntimeCapabilities";
import { useDebugRuntimeEventChannels } from "./useDebugRuntimeEventChannels";
import { useDebugRuntimeToolExecutionMetrics } from "./useDebugRuntimeToolExecutionMetrics";
import { useDebugRuntimeToolLifecycle } from "./useDebugRuntimeToolLifecycle";
import { useDebugRuntimeProbe } from "./useDebugRuntimeProbe";
import { useFormattedDebugEntries } from "./useFormattedDebugEntries";
import { useRuntimeDiagnosticsExport } from "./useRuntimeDiagnosticsExport";

vi.mock("./useDebugEntryDiagnostics", () => ({
  useDebugEntryDiagnostics: vi.fn(),
}));

vi.mock("./useDebugRuntimeCapabilities", () => ({
  useDebugRuntimeCapabilities: vi.fn(),
}));

vi.mock("./useDebugRuntimeEventChannels", () => ({
  useDebugRuntimeEventChannels: vi.fn(),
}));

vi.mock("./useDebugRuntimeToolLifecycle", () => ({
  useDebugRuntimeToolLifecycle: vi.fn(),
}));

vi.mock("./useDebugRuntimeToolExecutionMetrics", () => ({
  useDebugRuntimeToolExecutionMetrics: vi.fn(),
}));

vi.mock("./useDebugRuntimeProbe", () => ({
  useDebugRuntimeProbe: vi.fn(),
}));

vi.mock("./useFormattedDebugEntries", () => ({
  useFormattedDebugEntries: vi.fn(),
}));

vi.mock("./useRuntimeDiagnosticsExport", () => ({
  useRuntimeDiagnosticsExport: vi.fn(),
}));

const useDebugEntryDiagnosticsMock = vi.mocked(useDebugEntryDiagnostics);
const useDebugRuntimeCapabilitiesMock = vi.mocked(useDebugRuntimeCapabilities);
const useDebugRuntimeEventChannelsMock = vi.mocked(useDebugRuntimeEventChannels);
const useDebugRuntimeToolExecutionMetricsMock = vi.mocked(useDebugRuntimeToolExecutionMetrics);
const useDebugRuntimeToolLifecycleMock = vi.mocked(useDebugRuntimeToolLifecycle);
const useDebugRuntimeProbeMock = vi.mocked(useDebugRuntimeProbe);
const useFormattedDebugEntriesMock = vi.mocked(useFormattedDebugEntries);
const useRuntimeDiagnosticsExportMock = vi.mocked(useRuntimeDiagnosticsExport);

describe("useDebugPanelViewModelInputs", () => {
  beforeEach(() => {
    useDebugRuntimeCapabilitiesMock.mockReturnValue(createDebugRuntimeCapabilitiesState());
    useRuntimeDiagnosticsExportMock.mockReturnValue(createRuntimeDiagnosticsExportState());
    useDebugRuntimeEventChannelsMock.mockReturnValue(createDebugRuntimeEventChannelsState());
    useDebugRuntimeToolExecutionMetricsMock.mockReturnValue({
      updatedAt: 0,
      totals: {
        attemptedTotal: 0,
        startedTotal: 0,
        completedTotal: 0,
        successTotal: 0,
        validationFailedTotal: 0,
        runtimeFailedTotal: 0,
        timeoutTotal: 0,
        blockedTotal: 0,
        truncatedTotal: 0,
      },
      recentExecutions: [],
    });
    useDebugRuntimeToolLifecycleMock.mockReturnValue({
      summary: buildRuntimeToolLifecyclePresentationSummary({
        lifecycleEvents: [],
        hookCheckpoints: [],
      }),
      revision: 0,
      lastHookCheckpoint: null,
      lastEvent: null,
      hookCheckpoints: [],
      lifecycleEvents: [],
      sessionCheckpointBaseline: {
        schemaVersion: "runtime-session-checkpoint-baseline/v1",
        workspaceId: "workspace-1",
        lifecycleRevision: 0,
        projectionSource: "runtime_tool_lifecycle",
        sessions: [],
      },
      sessionCheckpointSummary: {
        hasSessions: false,
        latestHookCheckpointKey: null,
        latestLifecycleEventId: null,
        latestSession: null,
        latestSessionLabel: null,
        totalCheckpointPayloads: 0,
        totalRecords: 0,
        totalSessions: 0,
      },
    });
    useDebugRuntimeProbeMock.mockReturnValue(createDebugRuntimeProbeState());
    useFormattedDebugEntriesMock.mockReturnValue([]);
    useDebugEntryDiagnosticsMock.mockReturnValue(createDebugEntryDiagnosticsState());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("collects hook state into builder-ready inputs", () => {
    const builderParams = createDebugPanelViewModelBuilderParams();
    const {
      entries,
      isOpen,
      workspaceId,
      onClear,
      onCopy,
      onResizeStart,
      variant,
      runtimeCapabilities,
      diagnosticsExport,
      runtimeEventChannels,
      runtimeToolExecutionMetrics,
      runtimeToolLifecycle,
      runtimeProbe,
      entryDiagnostics,
    } = builderParams;

    useDebugRuntimeCapabilitiesMock.mockReturnValue(runtimeCapabilities);
    useRuntimeDiagnosticsExportMock.mockReturnValue(diagnosticsExport);
    useDebugRuntimeEventChannelsMock.mockReturnValue(runtimeEventChannels);
    useDebugRuntimeToolExecutionMetricsMock.mockReturnValue(runtimeToolExecutionMetrics);
    useDebugRuntimeToolLifecycleMock.mockReturnValue(runtimeToolLifecycle);
    useDebugRuntimeProbeMock.mockReturnValue(runtimeProbe);
    useFormattedDebugEntriesMock.mockReturnValue([]);
    useDebugEntryDiagnosticsMock.mockReturnValue(entryDiagnostics);

    const { result } = renderHook(() =>
      useDebugPanelViewModelInputs({
        entries,
        isOpen,
        workspaceId,
        onClear,
        onCopy,
        onResizeStart,
        variant,
      })
    );

    expect(useRuntimeDiagnosticsExportMock).toHaveBeenCalledWith({ workspaceId: "workspace-1" });
    expect(useDebugRuntimeToolLifecycleMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      enabled: true,
    });
    expect(useDebugRuntimeToolExecutionMetricsMock).toHaveBeenCalledWith({
      enabled: true,
    });
    expect(useDebugRuntimeProbeMock).toHaveBeenCalledWith({ workspaceId: "workspace-1" });
    expect(useFormattedDebugEntriesMock).toHaveBeenCalledWith(entries, true);
    expect(useDebugEntryDiagnosticsMock).toHaveBeenCalledWith(entries, true, true);
    expect(result.current).toEqual({
      ...builderParams,
      formattedEntries: [],
    });
  });

  it("uses visibility for formatting and observability for diagnostics", () => {
    const { entries } = createDebugPanelViewModelBuilderParams();

    useDebugRuntimeCapabilitiesMock.mockReturnValue(
      createDebugRuntimeCapabilitiesState({ observabilityCapabilityEnabled: false })
    );

    renderHook(() =>
      useDebugPanelViewModelInputs({
        entries,
        isOpen: false,
        workspaceId: null,
        onClear: vi.fn(),
        onCopy: vi.fn(),
        variant: "full",
      })
    );

    expect(useDebugRuntimeToolLifecycleMock).toHaveBeenCalledWith({
      workspaceId: null,
      enabled: true,
    });
    expect(useDebugRuntimeToolExecutionMetricsMock).toHaveBeenCalledWith({
      enabled: true,
    });
    expect(useDebugRuntimeProbeMock).toHaveBeenCalledWith({ workspaceId: null });
    expect(useFormattedDebugEntriesMock).toHaveBeenCalledWith(entries, true);
    expect(useDebugEntryDiagnosticsMock).toHaveBeenCalledWith(entries, false, true);
  });

  it("disables formatting and diagnostics work when the dock panel is hidden", () => {
    const { entries } = createDebugPanelViewModelBuilderParams();

    useDebugRuntimeCapabilitiesMock.mockReturnValue(
      createDebugRuntimeCapabilitiesState({ observabilityCapabilityEnabled: true })
    );

    renderHook(() =>
      useDebugPanelViewModelInputs({
        entries,
        isOpen: false,
        workspaceId: null,
        onClear: vi.fn(),
        onCopy: vi.fn(),
        variant: "dock",
      })
    );

    expect(useDebugRuntimeToolLifecycleMock).toHaveBeenCalledWith({
      workspaceId: null,
      enabled: false,
    });
    expect(useDebugRuntimeToolExecutionMetricsMock).toHaveBeenCalledWith({
      enabled: false,
    });
    expect(useDebugRuntimeProbeMock).toHaveBeenCalledWith({ workspaceId: null });
    expect(useFormattedDebugEntriesMock).toHaveBeenCalledWith(entries, false);
    expect(useDebugEntryDiagnosticsMock).toHaveBeenCalledWith(entries, true, false);
  });
});
