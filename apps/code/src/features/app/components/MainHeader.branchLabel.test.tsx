/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { formatHeaderBranchLabel } from "../utils/headerBranchLabel";
import { MainHeader } from "./MainHeader";

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Project Alpha",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("formatHeaderBranchLabel", () => {
  it("keeps short branch names unchanged", () => {
    expect(formatHeaderBranchLabel("main")).toBe("main");
  });

  it("preserves the branch prefix and tail semantics for two-segment branches", () => {
    const label = formatHeaderBranchLabel(
      "feature/optimize-header-branch-display-overflow-protection"
    );

    expect(label.startsWith("feature/")).toBe(true);
    expect(label.endsWith("protection")).toBe(true);
    expect(label.includes("…")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(32);
  });

  it("keeps the first two semantic segments when they still fit", () => {
    const label = formatHeaderBranchLabel("feature/header/optimize-branch-display-overflow");

    expect(label.startsWith("feature/header/")).toBe(true);
    expect(label.endsWith("overflow")).toBe(true);
    expect(label.includes("…")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(32);
  });

  it("collapses deep branch paths before truncating the important tail segment", () => {
    const label = formatHeaderBranchLabel(
      "feature/header/worktree/optimize-branch-display-overflow-protection"
    );

    expect(label.startsWith("feature/header/")).toBe(true);
    expect(label.includes("/…/")).toBe(true);
    expect(label.endsWith("tection")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(32);
  });
});

describe("MainHeader branch label", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the full branch name in the accessible name and tooltip while compressing the visible label", () => {
    const branchName = "feature/header/worktree/optimize-branch-display-overflow-protection";

    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName={branchName}
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
      />
    );

    const branchButton = screen.getByRole("button", { name: branchName });
    expect(branchButton.getAttribute("title")).toBe(branchName);
    expect(branchButton.textContent).toContain("feature/header");
    expect(branchButton.textContent).toContain("tection");
    expect(branchButton.textContent).not.toContain(branchName);
  });
});
