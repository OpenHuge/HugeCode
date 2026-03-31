/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { MainHeader } from "./MainHeader";

vi.mock("@desktop-host/opener", () => ({
  revealItemInDir: vi.fn(async () => undefined),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

vi.mock("../../git/hooks/useGitBranches", () => ({
  useGitBranches: () => ({
    branches: [{ name: "main", lastCommit: 1 }],
    error: null,
    refreshBranches: vi.fn(async () => undefined),
    checkoutBranch: vi.fn(async () => undefined),
    createBranch: vi.fn(async () => undefined),
  }),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Project Alpha",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("MainHeader lazy branch menu", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the branch menu only after the branch button opens it", async () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="main"
        canManageBranches={true}
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
      />
    );

    expect(screen.queryByPlaceholderText("Search or create branch")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "main" }));

    expect(await screen.findByPlaceholderText("Search or create branch")).toBeTruthy();
  });
});
