// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeHealth,
  runRuntimeLiveSkill,
} from "../../../application/runtime/ports/tauriRuntime";
import { useDebugRuntimeProbe } from "./useDebugRuntimeProbe";

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  getRuntimeBootstrapSnapshot: vi.fn(),
  getRuntimeHealth: vi.fn(),
  getRuntimeRemoteStatus: vi.fn(),
  getRuntimeSettings: vi.fn(),
  getRuntimeTerminalStatus: vi.fn(),
  runRuntimeLiveSkill: vi.fn(),
}));

const getRuntimeHealthMock = vi.mocked(getRuntimeHealth);
const runRuntimeLiveSkillMock = vi.mocked(runRuntimeLiveSkill);

describe("useDebugRuntimeProbe", () => {
  beforeEach(() => {
    getRuntimeHealthMock.mockResolvedValue({ status: "ok", app: "code", version: "1.0.0" });
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
