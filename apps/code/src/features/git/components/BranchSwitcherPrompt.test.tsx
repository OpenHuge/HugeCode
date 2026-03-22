/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchInfo, WorkspaceInfo } from "../../../types";
import { BranchSwitcherPrompt } from "./BranchSwitcherPrompt";

const baseSettings: WorkspaceInfo["settings"] = {
  sidebarCollapsed: false,
};

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: vi.fn(),
  writable: true,
});

function createWorkspace(
  overrides: Partial<WorkspaceInfo> & Pick<WorkspaceInfo, "id" | "name" | "path">
): WorkspaceInfo {
  return {
    id: overrides.id,
    name: overrides.name,
    path: overrides.path,
    connected: overrides.connected ?? true,
    kind: overrides.kind ?? "main",
    parentId: overrides.parentId ?? null,
    worktree: overrides.worktree ?? null,
    settings: overrides.settings ?? baseSettings,
  };
}

const branches: BranchInfo[] = [
  {
    name: "develop",
    lastCommit: 0,
    current: false,
    isDefault: false,
    isRemote: false,
    remoteName: null,
    worktreePath: null,
  },
];

describe("BranchSwitcherPrompt", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits a worktree branch selection for worktrees in the active repo", () => {
    const activeMain = createWorkspace({
      id: "main-a",
      name: "Repo A",
      path: "/tmp/repo-a",
      kind: "main",
    });
    const matchingWorktree = createWorkspace({
      id: "wt-a-develop",
      name: "A develop",
      path: "/tmp/repo-a-develop",
      kind: "worktree",
      parentId: "main-a",
      worktree: { branch: "develop" },
    });
    const unrelatedWorktree = createWorkspace({
      id: "wt-b-develop",
      name: "B develop",
      path: "/tmp/repo-b-develop",
      kind: "worktree",
      parentId: "main-b",
      worktree: { branch: "develop" },
    });
    const onSubmit = vi.fn();

    render(
      <BranchSwitcherPrompt
        branches={branches}
        workspaces={[activeMain, matchingWorktree, unrelatedWorktree]}
        activeWorkspace={activeMain}
        currentBranch={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Worktree" }));
    fireEvent.click(screen.getByRole("button", { name: /develop/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: "branch",
      mode: "worktree",
      branch: "develop",
      worktreeWorkspace: matchingWorktree,
    });
  });

  it("submits pull request references from the search field", () => {
    const onSubmit = vi.fn();

    render(
      <BranchSwitcherPrompt
        branches={branches}
        workspaces={[createWorkspace({ id: "main-a", name: "Repo A", path: "/tmp/repo-a" })]}
        activeWorkspace={createWorkspace({ id: "main-a", name: "Repo A", path: "/tmp/repo-a" })}
        currentBranch={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search branches or pull requests" }), {
      target: { value: "#42" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search branches or pull requests" }), {
      key: "Enter",
    });

    expect(onSubmit).toHaveBeenCalledWith({
      kind: "pull-request",
      mode: "local",
      reference: "#42",
    });
  });
});
