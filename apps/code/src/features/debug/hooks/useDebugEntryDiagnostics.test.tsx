// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createDebugDiagnosticsEntries,
  createDistributedDiagnosticsEntry,
  createDurabilityDiagnosticsEntry,
} from "../test/debugDiagnosticsFixtures";
import { useDebugEntryDiagnostics } from "./useDebugEntryDiagnostics";

describe("useDebugEntryDiagnostics", () => {
  it("includes distributed diagnostics when observability is enabled", () => {
    const { result } = renderHook(() =>
      useDebugEntryDiagnostics([createDistributedDiagnosticsEntry()], true, true)
    );

    expect(result.current.distributedDiagnostics?.backendsTotal).toBe(4);
    expect(result.current.distributedDiagnostics?.stateFabricFanoutQueueDepth).toBe(1);
    expect(result.current.distributedDiagnostics?.reason).toBe("policy_rejected_local_access");
    expect(result.current.hasRemoteExecutionDiagnostics).toBe(true);
  });

  it("does not let durability entries override distributed diagnostics when both are present", () => {
    const { result } = renderHook(() =>
      useDebugEntryDiagnostics(createDebugDiagnosticsEntries(), true, true)
    );

    expect(result.current.distributedDiagnostics?.reason).toBe("policy_rejected_local_access");
    expect(result.current.agentTaskDurabilityDiagnostics?.reason).toBe(
      "agent_task_durability_degraded"
    );
  });

  it("keeps durability diagnostics when distributed diagnostics are disabled", () => {
    const { result } = renderHook(() =>
      useDebugEntryDiagnostics(
        [createDistributedDiagnosticsEntry(), createDurabilityDiagnosticsEntry()],
        false,
        true
      )
    );

    expect(result.current.distributedDiagnostics).toBeNull();
    expect(result.current.agentTaskDurabilityDiagnostics?.reason).toBe(
      "agent_task_durability_degraded"
    );
  });

  it("reuses the previous diagnostics snapshot when the panel becomes hidden", () => {
    const { result, rerender } = renderHook(
      ({
        entries,
        observabilityCapabilityEnabled,
        isVisible,
      }: {
        entries: ReturnType<typeof createDebugDiagnosticsEntries>;
        observabilityCapabilityEnabled: boolean;
        isVisible: boolean;
      }) => useDebugEntryDiagnostics(entries, observabilityCapabilityEnabled, isVisible),
      {
        initialProps: {
          entries: createDebugDiagnosticsEntries(),
          observabilityCapabilityEnabled: true,
          isVisible: true,
        },
      }
    );

    expect(result.current.distributedDiagnostics?.reason).toBe("policy_rejected_local_access");

    rerender({
      entries: [],
      observabilityCapabilityEnabled: false,
      isVisible: false,
    });

    expect(result.current.distributedDiagnostics?.reason).toBe("policy_rejected_local_access");
    expect(result.current.agentTaskDurabilityDiagnostics?.reason).toBe(
      "agent_task_durability_degraded"
    );
  });

  it("reuses the previous diagnostics snapshot for equivalent visible entries", () => {
    const firstEntries = createDebugDiagnosticsEntries();
    const nextEntries = [...firstEntries];

    const { result, rerender } = renderHook(
      ({ entries }: { entries: ReturnType<typeof createDebugDiagnosticsEntries> }) =>
        useDebugEntryDiagnostics(entries, true, true),
      {
        initialProps: {
          entries: firstEntries,
        },
      }
    );

    const firstSnapshot = result.current;

    rerender({
      entries: nextEntries,
    });

    expect(result.current).toBe(firstSnapshot);
  });

  it("recomputes diagnostics when observability changes for the same entries", () => {
    const entries = createDebugDiagnosticsEntries();

    const { result, rerender } = renderHook(
      ({ observabilityCapabilityEnabled }: { observabilityCapabilityEnabled: boolean }) =>
        useDebugEntryDiagnostics(entries, observabilityCapabilityEnabled, true),
      {
        initialProps: {
          observabilityCapabilityEnabled: true,
        },
      }
    );

    const firstSnapshot = result.current;

    rerender({
      observabilityCapabilityEnabled: false,
    });

    expect(result.current).not.toBe(firstSnapshot);
    expect(result.current.distributedDiagnostics).toBeNull();
  });
});
