/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubPullRequest, GitHubPullRequestComment } from "../../../types";
import { getExportedStyleBlock, readRelativeSource } from "../../../test/styleSource";
import { GitDiffViewer } from "./GitDiffViewer";

class WorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  terminate() {}
}

Object.defineProperty(globalThis, "Worker", {
  value: WorkerStub,
  configurable: true,
});

afterEach(() => {
  cleanup();
});

const pullRequest: GitHubPullRequest = {
  number: 42,
  title: "Polish design-system button migrations",
  url: "https://github.com/example/repo/pull/42",
  updatedAt: "2026-03-14T02:00:00.000Z",
  createdAt: "2026-03-13T18:00:00.000Z",
  body: "Refines the remaining low-risk app migration surfaces.",
  headRefName: "feat/button-migration",
  baseRefName: "main",
  isDraft: false,
  author: { login: "han" },
};

const comments: GitHubPullRequestComment[] = [
  {
    id: 1,
    body: "Oldest comment",
    createdAt: "2026-03-13T18:10:00.000Z",
    url: "#1",
    author: { login: "a" },
  },
  {
    id: 2,
    body: "Second comment",
    createdAt: "2026-03-13T18:20:00.000Z",
    url: "#2",
    author: { login: "b" },
  },
  {
    id: 3,
    body: "Third comment",
    createdAt: "2026-03-13T18:30:00.000Z",
    url: "#3",
    author: { login: "c" },
  },
  {
    id: 4,
    body: "Newest comment",
    createdAt: "2026-03-13T18:40:00.000Z",
    url: "#4",
    author: { login: "d" },
  },
];

describe("GitDiffViewer", () => {
  it("uses non-submit pull-request timeline buttons and toggles comment visibility", () => {
    render(
      <GitDiffViewer
        diffs={[]}
        selectedPath={null}
        isLoading={false}
        error={null}
        pullRequest={pullRequest}
        pullRequestComments={comments}
      />
    );

    const showAllButton = screen.getByRole("button", { name: "Show all" });
    expect((showAllButton as HTMLButtonElement).type).toBe("button");
    expect(screen.queryByText("Oldest comment")).toBeNull();

    fireEvent.click(showAllButton);
    expect(screen.getByText("Oldest comment")).toBeTruthy();

    const collapseButton = screen.getByRole("button", { name: "Collapse" });
    expect((collapseButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(collapseButton);
    expect(screen.queryByText("Oldest comment")).toBeNull();
  });

  it("exposes review follow-up actions from the pull-request timeline", () => {
    const onStartTaskFromGitHubPullRequestReviewFollowUp = vi.fn();

    render(
      <GitDiffViewer
        diffs={[]}
        selectedPath={null}
        isLoading={false}
        error={null}
        pullRequest={pullRequest}
        pullRequestComments={comments}
        onStartTaskFromGitHubPullRequestReviewFollowUp={
          onStartTaskFromGitHubPullRequestReviewFollowUp
        }
      />
    );

    const followUpButtons = screen.getAllByRole("button", { name: "Follow up" });
    fireEvent.click(followUpButtons[0] as HTMLButtonElement);

    expect(onStartTaskFromGitHubPullRequestReviewFollowUp).toHaveBeenCalledWith(
      pullRequest,
      comments[1]
    );
  });

  it("surfaces repository-unavailable guidance when no git root is selected", () => {
    render(
      <GitDiffViewer
        diffs={[]}
        selectedPath={null}
        isLoading={false}
        error={null}
        hasRepositoryContext={false}
      />
    );

    expect(screen.getByText("Repository not selected")).toBeTruthy();
    expect(
      screen.getByText(
        "Choose a repository-backed workspace or Git root before inspecting diff output."
      )
    ).toBeTruthy();
  });

  it("surfaces scope badges for staged diff entries", () => {
    render(
      <GitDiffViewer
        diffs={[
          { path: "src/shared.ts", status: "M", diff: "staged diff", scope: "staged" },
          { path: "src/shared.ts", status: "M", diff: "unstaged diff", scope: "unstaged" },
        ]}
        selectedPath="src/shared.ts"
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText("Staged")).toBeTruthy();
  });

  it("keeps the refresh indicator in flow instead of absolutely covering the first diff row", () => {
    const source = readRelativeSource(import.meta.dirname, "GitDiffViewer.styles.css.ts");
    const loadingRule = getExportedStyleBlock(source, "loading");
    const overlayRule = getExportedStyleBlock(source, "loadingOverlay");

    expect(loadingRule).toContain('alignSelf: "flex-end"');
    expect(loadingRule).toContain('margin: "0 12px 10px auto"');
    expect(overlayRule).toContain('position: "sticky"');
    expect(overlayRule).not.toContain('position: "absolute"');
  });
});
