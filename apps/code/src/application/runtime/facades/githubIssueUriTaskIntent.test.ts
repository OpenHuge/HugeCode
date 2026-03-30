import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { resolveGitHubIssueUriTaskIntent } from "./githubIssueUriTaskIntent";
import { getGitHubIssueDetails, getGitRemote } from "../ports/tauriGit";

vi.mock("../ports/tauriGit", () => ({
  getGitHubIssueDetails: vi.fn(),
  getGitRemote: vi.fn(),
}));

describe("githubIssueUriTaskIntent", () => {
  const repositoryExecutionContract = parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "balanced-delegate",
      },
      defaultReviewProfileId: null,
      sourceMappings: {},
      validationPresets: [],
      reviewProfiles: [],
    })
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGitRemote).mockResolvedValue("https://github.com/acme/hugecode.git");
  });

  it("resolves a GitHub issue URI into a governed runtime task intent", async () => {
    vi.mocked(getGitHubIssueDetails).mockResolvedValue({
      number: 42,
      title: "Ship autonomous issue drive",
      url: "https://github.com/acme/hugecode/issues/42",
      updatedAt: "2026-03-30T00:00:00.000Z",
      body: "Expand issue follow-up into an issue-to-PR workflow.",
      author: {
        login: "maintainer",
      },
      labels: ["autodrive", "github"],
    });

    const intent = await resolveGitHubIssueUriTaskIntent({
      workspaceId: "ws-1",
      issueUri: "https://github.com/acme/hugecode/issues/42",
      repositoryExecutionContract,
      preferredBackendIds: ["backend-a"],
    });

    expect(getGitRemote).toHaveBeenCalledWith("ws-1");
    expect(getGitHubIssueDetails).toHaveBeenCalledWith("ws-1", 42);
    expect(intent.issue.number).toBe(42);
    expect(intent.launch.taskSource.label).toBe("GitHub issue #42");
    expect(intent.request.preferredBackendIds).toEqual(["backend-a"]);
    expect(intent.request.steps[0]?.input).toContain("Create a local execution plan");
    expect(intent.preview.summary).toContain("ready on the governed runtime path");
  });

  it("rejects issue URIs from a different repository than the active workspace", async () => {
    await expect(
      resolveGitHubIssueUriTaskIntent({
        workspaceId: "ws-1",
        issueUri: "https://github.com/other/repo/issues/7",
        repositoryExecutionContract,
      })
    ).rejects.toThrow(/does not match the active workspace repository/i);
  });

  it("rejects invalid GitHub issue URIs", async () => {
    await expect(
      resolveGitHubIssueUriTaskIntent({
        workspaceId: "ws-1",
        issueUri: "https://github.com/acme/hugecode/pull/42",
        repositoryExecutionContract,
      })
    ).rejects.toThrow(/valid github issue uri/i);
  });
});
