/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubIssue, GitHubPullRequest, GitLogEntry } from "../../../types";
import { fileManagerName } from "../../../utils/platformPaths";
import { GitDiffPanel } from "./GitDiffPanel";

const isDesktopHostRuntimeMock = vi.hoisted(() => vi.fn(() => true));
const menuNew = vi.hoisted(() => vi.fn(async ({ items }) => ({ popup: vi.fn(), items })));
const menuItemNew = vi.hoisted(() => vi.fn(async (options) => options));
const clipboardWriteText = vi.hoisted(() => vi.fn());
const openUrlMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@desktop-host/core", () => ({
  isDesktopHostRuntime: isDesktopHostRuntimeMock,
}));

vi.mock("@desktop-host/menu", () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
}));

vi.mock("@desktop-host/window", () => ({
  getCurrentWindow: () => ({ scaleFactor: () => 1 }),
}));

vi.mock("@desktop-host/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

const revealItemInDir = vi.hoisted(() => vi.fn());
const pushErrorToastMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  openUrl: openUrlMock,
  revealItemInDir,
}));

vi.mock("@desktop-host/dialogs", () => ({
  ask: vi.fn(async () => true),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: pushErrorToastMock,
}));

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: clipboardWriteText },
  configurable: true,
});

const logEntries: GitLogEntry[] = [];

const baseProps = {
  mode: "diff" as const,
  onModeChange: vi.fn(),
  filePanelMode: "git" as const,
  onFilePanelModeChange: vi.fn(),
  branchName: "main",
  totalAdditions: 0,
  totalDeletions: 0,
  fileStatus: "1 file changed",
  logEntries,
  stagedFiles: [],
  unstagedFiles: [],
};

const githubIssues: GitHubIssue[] = [
  {
    number: 42,
    title: "Stabilize source-linked delegation",
    url: "https://github.com/openai/hugecode/issues/42",
    updatedAt: "2026-03-18T12:00:00.000Z",
    body: "Use canonical taskSource for GitHub issue launches.",
    author: { login: "octocat" },
    labels: ["runtime", "mission-control"],
  },
];

const githubPullRequests: GitHubPullRequest[] = [
  {
    number: 7,
    title: "Add source-linked delegation MVP",
    url: "https://github.com/openai/hugecode/pull/7",
    updatedAt: "2026-03-18T12:00:00.000Z",
    createdAt: "2026-03-17T10:00:00.000Z",
    body: "Implements GitHub-linked Mission Control launches.",
    headRefName: "feat/source-linked-delegation",
    baseRefName: "main",
    isDraft: false,
    author: { login: "octocat" },
  },
];

describe("GitDiffPanel", () => {
  beforeEach(() => {
    isDesktopHostRuntimeMock.mockReturnValue(true);
    openUrlMock.mockClear();
    pushErrorToastMock.mockClear();
  });

  it("enables commit when message exists and only unstaged changes", { timeout: 10000 }, () => {
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        commitMessage="feat: add thing"
        onCommit={onCommit}
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const commitButton = screen.getByRole("button", { name: "Commit" });
    expect((commitButton as HTMLButtonElement).type).toBe("button");
    expect((commitButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(commitButton);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("keeps commit disabled without a message", () => {
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        commitMessage=""
        onCommit={onCommit}
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const commitButtons = screen.getAllByRole("button", { name: "Commit" }) as HTMLButtonElement[];
    const disabledCommitButton = commitButtons.find(
      (button) => button.title === "Enter a commit message"
    );
    expect(disabledCommitButton).toBeTruthy();
    if (!disabledCommitButton) {
      throw new Error("Expected disabled commit button for empty message");
    }
    expect(disabledCommitButton.disabled).toBe(true);
    fireEvent.click(disabledCommitButton);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("gates generate commit message button while loading", async () => {
    const onGenerateCommitMessage = vi.fn();
    const view = render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        commitMessage=""
        commitMessageLoading
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const loadingButtons = screen.getAllByRole("button", {
      name: "Generate commit message",
    }) as HTMLButtonElement[];
    expect(loadingButtons.length).toBeGreaterThan(0);
    const disabledLoadingButton = loadingButtons.find((button) => button.disabled);
    expect(disabledLoadingButton).toBeTruthy();
    if (!disabledLoadingButton) {
      throw new Error("Expected disabled generate commit message button while loading");
    }
    fireEvent.click(disabledLoadingButton);
    expect(onGenerateCommitMessage).not.toHaveBeenCalled();

    view.rerender(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        commitMessage=""
        commitMessageLoading={false}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const enabledButtons = screen.getAllByRole("button", {
      name: "Generate commit message",
    }) as HTMLButtonElement[];
    await waitFor(() => {
      expect(enabledButtons.some((button) => !button.disabled)).toBe(true);
    });
  });

  it("preserves pull/push/sync button behavior and disabled rules", () => {
    const onPull = vi.fn();
    const onPush = vi.fn();
    const onSync = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        commitsAhead={2}
        logBehind={1}
        onPull={onPull}
        onPush={onPush}
        onSync={onSync}
      />
    );

    const pullButton = screen.getByRole("button", { name: /^pull/i });
    const pushButton = screen.getByRole("button", { name: /^push/i });
    const syncButton = screen.getByRole("button", { name: /sync \(pull then push\)/i });

    expect((pullButton as HTMLButtonElement).type).toBe("button");
    expect((pushButton as HTMLButtonElement).type).toBe("button");
    expect((syncButton as HTMLButtonElement).type).toBe("button");
    expect((pullButton as HTMLButtonElement).disabled).toBe(false);
    expect((pushButton as HTMLButtonElement).disabled).toBe(true);
    expect((syncButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(pullButton);
    fireEvent.click(pushButton);
    fireEvent.click(syncButton);

    expect(onPull).toHaveBeenCalledTimes(1);
    expect(onPush).not.toHaveBeenCalled();
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("renders shared tooltips for diff row actions instead of local data-tooltip chrome", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 3, deletions: 1 }]}
        onStageFile={vi.fn()}
      />
    );

    const stageButton = screen.getByRole("button", { name: "Stage file" });
    expect(stageButton.getAttribute("data-tooltip")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(stageButton);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("Stage Changes");
    expect(stageButton.getAttribute("aria-describedby")).toBe(tooltip.getAttribute("id"));
  });

  it("exposes a governed issue follow-up action through the issues surface", () => {
    const onStartTaskFromGitHubIssueFollowUp = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        mode="issues"
        issues={githubIssues}
        onStartTaskFromGitHubIssueFollowUp={onStartTaskFromGitHubIssueFollowUp}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start follow-up for issue #42" }));

    expect(onStartTaskFromGitHubIssueFollowUp).toHaveBeenCalledWith(githubIssues[0]);
  });

  it("renders a governed issue follow-up preview with blocked reason and source evidence", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        mode="issues"
        issues={githubIssues}
        getGitHubIssueFollowUpPreview={() => ({
          title: "Issue follow-up preview",
          state: "blocked",
          summary: "Governed issue follow-up is blocked until runtime policy is ready.",
          blockedReason:
            "GitHub source launch is waiting for repository execution defaults to finish loading.",
          fields: [
            {
              id: "backend",
              label: "Backend preference",
              value: "Runtime default route",
              detail: "Resolved after repository execution policy loads.",
            },
            {
              id: "source",
              label: "Source evidence",
              value: "GitHub issue #42",
              detail: "Use canonical taskSource for GitHub issue launches.",
            },
          ],
        })}
      />
    );

    expect(screen.getByText("Issue follow-up preview")).toBeTruthy();
    expect(
      screen.getByText(
        "GitHub source launch is waiting for repository execution defaults to finish loading."
      )
    ).toBeTruthy();
    expect(screen.getByText("Runtime default route")).toBeTruthy();
    expect(screen.getByText("GitHub issue #42")).toBeTruthy();
  });

  it("adds a show in file manager option for file context menus", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo/"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[0]?.[0];
    const revealItem = menuArgs.items.find(
      (item: { text: string }) => item.text === `Show in ${fileManagerName()}`
    );

    expect(revealItem).toBeDefined();
    await revealItem.action();
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/repo/src/sample.ts");
  });

  it("copies file name and path from the context menu", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const copyNameItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "Copy file name"
    );
    const copyPathItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "Copy file path"
    );

    expect(copyNameItem).toBeDefined();
    expect(copyPathItem).toBeDefined();

    await copyNameItem.action();
    await copyPathItem.action();

    expect(clipboardWriteText).toHaveBeenCalledWith("sample.ts");
    expect(clipboardWriteText).toHaveBeenCalledWith("src/sample.ts");
  });

  it("skips desktop host menu actions in web runtime", async () => {
    isDesktopHostRuntimeMock.mockReturnValue(false);
    menuNew.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(menuNew).not.toHaveBeenCalled();
  });

  it("resolves relative git roots against the workspace path", async () => {
    revealItemInDir.mockClear();
    menuNew.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="apps"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const revealItem = menuArgs.items.find(
      (item: { text: string }) => item.text === `Show in ${fileManagerName()}`
    );

    expect(revealItem).toBeDefined();
    await revealItem.action();
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/repo/apps/src/sample.ts");
  });

  it("copies file path relative to the workspace root", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="apps"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const copyPathItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "Copy file path"
    );

    expect(copyPathItem).toBeDefined();
    await copyPathItem.action();

    expect(clipboardWriteText).toHaveBeenCalledWith("apps/src/sample.ts");
  });

  it("does not trim paths when the git root only shares a prefix", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo-tools"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const copyPathItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "Copy file path"
    );

    expect(copyPathItem).toBeDefined();
    await copyPathItem.action();

    expect(clipboardWriteText).toHaveBeenCalledWith("src/sample.ts");
  });

  it("surfaces a toast when file context menu creation fails", async () => {
    menuNew.mockRejectedValueOnce(new Error("menu unavailable"));
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => {
      expect(pushErrorToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't open file actions",
        })
      );
    });
  });

  it("marks the active diff row with data attributes instead of legacy state classes", () => {
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        selectedPath="src/sample.ts"
        unstagedFiles={[{ path: "src/sample.ts", status: "M", additions: 1, deletions: 0 }]}
      />
    );

    const row = container.querySelector('[data-git-diff-row="true"]');
    expect(row).not.toBeNull();
    expect(row?.getAttribute("data-active")).toBe("true");
    expect(row?.getAttribute("data-selected")).toBe("false");
    expect(row?.classList.contains("active")).toBe(false);
    expect(row?.classList.contains("selected")).toBe(false);
  });

  it("surfaces a toast when opening a pull request link fails", async () => {
    openUrlMock.mockRejectedValueOnce(new Error("open failed"));
    render(
      <GitDiffPanel
        {...baseProps}
        mode="prs"
        pullRequests={[
          {
            number: 17,
            title: "Fix runtime",
            url: "https://github.com/example/repo/pull/17",
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            body: "",
            headRefName: "feature/runtime",
            baseRefName: "main",
            isDraft: false,
            author: { login: "alice" },
          },
        ]}
        pullRequestsTotal={1}
        pullRequestsLoading={false}
      />
    );

    const pullRequestEntry = screen.getAllByText("Fix runtime")[0]?.closest(".git-pr-entry");
    expect(pullRequestEntry).toBeTruthy();

    const entry = within(pullRequestEntry as HTMLElement).getByRole("button", {
      pressed: false,
    });
    fireEvent.contextMenu(entry);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const openItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "Open on GitHub"
    );
    expect(openItem).toBeDefined();

    await openItem.action();

    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't open pull request on GitHub",
      })
    );
  }, 15_000);

  it("routes runtime capability contract errors to the shared toast layer instead of the sidebar error surface", async () => {
    render(
      <GitDiffPanel
        {...baseProps}
        error="Runtime RPC capabilities must advertise canonical methods only. invalid methods: code_runtime_probe_invalid_v1."
      />
    );

    await waitFor(() => {
      expect(pushErrorToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "git-runtime-capabilities-contract",
          title: "Runtime capabilities are out of date",
          message:
            "Runtime host capabilities are stale. Restart or update the runtime host, then reload the workspace.",
        })
      );
    });

    expect(
      screen.queryByText(/Runtime RPC capabilities must advertise canonical methods only\./i)
    ).toBeNull();
  });

  it("delegates a GitHub issue into a runtime task from the issues panel", () => {
    const onStartTaskFromGitHubIssue = vi.fn();
    const issue: GitHubIssue = {
      number: 42,
      title: "Normalize source-linked lineage",
      url: "https://github.com/ku0/hugecode/issues/42",
      updatedAt: new Date("2026-03-18T10:00:00Z").toISOString(),
    };

    render(
      <GitDiffPanel
        {...baseProps}
        mode="issues"
        issues={[issue]}
        issuesTotal={1}
        onStartTaskFromGitHubIssue={onStartTaskFromGitHubIssue}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delegate issue #42" }));
    expect(onStartTaskFromGitHubIssue).toHaveBeenCalledWith(issue);
  });

  it("delegates a GitHub pull request follow-up from the PR panel", () => {
    const onStartTaskFromGitHubPullRequest = vi.fn();
    const pullRequest: GitHubPullRequest = {
      number: 7,
      title: "Follow up runtime review metadata",
      url: "https://github.com/ku0/hugecode/pull/7",
      updatedAt: new Date("2026-03-18T10:00:00Z").toISOString(),
      createdAt: new Date("2026-03-17T10:00:00Z").toISOString(),
      body: "",
      headRefName: "codex/source-linkage",
      baseRefName: "fastcode",
      isDraft: false,
      author: { login: "codex" },
    };

    render(
      <GitDiffPanel
        {...baseProps}
        mode="prs"
        pullRequests={[pullRequest]}
        pullRequestsTotal={1}
        onStartTaskFromGitHubPullRequest={onStartTaskFromGitHubPullRequest}
      />
    );

    const pullRequestEntry = screen
      .getByText("Follow up runtime review metadata")
      .closest(".git-pr-entry");
    expect(pullRequestEntry).toBeTruthy();

    fireEvent.click(
      within(pullRequestEntry as HTMLElement).getByRole("button", { name: "Delegate PR #7" })
    );
    expect(onStartTaskFromGitHubPullRequest).toHaveBeenCalledWith(pullRequest);
  });

  it("exposes a governed PR follow-up action and preview through the PR surface", () => {
    const onStartTaskFromGitHubPullRequest = vi.fn();
    const pullRequest: GitHubPullRequest = {
      number: 7,
      title: "Follow up runtime review metadata",
      url: "https://github.com/ku0/hugecode/pull/7",
      updatedAt: new Date("2026-03-18T10:00:00Z").toISOString(),
      createdAt: new Date("2026-03-17T10:00:00Z").toISOString(),
      body: "",
      headRefName: "codex/source-linkage",
      baseRefName: "fastcode",
      isDraft: false,
      author: { login: "codex" },
    };

    render(
      <GitDiffPanel
        {...baseProps}
        mode="prs"
        pullRequests={[pullRequest]}
        pullRequestsTotal={1}
        onStartTaskFromGitHubPullRequest={onStartTaskFromGitHubPullRequest}
        getGitHubPullRequestFollowUpPreview={() => ({
          title: "PR follow-up preview",
          state: "ready",
          summary: "Governed PR follow-up is ready to launch.",
          blockedReason: null,
          fields: [
            {
              id: "launch",
              label: "Launch",
              value: "operator-review",
              detail: "read-only · validation review-first",
            },
            {
              id: "backend",
              label: "Backend preference",
              value: "backend-pr",
              detail: "Resolved from repository execution policy.",
            },
          ],
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start follow-up for PR #7" }));

    expect(onStartTaskFromGitHubPullRequest).toHaveBeenCalledWith(pullRequest);
    expect(screen.getByText("PR follow-up preview")).toBeTruthy();
    expect(screen.getByText("backend-pr")).toBeTruthy();
  });

  it("marks the selected commit row with a pressed state", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        mode="log"
        logEntries={[
          {
            sha: "1234567890abcdef",
            summary: "Add inspector grammar",
            author: "alice",
            timestamp: Math.floor(Date.now() / 1000),
          },
        ]}
        selectedCommitSha="1234567890abcdef"
      />
    );

    const commitButton = screen.getByRole("button", { name: /add inspector grammar/i });
    expect(commitButton.getAttribute("aria-pressed")).toBe("true");
    expect(commitButton.classList.contains("active")).toBe(false);
  }, 15_000);

  it("marks the selected pull request row with a pressed state", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        mode="prs"
        pullRequests={[
          {
            number: 17,
            title: "Fix runtime",
            url: "https://github.com/example/repo/pull/17",
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            body: "",
            headRefName: "feature/runtime",
            baseRefName: "main",
            isDraft: false,
            author: { login: "alice" },
          },
        ]}
        selectedPullRequest={17}
        pullRequestsTotal={1}
      />
    );

    const selectedPullRequestButton = screen
      .getAllByRole("button", { name: /#17\s*fix runtime/i })
      .find((button) => button.getAttribute("aria-pressed") === "true");

    expect(selectedPullRequestButton).toBeTruthy();
    expect(selectedPullRequestButton?.getAttribute("aria-pressed")).toBe("true");
    expect(selectedPullRequestButton?.classList.contains("active")).toBe(false);
  }, 15_000);

  it("shows a delegate action for GitHub issues and calls the issue delegate handler", () => {
    const onDelegateIssue = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        mode="issues"
        issues={githubIssues}
        onDelegateGitHubIssue={onDelegateIssue}
      />
    );

    const issueEntry = screen
      .getByText("Stabilize source-linked delegation")
      .closest(".git-issue-entry");
    expect(issueEntry).toBeTruthy();

    fireEvent.click(
      within(issueEntry as HTMLElement).getByRole("button", { name: "Delegate issue #42" })
    );

    expect(onDelegateIssue).toHaveBeenCalledWith(githubIssues[0]);
  }, 15_000);

  it("shows a delegate action for GitHub pull requests and calls the pull request delegate handler", () => {
    const onDelegatePullRequest = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        mode="prs"
        pullRequests={githubPullRequests}
        onDelegateGitHubPullRequest={onDelegatePullRequest}
      />
    );

    const pullRequestEntry = screen
      .getByText("Add source-linked delegation MVP")
      .closest(".git-pr-entry");
    expect(pullRequestEntry).toBeTruthy();

    fireEvent.click(
      within(pullRequestEntry as HTMLElement).getByRole("button", { name: "Delegate PR #7" })
    );

    expect(onDelegatePullRequest).toHaveBeenCalledWith(githubPullRequests[0]);
  }, 15_000);
});
