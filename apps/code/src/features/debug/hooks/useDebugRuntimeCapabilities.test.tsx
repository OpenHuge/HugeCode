// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeCapabilitiesSummary } from "../../../application/runtime/ports/runtime";
import { useDebugRuntimeCapabilities } from "./useDebugRuntimeCapabilities";

vi.mock("../../../application/runtime/ports/runtime", () => ({
  getRuntimeCapabilitiesSummary: vi.fn(),
}));

const getRuntimeCapabilitiesSummaryMock = vi.mocked(getRuntimeCapabilitiesSummary);

describe("useDebugRuntimeCapabilities", () => {
  beforeEach(() => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes diagnostics export and observability capability state", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_diagnostics_export_v1"],
      features: ["backend_placement_observability_v1"],
      wsEndpointPath: null,
      error: null,
    });

    const { result } = renderHook(() => useDebugRuntimeCapabilities());

    await waitFor(() => {
      expect(result.current.diagnosticsExportCapabilityResolved).toBe(true);
    });

    expect(result.current.diagnosticsExportSupported).toBe(true);
    expect(result.current.observabilityCapabilityEnabled).toBe(true);
  });

  it("supports diagnostics export when feature flag is present", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [],
      features: ["runtime_diagnostics_export_v1"],
      wsEndpointPath: null,
      error: null,
    });

    const { result } = renderHook(() => useDebugRuntimeCapabilities());

    await waitFor(() => {
      expect(result.current.diagnosticsExportCapabilityResolved).toBe(true);
    });

    expect(result.current.diagnosticsExportSupported).toBe(true);
    expect(result.current.observabilityCapabilityEnabled).toBe(false);
  });

  it("falls back to resolved unsupported state when capability fetch fails", async () => {
    getRuntimeCapabilitiesSummaryMock.mockRejectedValue(new Error("capability fetch failed"));

    const { result } = renderHook(() => useDebugRuntimeCapabilities());

    await waitFor(() => {
      expect(result.current.diagnosticsExportCapabilityResolved).toBe(true);
    });

    expect(result.current.diagnosticsExportSupported).toBe(false);
    expect(result.current.observabilityCapabilityEnabled).toBe(false);
  });
});
