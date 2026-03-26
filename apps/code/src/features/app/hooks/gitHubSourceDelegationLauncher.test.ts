import { describe, expect, it, vi } from "vitest";
import { launchGitHubSourceDelegation } from "./gitHubSourceDelegationLauncher";

describe("launchGitHubSourceDelegation", () => {
  it("starts a source-linked task and refreshes mission control", async () => {
    const startTask = vi.fn().mockResolvedValue({ taskId: "task-42" });
    const onRefresh = vi.fn();

    const result = await launchGitHubSourceDelegation({
      runtimeControl: { startTask },
      onRefresh,
      launch: {
        workspaceId: "ws-1",
        title: "Fix GitHub issue #42",
        instruction: "Resolve the linked GitHub issue and validate the change.",
        executionProfileId: "autonomous-delegate",
        reviewProfileId: "issue-review",
        validationPresetId: "fast-lane",
        accessMode: "full-access",
        preferredBackendIds: ["backend-a"],
        missionBrief: {
          objective: "Fix GitHub issue #42",
          preferredBackendIds: ["backend-a"],
        },
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #42",
          title: "Fix GitHub issue #42",
          externalId: "openai/hugecode#42",
          canonicalUrl: "https://github.com/openai/hugecode/issues/42",
          sourceTaskId: "issue-42",
          sourceRunId: null,
        },
      },
    });

    expect(startTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        title: "Fix GitHub issue #42",
        instruction: "Resolve the linked GitHub issue and validate the change.",
        stepKind: "read",
        executionProfileId: "autonomous-delegate",
        reviewProfileId: "issue-review",
        validationPresetId: "fast-lane",
        accessMode: "full-access",
        preferredBackendIds: ["backend-a"],
        taskSource: expect.objectContaining({
          kind: "github_issue",
          externalId: "openai/hugecode#42",
        }),
      })
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ taskId: "task-42" });
  });

  it("omits access mode when the launch normalization leaves it unset", async () => {
    const startTask = vi.fn().mockResolvedValue({ taskId: "task-43" });

    await launchGitHubSourceDelegation({
      runtimeControl: { startTask },
      launch: {
        workspaceId: "ws-1",
        title: "Inspect GitHub issue #43",
        instruction: "Read the linked GitHub issue and summarize the next step.",
        accessMode: undefined,
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #43",
          title: "Inspect GitHub issue #43",
          externalId: "openai/hugecode#43",
          canonicalUrl: "https://github.com/openai/hugecode/issues/43",
          sourceTaskId: "issue-43",
          sourceRunId: null,
        },
      },
    });

    expect(startTask).toHaveBeenCalledWith(
      expect.not.objectContaining({
        accessMode: expect.anything(),
      })
    );
  });
});
