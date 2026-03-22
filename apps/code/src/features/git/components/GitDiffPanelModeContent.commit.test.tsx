/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitDiffModeContent } from "./GitDiffPanelModeContent";

afterEach(() => {
  cleanup();
});

describe("GitDiffModeContent commit message section", () => {
  it("renders the shared textarea and generate icon button", () => {
    const onCommitMessageChange = vi.fn();
    const onGenerateCommitMessage = vi.fn();

    render(
      <GitDiffModeContent
        error={null}
        showGitRootPanel={false}
        gitRootScanLoading={false}
        gitRootScanDepth={2}
        hasGitRoot
        gitRootScanError={null}
        gitRootScanHasScanned={false}
        gitRootCandidates={[]}
        gitRoot="/repo"
        showGenerateCommitMessage
        commitMessage=""
        onCommitMessageChange={onCommitMessageChange}
        commitMessageLoading={false}
        canGenerateCommitMessage
        onGenerateCommitMessage={onGenerateCommitMessage}
        stagedFiles={[]}
        unstagedFiles={[]}
        commitLoading={false}
        commitsAhead={0}
        commitsBehind={0}
        pullLoading={false}
        pushLoading={false}
        syncLoading={false}
        selectedFiles={new Set()}
        selectedPath={null}
        onFileClick={() => {}}
        onShowFileMenu={() => {}}
        onDiffListClick={() => {}}
      />
    );

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "feat: add shared badge" } });
    expect(onCommitMessageChange).toHaveBeenCalledWith("feat: add shared badge");

    const generateButton = screen.getByRole("button", { name: "Generate commit message" });
    expect((generateButton as HTMLButtonElement).type).toBe("button");
    fireEvent.click(generateButton);
    expect(onGenerateCommitMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps repository chooser actions on explicit button semantics", () => {
    const onScanGitRoots = vi.fn();
    const onPickGitRoot = vi.fn(async () => undefined);
    const onClearGitRoot = vi.fn();

    render(
      <GitDiffModeContent
        error={null}
        showGitRootPanel
        onScanGitRoots={onScanGitRoots}
        gitRootScanLoading={false}
        gitRootScanDepth={2}
        hasGitRoot
        onClearGitRoot={onClearGitRoot}
        gitRootScanError={null}
        gitRootScanHasScanned={false}
        gitRootCandidates={[]}
        gitRoot="/repo"
        onPickGitRoot={onPickGitRoot}
        showGenerateCommitMessage={false}
        commitMessage=""
        commitMessageLoading={false}
        canGenerateCommitMessage={false}
        stagedFiles={[]}
        unstagedFiles={[]}
        commitLoading={false}
        commitsAhead={0}
        commitsBehind={0}
        pullLoading={false}
        pushLoading={false}
        syncLoading={false}
        selectedFiles={new Set()}
        selectedPath={null}
        onFileClick={() => {}}
        onShowFileMenu={() => {}}
        onDiffListClick={() => {}}
      />
    );

    const scanButton = screen.getByRole("button", { name: "Scan workspace" });
    const pickButton = screen.getByRole("button", { name: "Pick folder" });
    const clearButton = screen.getByRole("button", { name: "Use workspace root" });

    expect((scanButton as HTMLButtonElement).type).toBe("button");
    expect((pickButton as HTMLButtonElement).type).toBe("button");
    expect((clearButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(scanButton);
    fireEvent.click(pickButton);
    fireEvent.click(clearButton);

    expect(onScanGitRoots).toHaveBeenCalledTimes(1);
    expect(onPickGitRoot).toHaveBeenCalledTimes(1);
    expect(onClearGitRoot).toHaveBeenCalledTimes(1);
  });
});
