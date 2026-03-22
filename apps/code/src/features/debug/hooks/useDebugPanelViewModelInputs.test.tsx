// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const useDebugRuntimeProbeMock = vi.mocked(useDebugRuntimeProbe);
const useFormattedDebugEntriesMock = vi.mocked(useFormattedDebugEntries);
const useRuntimeDiagnosticsExportMock = vi.mocked(useRuntimeDiagnosticsExport);

describe("useDebugPanelViewModelInputs", () => {
  beforeEach(() => {
    useDebugRuntimeCapabilitiesMock.mockReturnValue(createDebugRuntimeCapabilitiesState());
    useRuntimeDiagnosticsExportMock.mockReturnValue(createRuntimeDiagnosticsExportState());
    useDebugRuntimeEventChannelsMock.mockReturnValue(createDebugRuntimeEventChannelsState());
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
      runtimeProbe,
      entryDiagnostics,
    } = builderParams;

    useDebugRuntimeCapabilitiesMock.mockReturnValue(runtimeCapabilities);
    useRuntimeDiagnosticsExportMock.mockReturnValue(diagnosticsExport);
    useDebugRuntimeEventChannelsMock.mockReturnValue(runtimeEventChannels);
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

    expect(useFormattedDebugEntriesMock).toHaveBeenCalledWith(entries, false);
    expect(useDebugEntryDiagnosticsMock).toHaveBeenCalledWith(entries, true, false);
  });
});
