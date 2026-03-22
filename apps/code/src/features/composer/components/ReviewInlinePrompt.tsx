import { memo, useEffect, useMemo, useRef } from "react";
import { Button } from "../../../design-system";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";

type ReviewInlinePromptProps = {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onClose: () => void;
  onKeyDown?: (event: { key: string; shiftKey?: boolean; preventDefault: () => void }) => boolean;
  onShowPreset: () => void;
  onChoosePreset: (preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted") => void;
  highlightedPresetIndex: number;
  onHighlightPreset: (index: number) => void;
  highlightedBranchIndex: number;
  onHighlightBranch: (index: number) => void;
  highlightedCommitIndex: number;
  onHighlightCommit: (index: number) => void;
  onSelectBranch: (value: string) => void;
  onSelectBranchAtIndex: (index: number) => void;
  onConfirmBranch: () => Promise<void>;
  onSelectCommit: (sha: string, title: string) => void;
  onSelectCommitAtIndex: (index: number) => void;
  onConfirmCommit: () => Promise<void>;
  onUpdateCustomInstructions: (value: string) => void;
  onConfirmCustom: () => Promise<void>;
};

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

const PresetStep = memo(function PresetStep({
  onChoosePreset,
  isSubmitting,
  highlightedPresetIndex,
  onHighlightPreset,
}: {
  onChoosePreset: ReviewInlinePromptProps["onChoosePreset"];
  isSubmitting: boolean;
  highlightedPresetIndex: number;
  onHighlightPreset: (index: number) => void;
}) {
  const optionClass = (index: number) =>
    `review-inline-option${index === highlightedPresetIndex ? " is-selected" : ""}`;
  return (
    <div className="review-inline-section">
      <button
        type="button"
        className={optionClass(0)}
        onClick={() => onChoosePreset("baseBranch")}
        onMouseEnter={() => onHighlightPreset(0)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">Review against a base branch</span>
        <span className="review-inline-option-subtitle">(PR Style)</span>
      </button>
      <button
        type="button"
        className={optionClass(1)}
        onClick={() => onChoosePreset("uncommitted")}
        onMouseEnter={() => onHighlightPreset(1)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">Review uncommitted changes</span>
      </button>
      <button
        type="button"
        className={optionClass(2)}
        onClick={() => onChoosePreset("commit")}
        onMouseEnter={() => onHighlightPreset(2)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">Review a commit</span>
      </button>
      <button
        type="button"
        className={optionClass(3)}
        onClick={() => onChoosePreset("custom")}
        onMouseEnter={() => onHighlightPreset(3)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">Custom review instructions</span>
      </button>
    </div>
  );
});

const BaseBranchStep = memo(function BaseBranchStep({
  reviewPrompt,
  onShowPreset,
  onSelectBranch,
  onSelectBranchAtIndex,
  onConfirmBranch,
  highlightedBranchIndex,
  onHighlightBranch,
}: {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onShowPreset: () => void;
  onSelectBranch: (value: string) => void;
  onSelectBranchAtIndex: (index: number) => void;
  onConfirmBranch: () => Promise<void>;
  highlightedBranchIndex: number;
  onHighlightBranch: (index: number) => void;
}) {
  const branches = reviewPrompt.branches;
  return (
    <div className="review-inline-section">
      <div className="review-inline-row">
        <Button
          variant="ghost"
          size="sm"
          className="review-inline-back"
          onClick={onShowPreset}
          disabled={reviewPrompt.isSubmitting}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="review-inline-confirm"
          onClick={() => void onConfirmBranch()}
          disabled={reviewPrompt.isSubmitting || !reviewPrompt.selectedBranch.trim()}
        >
          Start review
        </Button>
      </div>
      <div className="review-inline-hint">Pick a recent local branch:</div>
      <div className="review-inline-list" role="listbox" aria-label="Base branches">
        {reviewPrompt.isLoadingBranches ? (
          <div className="review-inline-empty">Loading branches…</div>
        ) : branches.length === 0 ? (
          <div className="review-inline-empty">No branches found.</div>
        ) : (
          branches.map((branch, index) => {
            const selected = index === highlightedBranchIndex;
            return (
              <button
                key={branch.name}
                type="button"
                role="option"
                aria-selected={selected}
                className={`review-inline-list-item${selected ? " is-selected" : ""}`}
                onClick={() => onSelectBranch(branch.name)}
                onMouseEnter={() => {
                  onHighlightBranch(index);
                  onSelectBranchAtIndex(index);
                }}
                disabled={reviewPrompt.isSubmitting}
              >
                {branch.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

const CommitStep = memo(function CommitStep({
  reviewPrompt,
  onShowPreset,
  onSelectCommit,
  onSelectCommitAtIndex,
  onConfirmCommit,
  highlightedCommitIndex,
  onHighlightCommit,
}: {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onShowPreset: () => void;
  onSelectCommit: (sha: string, title: string) => void;
  onSelectCommitAtIndex: (index: number) => void;
  onConfirmCommit: () => Promise<void>;
  highlightedCommitIndex: number;
  onHighlightCommit: (index: number) => void;
}) {
  const commits = reviewPrompt.commits;
  return (
    <div className="review-inline-section">
      <div className="review-inline-row">
        <Button
          variant="ghost"
          size="sm"
          className="review-inline-back"
          onClick={onShowPreset}
          disabled={reviewPrompt.isSubmitting}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="review-inline-confirm"
          onClick={() => void onConfirmCommit()}
          disabled={reviewPrompt.isSubmitting || !reviewPrompt.selectedCommitSha}
        >
          Start review
        </Button>
      </div>
      <div className="review-inline-hint">Select a recent commit:</div>
      <div className="review-inline-list" role="listbox" aria-label="Commits">
        {reviewPrompt.isLoadingCommits ? (
          <div className="review-inline-empty">Loading commits…</div>
        ) : commits.length === 0 ? (
          <div className="review-inline-empty">No commits found.</div>
        ) : (
          commits.map((commit, index) => {
            const title = commit.summary || commit.sha;
            const selected = index === highlightedCommitIndex;
            return (
              <button
                key={commit.sha}
                type="button"
                role="option"
                aria-selected={selected}
                className={`review-inline-list-item review-inline-commit${
                  selected ? " is-selected" : ""
                }`}
                onClick={() => onSelectCommit(commit.sha, title)}
                onMouseEnter={() => {
                  onHighlightCommit(index);
                  onSelectCommitAtIndex(index);
                }}
                disabled={reviewPrompt.isSubmitting}
              >
                <span className="review-inline-commit-title">{title}</span>
                <span className="review-inline-commit-meta">{shortSha(commit.sha)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

const CustomStep = memo(function CustomStep({
  reviewPrompt,
  onShowPreset,
  onUpdateCustomInstructions,
  onConfirmCustom,
}: {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onShowPreset: () => void;
  onUpdateCustomInstructions: (value: string) => void;
  onConfirmCustom: () => Promise<void>;
}) {
  const canSubmit = reviewPrompt.customInstructions.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="review-inline-section">
      <div className="review-inline-row">
        <Button
          variant="ghost"
          size="sm"
          className="review-inline-back"
          onClick={onShowPreset}
          disabled={reviewPrompt.isSubmitting}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="review-inline-confirm"
          onClick={() => void onConfirmCustom()}
          disabled={reviewPrompt.isSubmitting || !canSubmit}
        >
          Start review
        </Button>
      </div>
      <label className="review-inline-label" htmlFor="review-inline-custom-instructions">
        Instructions
      </label>
      <textarea
        ref={textareaRef}
        id="review-inline-custom-instructions"
        className="review-inline-textarea"
        value={reviewPrompt.customInstructions}
        onChange={(event) => onUpdateCustomInstructions(event.target.value)}
        placeholder="Focus on correctness, edge cases, and missing tests."
        rows={6}
      />
    </div>
  );
});

export const ReviewInlinePrompt = memo(function ReviewInlinePrompt({
  reviewPrompt,
  onClose,
  onKeyDown,
  onShowPreset,
  onChoosePreset,
  highlightedPresetIndex,
  onHighlightPreset,
  highlightedBranchIndex,
  onHighlightBranch,
  highlightedCommitIndex,
  onHighlightCommit,
  onSelectBranch,
  onSelectBranchAtIndex,
  onConfirmBranch,
  onSelectCommit,
  onSelectCommitAtIndex,
  onConfirmCommit,
  onUpdateCustomInstructions,
  onConfirmCustom,
}: ReviewInlinePromptProps) {
  const { step, error, isSubmitting } = reviewPrompt;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (step === "custom") {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement instanceof Node && dialog.contains(activeElement)) {
      return;
    }
    dialog.focus();
  }, [step]);

  const title = useMemo(() => {
    switch (step) {
      case "baseBranch":
        return "Select a base branch";
      case "commit":
        return "Select a commit to review";
      case "custom":
        return "Custom review instructions";
      default:
        return "Select a review preset";
    }
  }, [step]);

  return (
    <div
      ref={dialogRef}
      className="review-inline"
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(event) => {
        onKeyDown?.(event);
      }}
    >
      <div className="review-inline-header">
        <div className="review-inline-title">{title}</div>
        <div className="review-inline-subtitle">{reviewPrompt.workspace.name}</div>
      </div>

      {step === "preset" ? (
        <PresetStep
          onChoosePreset={onChoosePreset}
          isSubmitting={isSubmitting}
          highlightedPresetIndex={highlightedPresetIndex}
          onHighlightPreset={onHighlightPreset}
        />
      ) : step === "baseBranch" ? (
        <BaseBranchStep
          reviewPrompt={reviewPrompt}
          onShowPreset={onShowPreset}
          onSelectBranch={onSelectBranch}
          onSelectBranchAtIndex={onSelectBranchAtIndex}
          onConfirmBranch={onConfirmBranch}
          highlightedBranchIndex={highlightedBranchIndex}
          onHighlightBranch={onHighlightBranch}
        />
      ) : step === "commit" ? (
        <CommitStep
          reviewPrompt={reviewPrompt}
          onShowPreset={onShowPreset}
          onSelectCommit={onSelectCommit}
          onSelectCommitAtIndex={onSelectCommitAtIndex}
          onConfirmCommit={onConfirmCommit}
          highlightedCommitIndex={highlightedCommitIndex}
          onHighlightCommit={onHighlightCommit}
        />
      ) : (
        <CustomStep
          reviewPrompt={reviewPrompt}
          onShowPreset={onShowPreset}
          onUpdateCustomInstructions={onUpdateCustomInstructions}
          onConfirmCustom={onConfirmCustom}
        />
      )}

      {error && <div className="review-inline-error">{error}</div>}

      <div className="review-inline-actions">
        <Button variant="ghost" size="sm" className="review-inline-button" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
});
