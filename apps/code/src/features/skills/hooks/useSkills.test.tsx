// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useRuntimeInstructionSkillsFacade } from "../../../application/runtime/facades/runtimeInstructionSkillsFacade";
import { useSkills } from "./useSkills";

vi.mock("../../../application/runtime/facades/runtimeInstructionSkillsFacade", () => ({
  useRuntimeInstructionSkillsFacade: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace One",
  path: "/tmp/workspace-one",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useSkills", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates runtime skill state to the runtime facade", async () => {
    const refreshSkills = vi.fn(async () => undefined);
    vi.mocked(useRuntimeInstructionSkillsFacade).mockReturnValue({
      skills: [
        { name: "review", path: "/skills/review" },
        { name: "", path: "/skills/hidden" },
      ],
      refreshSkills,
    });

    const { result } = renderHook(() => useSkills({ activeWorkspace: workspace }));

    await waitFor(() => {
      expect(useRuntimeInstructionSkillsFacade).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        isConnected: true,
        onDebug: undefined,
      });
      expect(result.current.skills).toEqual([{ name: "review", path: "/skills/review" }]);
    });
  });

  it("refreshes skills when the window regains focus", async () => {
    const refreshSkills = vi.fn(async () => undefined);
    vi.mocked(useRuntimeInstructionSkillsFacade).mockReturnValue({
      skills: [{ name: "review", path: "/skills/review" }],
      refreshSkills,
    });

    renderHook(() => useSkills({ activeWorkspace: workspace }));

    act(() => {
      window.dispatchEvent(new FocusEvent("focus"));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    expect(refreshSkills).toHaveBeenCalled();
  });
});
