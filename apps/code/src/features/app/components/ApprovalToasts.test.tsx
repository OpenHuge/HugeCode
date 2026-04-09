// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import type { ApprovalRequest, WorkspaceInfo } from "../../../types";
import { ApprovalToasts } from "./ApprovalToasts";

const workspaces: WorkspaceInfo[] = [
  {
    id: "workspace-1",
    name: "Workspace One",
    path: "/tmp/workspace-1",
    connected: true,
    settings: { sidebarCollapsed: false },
  },
];

const approvals: ApprovalRequest[] = [
  {
    workspace_id: "workspace-1",
    request_id: 1,
    method: "runtime/requestApproval/shell",
    params: { command: "echo one" },
  },
  {
    workspace_id: "workspace-1",
    request_id: 2,
    method: "runtime/requestApproval/shell",
    params: { command: "echo two" },
  },
];

describe("ApprovalToasts", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders live-region semantics and handles Enter on primary request", () => {
    const onDecision = vi.fn();
    const onOpenThread = vi.fn();
    render(
      <ApprovalToasts
        approvals={approvals}
        workspaces={workspaces}
        onDecision={onDecision}
        onOpenThread={onOpenThread}
      />
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-live")).toBe("assertive");
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByText("shell")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Open thread" })).toBeNull();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onDecision).toHaveBeenCalledWith(approvals[1], "accept");
  });

  it("does not submit when an input is focused", () => {
    const onDecision = vi.fn();
    render(
      <ApprovalToasts approvals={approvals} workspaces={workspaces} onDecision={onDecision} />
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onDecision).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("opens the action center when the approval is mapped to mission detail", () => {
    const onDecision = vi.fn();
    const onOpenThread = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const missionTarget: MissionNavigationTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-123",
      runId: "run-123",
      reviewPackId: null,
      threadId: "thread-123",
      limitation: null,
    };

    render(
      <ApprovalToasts
        approvals={[
          {
            workspace_id: "workspace-1",
            request_id: 3,
            method: "runtime/requestApproval/shell",
            params: { command: "echo three", thread_id: "thread-123" },
          },
        ]}
        workspaces={workspaces}
        onDecision={onDecision}
        onOpenThread={onOpenThread}
        onOpenMissionTarget={onOpenMissionTarget}
        resolveMissionTarget={() => missionTarget}
      />
    );

    expect(screen.getAllByText("thread-123")).toHaveLength(1);
    expect(screen.getByText("Approval waiting in action center")).toBeTruthy();
    expect(
      screen.getByText(
        "Open action center to inspect approval context, recovery options, and the next operator action in one place."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open action center" }));
    expect(onOpenMissionTarget).toHaveBeenCalledWith(missionTarget);
    expect(onOpenThread).not.toHaveBeenCalled();
  });

  it("labels review-routed approvals as review entrypoints", () => {
    const onDecision = vi.fn();
    const onOpenThread = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const missionTarget: MissionNavigationTarget = {
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-789",
      runId: "run-789",
      reviewPackId: "review-pack-789",
      limitation: "thread_unavailable",
    };

    render(
      <ApprovalToasts
        approvals={[
          {
            workspace_id: "workspace-1",
            request_id: 9,
            method: "runtime/requestApproval/shell",
            params: { command: "echo review", thread_id: "thread-789" },
          },
        ]}
        workspaces={workspaces}
        onDecision={onDecision}
        onOpenThread={onOpenThread}
        onOpenMissionTarget={onOpenMissionTarget}
        resolveMissionTarget={() => missionTarget}
      />
    );

    expect(screen.getByText("Approval waiting in review")).toBeTruthy();
    expect(
      screen.getByText(
        "Open review to inspect approval context, recovery options, and the next operator action in one place."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open review" }));
    expect(onOpenMissionTarget).toHaveBeenCalledWith(missionTarget);
    expect(onOpenThread).not.toHaveBeenCalled();
  });

  it("falls back to the thread when no action-center target is available", () => {
    const onDecision = vi.fn();
    const onOpenThread = vi.fn();

    render(
      <ApprovalToasts
        approvals={[
          {
            workspace_id: "workspace-1",
            request_id: 3,
            method: "runtime/requestApproval/shell",
            params: { command: "echo three", thread_id: "thread-123" },
          },
        ]}
        workspaces={workspaces}
        onDecision={onDecision}
        onOpenThread={onOpenThread}
      />
    );

    expect(screen.getByText("Approval waiting in thread")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open thread" }));
    expect(onOpenThread).toHaveBeenCalledWith("thread-123");
  });

  it("does not auto-approve when an action-center button is focused", () => {
    const onDecision = vi.fn();
    const onOpenThread = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const missionTarget: MissionNavigationTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-123",
      runId: "run-123",
      reviewPackId: null,
      threadId: "thread-123",
      limitation: null,
    };

    render(
      <ApprovalToasts
        approvals={[
          {
            workspace_id: "workspace-1",
            request_id: 3,
            method: "runtime/requestApproval/shell",
            params: { command: "echo three", thread_id: "thread-123" },
          },
        ]}
        workspaces={workspaces}
        onDecision={onDecision}
        onOpenThread={onOpenThread}
        onOpenMissionTarget={onOpenMissionTarget}
        resolveMissionTarget={() => missionTarget}
      />
    );

    const actionCenterButton = screen.getByRole("button", { name: "Open action center" });
    actionCenterButton.focus();
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onDecision).not.toHaveBeenCalled();
  });

  it("does not treat action-center-routed approval toasts as primary Enter handlers", () => {
    const onDecision = vi.fn();
    const onOpenThread = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const missionTarget: MissionNavigationTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-456",
      runId: "run-456",
      reviewPackId: null,
      threadId: "thread-456",
      limitation: null,
    };

    render(
      <ApprovalToasts
        approvals={[
          {
            workspace_id: "workspace-1",
            request_id: 7,
            method: "runtime/requestApproval/shell",
            params: { command: "echo thread-only", thread_id: "thread-456" },
          },
        ]}
        workspaces={workspaces}
        onDecision={onDecision}
        onOpenThread={onOpenThread}
        onOpenMissionTarget={onOpenMissionTarget}
        resolveMissionTarget={() => missionTarget}
      />
    );

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onDecision).not.toHaveBeenCalled();
  });

  it("disables the primary hotkey affordance when another surface owns approval", () => {
    const onDecision = vi.fn();

    render(
      <ApprovalToasts
        approvals={approvals}
        workspaces={workspaces}
        onDecision={onDecision}
        enablePrimaryHotkey={false}
      />
    );

    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onDecision).not.toHaveBeenCalled();
  });
});
