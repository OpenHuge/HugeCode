// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { WorkspaceCard } from "./WorkspaceCard";

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Alpha Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

afterEach(() => {
  cleanup();
});

describe("WorkspaceCard", () => {
  it("uses the workspace row click to toggle thread visibility without selecting the workspace", () => {
    const onToggleWorkspaceCollapse = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        isActive={true}
        isCollapsed={false}
        addMenuOpen={false}
        addMenuWidth={200}
        onShowWorkspaceMenu={vi.fn()}
        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
        onConnectWorkspace={vi.fn()}
        onAddAgent={vi.fn()}
        onToggleAddMenu={vi.fn()}
      >
        <div>Thread content</div>
      </WorkspaceCard>
    );

    fireEvent.click(screen.getByRole("treeitem", { name: /alpha workspace/i }));

    expect(onToggleWorkspaceCollapse).toHaveBeenCalledWith("ws-1", true);
    expect(
      screen.getByRole("treeitem", { name: /alpha workspace/i }).getAttribute("aria-expanded")
    ).toBe("false");
    expect(
      screen
        .getByText("Thread content")
        .closest(".workspace-card-content")
        ?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("opens the add menu from a right click on the add button without creating a thread", () => {
    const onToggleAddMenu = vi.fn();
    const onAddAgent = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        isActive={true}
        isCollapsed={false}
        addMenuOpen={false}
        addMenuWidth={200}
        onShowWorkspaceMenu={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
        onConnectWorkspace={vi.fn()}
        onAddAgent={onAddAgent}
        onToggleAddMenu={onToggleAddMenu}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "New agent" }));

    expect(onAddAgent).not.toHaveBeenCalled();
    expect(onToggleAddMenu).toHaveBeenCalledTimes(1);
    expect(onToggleAddMenu.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: "ws-1",
      width: 200,
    });
  });
});
