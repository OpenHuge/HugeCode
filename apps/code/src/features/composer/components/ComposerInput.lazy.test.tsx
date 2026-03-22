/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewPromptState } from "../../threads/hooks/useReviewPrompt";
import { flushLazyBoundary } from "../../../test/asyncTestUtils";

let composerInputRowWidth = 900;

vi.mock("../../../application/runtime/ports/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => undefined),
}));

function createReviewPrompt(): NonNullable<ReviewPromptState> {
  return {
    workspace: { id: "ws-1" } as NonNullable<ReviewPromptState>["workspace"],
    threadIdSnapshot: "thread-1",
    step: "preset",
    branches: [],
    commits: [],
    isLoadingBranches: false,
    isLoadingCommits: false,
    selectedBranch: "",
    selectedCommitSha: "",
    selectedCommitTitle: "",
    customInstructions: "",
    error: null,
    isSubmitting: false,
  };
}

beforeEach(() => {
  composerInputRowWidth = 900;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      if ((this as HTMLElement).classList?.contains("composer-input-row")) {
        return composerInputRowWidth;
      }
      return 0;
    },
  });
});

describe("ComposerInput lazy review prompt boundary", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keeps regular suggestions available without requiring the review prompt chunk", async () => {
    const { ComposerInput } = await import("./ComposerInput");

    render(
      <ComposerInput
        text="Use /new"
        disabled={false}
        sendLabel="Send"
        canStop={false}
        canSend={true}
        isProcessing={false}
        onStop={() => undefined}
        onSend={() => undefined}
        onTextChange={() => undefined}
        onSelectionChange={() => undefined}
        onKeyDown={() => undefined}
        textareaRef={createRef<HTMLTextAreaElement>()}
        suggestionsOpen={true}
        suggestions={[{ id: "new", label: "New thread", group: "Slash" }]}
        highlightIndex={0}
        onHighlightIndex={() => undefined}
        onSelectSuggestion={() => undefined}
      />
    );

    expect(screen.getByRole("option", { name: /New thread/i })).toBeTruthy();
    expect(screen.queryByLabelText("Select a review preset")).toBeNull();
  }, 30_000);

  it("does not render an empty suggestion surface when no items are available", async () => {
    const { ComposerInput } = await import("./ComposerInput");

    render(
      <ComposerInput
        text=""
        disabled={false}
        sendLabel="Send"
        canStop={false}
        canSend={false}
        isProcessing={false}
        onStop={() => undefined}
        onSend={() => undefined}
        onTextChange={() => undefined}
        onSelectionChange={() => undefined}
        onKeyDown={() => undefined}
        textareaRef={createRef<HTMLTextAreaElement>()}
        suggestionsOpen={true}
        suggestions={[]}
        highlightIndex={0}
        onHighlightIndex={() => undefined}
        onSelectSuggestion={() => undefined}
      />
    );

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("loads the review prompt chunk only when review mode is active", async () => {
    const { ComposerInput } = await import("./ComposerInput");
    const styles = await import("./ComposerInput.styles.css");

    render(
      <ComposerInput
        text=""
        disabled={false}
        sendLabel="Send"
        canStop={false}
        canSend={false}
        isProcessing={false}
        onStop={() => undefined}
        onSend={() => undefined}
        onTextChange={() => undefined}
        onSelectionChange={() => undefined}
        onKeyDown={() => undefined}
        textareaRef={createRef<HTMLTextAreaElement>()}
        suggestionsOpen={true}
        suggestions={[]}
        highlightIndex={0}
        onHighlightIndex={() => undefined}
        onSelectSuggestion={() => undefined}
        reviewPrompt={createReviewPrompt()}
        onReviewPromptClose={() => undefined}
        onReviewPromptShowPreset={() => undefined}
        onReviewPromptChoosePreset={() => undefined}
        highlightedPresetIndex={0}
        onReviewPromptHighlightPreset={() => undefined}
        highlightedBranchIndex={0}
        onReviewPromptHighlightBranch={() => undefined}
        highlightedCommitIndex={0}
        onReviewPromptHighlightCommit={() => undefined}
        onReviewPromptSelectBranch={() => undefined}
        onReviewPromptSelectBranchAtIndex={() => undefined}
        onReviewPromptConfirmBranch={async () => undefined}
        onReviewPromptSelectCommit={() => undefined}
        onReviewPromptSelectCommitAtIndex={() => undefined}
        onReviewPromptConfirmCommit={async () => undefined}
        onReviewPromptUpdateCustomInstructions={() => undefined}
        onReviewPromptConfirmCustom={async () => undefined}
      />
    );

    await flushLazyBoundary();

    expect(screen.getByLabelText("Select a review preset")).toBeTruthy();
    expect(screen.getByRole("group").classList.contains(styles.inputAreaSuggestionsOpen)).toBe(
      true
    );
  });

  it("does not render the review prompt when required callbacks are incomplete", async () => {
    const { ComposerInput } = await import("./ComposerInput");

    render(
      <ComposerInput
        text=""
        disabled={false}
        sendLabel="Send"
        canStop={false}
        canSend={false}
        isProcessing={false}
        onStop={() => undefined}
        onSend={() => undefined}
        onTextChange={() => undefined}
        onSelectionChange={() => undefined}
        onKeyDown={() => undefined}
        textareaRef={createRef<HTMLTextAreaElement>()}
        suggestionsOpen={true}
        suggestions={[]}
        highlightIndex={0}
        onHighlightIndex={() => undefined}
        onSelectSuggestion={() => undefined}
        reviewPrompt={createReviewPrompt()}
        onReviewPromptClose={() => undefined}
        onReviewPromptShowPreset={() => undefined}
        onReviewPromptChoosePreset={() => undefined}
        highlightedPresetIndex={0}
        onReviewPromptHighlightPreset={() => undefined}
        highlightedBranchIndex={0}
        onReviewPromptHighlightBranch={() => undefined}
        highlightedCommitIndex={0}
        onReviewPromptHighlightCommit={() => undefined}
        onReviewPromptSelectBranch={() => undefined}
        onReviewPromptSelectBranchAtIndex={() => undefined}
        onReviewPromptConfirmBranch={async () => undefined}
        onReviewPromptSelectCommit={() => undefined}
        onReviewPromptSelectCommitAtIndex={() => undefined}
        onReviewPromptConfirmCommit={async () => undefined}
        onReviewPromptUpdateCustomInstructions={() => undefined}
      />
    );

    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
    expect(screen.queryByLabelText("Select a review preset")).toBeNull();
  });

  it("keeps IME composition text local until composition ends", async () => {
    const { ComposerInput } = await import("./ComposerInput");
    const onTextChange = vi.fn();
    const onSelectionChange = vi.fn();

    function ComposerInputHarness() {
      const [text, setText] = useState("");

      return (
        <ComposerInput
          text={text}
          disabled={false}
          sendLabel="Send"
          canStop={false}
          canSend={false}
          isProcessing={false}
          onStop={() => undefined}
          onSend={() => undefined}
          onTextChange={(next, selectionStart, syncMode) => {
            onTextChange(next, selectionStart, syncMode);
            setText(next);
          }}
          onSelectionChange={onSelectionChange}
          onKeyDown={() => undefined}
          textareaRef={createRef<HTMLTextAreaElement>()}
          suggestionsOpen={false}
          suggestions={[]}
          highlightIndex={0}
          onHighlightIndex={() => undefined}
          onSelectSuggestion={() => undefined}
        />
      );
    }

    render(<ComposerInputHarness />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "升级依赖到zuzui'xi", selectionStart: 12 } });
    fireEvent.change(textarea, { target: { value: "升级依赖到最新", selectionStart: 7 } });
    fireEvent.compositionEnd(textarea);

    expect(onTextChange).toHaveBeenNthCalledWith(1, "升级依赖到zuzui'xi", 12, "skip");
    expect(onTextChange).toHaveBeenNthCalledWith(2, "升级依赖到最新", 7, "skip");
    expect(onTextChange).toHaveBeenNthCalledWith(3, "升级依赖到最新", 7, "deferred");
    expect(onSelectionChange).toHaveBeenCalledWith(7);
  });
});
