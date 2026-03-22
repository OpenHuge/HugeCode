/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTreePanel } from "./FileTreePanel";

afterEach(() => {
  cleanup();
});

describe("FileTreePanel", () => {
  it("switches the header status badge when toggling modified-only mode", () => {
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace-1"
        files={["src/app.ts", "README.md"]}
        modifiedFiles={["src/app.ts"]}
        isLoading={false}
        filePanelMode="tree"
        onFilePanelModeChange={vi.fn()}
        canInsertText={true}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
      />
    );

    expect(screen.getByText("2 files")).toBeTruthy();
    expect(screen.getByText("2 files").getAttribute("data-status-tone")).toBe("default");

    fireEvent.click(screen.getByRole("button", { name: "Show modified files only" }));

    const modifiedBadge = screen.getByText("1 modified");
    expect(modifiedBadge).toBeTruthy();
    expect(modifiedBadge.getAttribute("data-status-tone")).toBe("progress");
  });

  it("shows the shared empty state copy when no files are available", () => {
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace-1"
        files={[]}
        modifiedFiles={[]}
        isLoading={false}
        filePanelMode="tree"
        onFilePanelModeChange={vi.fn()}
        canInsertText={true}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
      />
    );

    expect(screen.getByText("No files available")).toBeTruthy();
    expect(
      screen.getByText("Open a folder or repository-backed workspace to browse files here.")
    ).toBeTruthy();
  });
});
