// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo, WorkspaceSettings } from "../../../../types";
import { SettingsProjectsSection } from "./SettingsProjectsSection";

function createWorkspaceSettings(): WorkspaceSettings {
  return {
    sidebarCollapsed: false,
    sortOrder: null,
    groupId: null,
    gitRoot: null,
    codexHome: null,
    codexArgs: null,
    launchScript: null,
    launchScripts: null,
    worktreeSetupScript: null,
  };
}

function createWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: "workspace-1",
    name: "Project Alpha",
    path: "/tmp/project-alpha",
    connected: true,
    codex_bin: null,
    kind: "main",
    parentId: null,
    worktree: null,
    settings: createWorkspaceSettings(),
    ...overrides,
  };
}

function createProps(workspaces: WorkspaceInfo[]) {
  return {
    workspaceGroups: [],
    groupedWorkspaces: [{ id: null, name: "Ungrouped", workspaces }],
    ungroupedLabel: "Ungrouped",
    groupDrafts: {},
    newGroupName: "",
    groupError: null,
    projects: workspaces,
    canCreateGroup: false,
    onSetNewGroupName: vi.fn(),
    onSetGroupDrafts: vi.fn(),
    onCreateGroup: vi.fn().mockResolvedValue(undefined),
    onRenameGroup: vi.fn().mockResolvedValue(undefined),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteGroup: vi.fn().mockResolvedValue(undefined),
    onChooseGroupCopiesFolder: vi.fn().mockResolvedValue(undefined),
    onClearGroupCopiesFolder: vi.fn().mockResolvedValue(undefined),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
  } as const;
}

describe("SettingsProjectsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renames a main workspace via callback", async () => {
    const workspace = createWorkspace();
    const props = createProps([workspace]);
    const onRenameWorkspace = vi.fn().mockResolvedValue(true);
    const promptSpy = vi.spyOn(globalThis, "prompt").mockReturnValue("Project Beta");

    const { container } = render(
      <SettingsProjectsSection {...props} onRenameWorkspace={onRenameWorkspace} />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Groups", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Projects", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(promptSpy).toHaveBeenCalledWith("Project name", "Project Alpha");
    await waitFor(() => {
      expect(onRenameWorkspace).toHaveBeenCalledWith("workspace-1", "Project Beta");
    });
    promptSpy.mockRestore();
  });

  it("disables rename for worktree entries", () => {
    const workspace = createWorkspace({
      id: "worktree-1",
      kind: "worktree",
      name: "feature/worktree",
      worktree: { branch: "feature/worktree" },
    });
    const props = createProps([workspace]);
    const onRenameWorkspace = vi.fn().mockResolvedValue(true);

    const { container } = render(
      <SettingsProjectsSection {...props} onRenameWorkspace={onRenameWorkspace} />
    );

    expect(container.querySelector('[data-settings-field-group="true"]')).toBeTruthy();

    expect((screen.getByRole("button", { name: "Rename" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
