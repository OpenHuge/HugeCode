// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { usePlanReadyActions } from "./usePlanReadyActions";

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace One",
  path: "/tmp/workspace-one",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("usePlanReadyActions", () => {
  it("sends only the minimal collaboration mode identity for plan follow-up changes", async () => {
    const sendUserMessageToThread = vi.fn(async () => undefined);
    const setSelectedCollaborationModeId = vi.fn();

    const { result } = renderHook(() =>
      usePlanReadyActions({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        collaborationModes: [
          {
            id: "plan",
            label: "Plan",
            mode: "plan",
            model: "gpt-5.4",
            reasoningEffort: "low",
            developerInstructions: "Return a full plan first.",
            value: {},
          },
        ],
        connectWorkspace: vi.fn(async () => undefined),
        sendUserMessageToThread,
        setSelectedCollaborationModeId,
      })
    );

    await act(async () => {
      await result.current.handlePlanSubmitChanges("Add rollback checkpoints");
    });

    expect(setSelectedCollaborationModeId).toHaveBeenCalledWith("plan");
    expect(sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-1",
      expect.any(String),
      [],
      {
        collaborationMode: {
          mode: "plan",
          settings: {
            id: "plan",
          },
        },
      }
    );
  });
});
