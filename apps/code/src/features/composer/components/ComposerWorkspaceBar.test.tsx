/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readRelativeSource } from "../../../test/styleSource";
import { ComposerWorkspaceBar } from "./ComposerWorkspaceBar";

vi.mock("../../git/hooks/useGitBranches", () => ({
  useGitBranches: () => ({
    branches: [
      { name: "main", current: true, lastCommit: 1 },
      { name: "feature/free-figma", current: false, lastCommit: 2 },
    ],
  }),
}));

describe("ComposerWorkspaceBar", () => {
  it("keeps the branch dropdown shell calmer than the older glossy floating menu", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerBranchDropdown.css.ts");

    expect(source).not.toContain(
      '"var(--ds-elevation-2), inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)"'
    );
  });

  it("keeps the workspace status rail compact instead of floating with oversized gaps", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerWorkspaceBar.css.ts");
    const accessSource = readRelativeSource(
      import.meta.dirname,
      "ComposerAccessDropdown.styles.css.ts"
    );

    expect(source).toContain('padding: "2px 10px 0"');
    expect(source).toContain("export const workspaceRail = style({");
    expect(source).toContain('borderRadius: "999px"');
    expect(source).toContain('padding: "1px"');
    expect(source).toContain('overflow: "hidden"');
    expect(source).toContain(
      'borderLeft: "1px solid color-mix(in srgb, var(--ds-border-subtle) 64%, transparent)"'
    );
    expect(accessSource).toContain('minHeight: "26px"');
    expect(accessSource).toContain('gap: "4px"');
    expect(accessSource).toContain("grouped: {");
    expect(accessSource).toContain('borderRadius: "0"');
    expect(accessSource).toContain('background: "transparent"');
    expect(accessSource).toContain('cursor: "pointer"');
  });

  it("opens the branch workflow as a dropdown and submits selections from it", async () => {
    const onSelectGitWorkflowSelection = vi.fn();
    const workspace = {
      id: "workspace-1",
      name: "Workspace 1",
      path: "/tmp/workspace-1",
      connected: true,
      kind: "main" as const,
    };

    render(
      <ComposerWorkspaceBar
        controls={{
          mode: "worktree",
          branchLabel: "feature/free-figma",
          currentBranch: "feature/free-figma",
          branchTriggerLabel: "feature/free-figma",
          repositoryWorkspace: workspace,
          activeWorkspace: workspace,
          workspaces: [workspace],
          onSelectGitWorkflowSelection,
        }}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
      />
    );

    expect(document.querySelector('[data-composer-workspace-footer="true"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agent access" })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Branch & worktree" });
    expect((button as HTMLButtonElement).type).toBe("button");

    fireEvent.click(button);
    expect(screen.getByRole("textbox", { name: "Search branches or pull requests" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "feature/free-figma" }));
    await waitFor(() => {
      expect(onSelectGitWorkflowSelection).toHaveBeenCalledWith({
        kind: "branch",
        mode: "worktree",
        branch: "feature/free-figma",
        worktreeWorkspace: null,
      });
    });
  });
});
