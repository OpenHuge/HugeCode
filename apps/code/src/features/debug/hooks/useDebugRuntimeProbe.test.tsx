// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeHealth,
  runRuntimeLiveSkill,
} from "../../../application/runtime/ports/tauriRuntime";
import {
  filterRuntimeToolLifecycleSnapshot,
  getRuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import { useDebugRuntimeProbe } from "./useDebugRuntimeProbe";

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  getRuntimeBootstrapSnapshot: vi.fn(),
  getRuntimeHealth: vi.fn(),
  getRuntimeRemoteStatus: vi.fn(),
  getRuntimeSettings: vi.fn(),
  getRuntimeTerminalStatus: vi.fn(),
  runRuntimeLiveSkill: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeToolLifecycle", () => ({
  filterRuntimeToolLifecycleSnapshot: vi.fn(
    (
      snapshot: {
        recentEvents: Array<{ workspaceId: string | null }>;
        lastEvent: { workspaceId: string | null } | null;
        revision: number;
      },
      workspaceId: string | null
    ) => {
      const recentEvents = snapshot.recentEvents.filter(
        (event) => !workspaceId || event.workspaceId === workspaceId
      );
      const lastEvent =
        snapshot.lastEvent && (!workspaceId || snapshot.lastEvent.workspaceId === workspaceId)
          ? snapshot.lastEvent
          : (recentEvents.at(-1) ?? null);
      return {
        revision: snapshot.revision,
        lastEvent,
        recentEvents,
      };
    }
  ),
  getRuntimeToolLifecycleSnapshot: vi.fn(),
}));

const getRuntimeHealthMock = vi.mocked(getRuntimeHealth);
const filterRuntimeToolLifecycleSnapshotMock = vi.mocked(filterRuntimeToolLifecycleSnapshot);
const getRuntimeToolLifecycleSnapshotMock = vi.mocked(getRuntimeToolLifecycleSnapshot);
const runRuntimeLiveSkillMock = vi.mocked(runRuntimeLiveSkill);

describe("useDebugRuntimeProbe", () => {
  beforeEach(() => {
    getRuntimeHealthMock.mockResolvedValue({ status: "ok", app: "code", version: "1.0.0" });
    getRuntimeToolLifecycleSnapshotMock.mockReturnValue({
      revision: 2,
      lastEvent: {
        id: "tool-completed-1",
        kind: "tool",
        phase: "completed",
        source: "telemetry",
        workspaceId: "workspace-1",
        threadId: null,
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        status: "success",
        at: 1_770_000_000_000,
        errorCode: null,
      },
      recentEvents: [
        {
          id: "tool-completed-1",
          kind: "tool",
          phase: "completed",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: null,
          turnId: "turn-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          scope: "write",
          status: "success",
          at: 1_770_000_000_000,
          errorCode: null,
        },
        {
          id: "tool-completed-2",
          kind: "tool",
          phase: "completed",
          source: "telemetry",
          workspaceId: "workspace-2",
          threadId: null,
          turnId: "turn-2",
          toolCallId: "tool-call-2",
          toolName: "python",
          scope: "write",
          status: "success",
          at: 1_770_000_000_001,
          errorCode: null,
        },
      ],
    });
    runRuntimeLiveSkillMock.mockResolvedValue({
      runId: "run-1",
      skillId: "core-bash",
      status: "completed",
      message: "ok",
      output: "done",
      network: null,
      metadata: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs runtime health probe and formats the result", async () => {
    const { result } = renderHook(() => useDebugRuntimeProbe());

    await act(async () => {
      await result.current.runHealthProbe();
    });

    expect(getRuntimeHealthMock).toHaveBeenCalledTimes(1);
    expect(result.current.runtimeProbeError).toBeNull();
    expect(result.current.runtimeProbeBusyLabel).toBeNull();
    expect(result.current.runtimeProbeResult).toContain('"status": "ok"');
  });

  it("runs runtime lifecycle probe and formats the snapshot", async () => {
    const { result } = renderHook(() => useDebugRuntimeProbe({ workspaceId: "workspace-1" }));

    await act(async () => {
      await result.current.runToolLifecycleProbe();
    });

    expect(getRuntimeToolLifecycleSnapshotMock).toHaveBeenCalledTimes(1);
    expect(filterRuntimeToolLifecycleSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 2 }),
      "workspace-1"
    );
    expect(result.current.runtimeProbeError).toBeNull();
    expect(result.current.runtimeProbeBusyLabel).toBeNull();
    expect(result.current.runtimeProbeResult).toContain('"revision": 2');
    expect(result.current.runtimeProbeResult).toContain('"toolName": "bash"');
    expect(result.current.runtimeProbeResult).not.toContain('"toolName": "python"');
  });

  it("runs core-tree live skill with structured options", async () => {
    const { result } = renderHook(() => useDebugRuntimeProbe());

    act(() => {
      result.current.setLiveSkillId("core-tree");
      result.current.setLiveSkillInput(".");
      result.current.setLiveSkillPath("apps/code/src");
      result.current.setLiveSkillQuery("debug");
      result.current.setLiveSkillMaxDepth("3");
      result.current.setLiveSkillMaxResults("25");
      result.current.setLiveSkillIncludeHidden(true);
    });

    act(() => {
      result.current.runLiveSkillProbe();
    });

    await waitFor(() => {
      expect(runRuntimeLiveSkillMock).toHaveBeenCalledWith({
        skillId: "core-tree",
        input: ".",
        options: {
          path: "apps/code/src",
          query: "debug",
          maxDepth: 3,
          maxResults: 25,
          includeHidden: true,
        },
      });
    });
  });

  it("reports validation errors without invoking the live skill runtime", () => {
    const { result } = renderHook(() => useDebugRuntimeProbe());

    act(() => {
      result.current.setLiveSkillId("");
    });

    expect(result.current.liveSkillId).toBe("");
    act(() => {
      result.current.runLiveSkillProbe();
    });

    expect(runRuntimeLiveSkillMock).not.toHaveBeenCalled();
    expect(result.current.runtimeProbeError).toBe("Live skill id is required.");
  });
});
