// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTimelinePanelsState } from "./useTimelinePanelsState";

describe("useTimelinePanelsState", () => {
  it("builds timeline follow-up descriptors for the active thread and workspace", () => {
    const { result } = renderHook(() =>
      useTimelinePanelsState({
        threadId: "thread-1",
        workspaceId: "ws-1",
        items: [
          {
            id: "plan-1",
            kind: "tool",
            toolType: "plan",
            title: "Plan",
            detail: "Generated plan",
            status: "completed",
            output: "# Plan ready\n- Step 1\n- Step 2",
          },
        ],
        isThinking: false,
        currentTurnTerminalItemId: "plan-1",
        visibleTimelineItemIds: ["plan-1"],
        approvals: [
          {
            request_id: "approval-1",
            workspace_id: "ws-1",
            method: "approval",
            params: {
              thread_id: "thread-1",
              command: ["pnpm", "validate"],
              reason: "Need approval",
            },
          },
        ],
        toolCallRequests: [
          {
            request_id: "tool-1",
            workspace_id: "ws-1",
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              call_id: "plan-1",
              tool: "open",
              arguments: {},
            },
          },
        ],
        userInputRequests: [
          {
            request_id: "input-1",
            workspace_id: "ws-1",
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              item_id: "plan-1",
              questions: [
                {
                  id: "choice",
                  header: "Choice",
                  question: "Pick one",
                },
              ],
            },
          },
        ],
        onApprovalDecision: () => undefined,
        onUserInputSubmit: () => undefined,
        onToolCallSubmit: () => undefined,
        onPlanAccept: () => undefined,
        onPlanSubmitChanges: () => undefined,
      })
    );

    expect(result.current.timelinePanels.map((panel) => panel.kind)).toEqual([
      "approval",
      "tool_call_request",
      "user_input_request",
    ]);
    expect(result.current.planFollowup.shouldShow).toBe(false);
  });

  it("keeps approval panels inline when approval params use camelCase threadId", () => {
    const { result } = renderHook(() =>
      useTimelinePanelsState({
        threadId: "thread-1",
        workspaceId: "ws-1",
        items: [],
        isThinking: false,
        currentTurnTerminalItemId: null,
        visibleTimelineItemIds: [],
        approvals: [
          {
            request_id: "approval-camel",
            workspace_id: "ws-1",
            method: "runtime/requestApproval/shell",
            params: {
              threadId: "thread-1",
              command: "pnpm validate:fast",
            },
          },
        ],
        onApprovalDecision: () => undefined,
      })
    );

    expect(result.current.timelineApprovals.map((request) => request.request_id)).toEqual([
      "approval-camel",
    ]);
    expect(result.current.timelinePanels.map((panel) => panel.kind)).toEqual(["approval"]);
  });

  it("tracks expansion, tool-group collapse, and plan follow-up dismissal", () => {
    const { result } = renderHook(() =>
      useTimelinePanelsState({
        threadId: "thread-1",
        workspaceId: "ws-1",
        items: [
          {
            id: "plan-1",
            kind: "tool",
            toolType: "plan",
            title: "Plan",
            detail: "Generated plan",
            status: "completed",
            output: "Plan body",
          },
        ],
        isThinking: false,
        currentTurnTerminalItemId: "plan-1",
        visibleTimelineItemIds: ["plan-1"],
        onPlanAccept: () => undefined,
        onPlanSubmitChanges: () => undefined,
      })
    );

    act(() => {
      result.current.toggleExpanded("tool-1");
      result.current.toggleToolGroup("group-1");
      result.current.dismissPlanFollowup("plan-1");
    });

    expect(result.current.expandedItems.has("tool-1")).toBe(true);
    expect(result.current.collapsedToolGroups.has("group-1")).toBe(true);
    expect(result.current.planFollowup.shouldShow).toBe(false);
  });
});
