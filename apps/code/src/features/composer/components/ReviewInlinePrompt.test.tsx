/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewPromptState } from "../../threads/hooks/useReviewPrompt";
import { ReviewInlinePrompt } from "./ReviewInlinePrompt";

const reviewPrompt: NonNullable<ReviewPromptState> = {
  workspace: {
    id: "ws-1",
    name: "Workspace Alpha",
    path: "/tmp/workspace-alpha",
    branch: null,
    task_backend_id: null,
  },
  threadIdSnapshot: "thread-1",
  step: "baseBranch",
  branches: [
    {
      name: "main",
      lastCommit: 1,
      current: false,
      isDefault: true,
      isRemote: false,
      remoteName: null,
      worktreePath: null,
    },
  ],
  commits: [],
  isLoadingBranches: false,
  isLoadingCommits: false,
  selectedBranch: "main",
  selectedCommitSha: "",
  selectedCommitTitle: "",
  customInstructions: "",
  error: null,
  isSubmitting: false,
};

describe("ReviewInlinePrompt", () => {
  it("keeps review actions as non-submit buttons after migrating to the app design-system adapter", () => {
    const onClose = vi.fn();
    const onShowPreset = vi.fn();
    const onConfirmBranch = vi.fn(async () => {});

    render(
      <ReviewInlinePrompt
        reviewPrompt={reviewPrompt}
        onClose={onClose}
        onShowPreset={onShowPreset}
        onChoosePreset={vi.fn()}
        highlightedPresetIndex={0}
        onHighlightPreset={vi.fn()}
        highlightedBranchIndex={0}
        onHighlightBranch={vi.fn()}
        highlightedCommitIndex={0}
        onHighlightCommit={vi.fn()}
        onSelectBranch={vi.fn()}
        onSelectBranchAtIndex={vi.fn()}
        onConfirmBranch={onConfirmBranch}
        onSelectCommit={vi.fn()}
        onSelectCommitAtIndex={vi.fn()}
        onConfirmCommit={vi.fn(async () => {})}
        onUpdateCustomInstructions={vi.fn()}
        onConfirmCustom={vi.fn(async () => {})}
      />
    );

    const backButton = screen.getByRole("button", { name: "Back" });
    const startButton = screen.getByRole("button", { name: "Start review" });
    const closeButton = screen.getByRole("button", { name: "Close" });

    expect((backButton as HTMLButtonElement).type).toBe("button");
    expect((startButton as HTMLButtonElement).type).toBe("button");
    expect((closeButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(backButton);
    fireEvent.click(startButton);
    fireEvent.click(closeButton);

    expect(onShowPreset).toHaveBeenCalledTimes(1);
    expect(onConfirmBranch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
