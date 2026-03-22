// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClonePrompt } from "./ClonePrompt";

afterEach(() => {
  cleanup();
});

const baseProps = {
  workspaceName: "Repo",
  copyName: "repo-copy",
  copiesFolder: "/tmp/copies",
  suggestedCopiesFolder: "/tmp/suggested",
  onCopyNameChange: vi.fn(),
  onChooseCopiesFolder: vi.fn(),
  onUseSuggestedCopiesFolder: vi.fn(),
  onClearCopiesFolder: vi.fn(),
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
};

describe("ClonePrompt", () => {
  it("guards backdrop cancel while busy", () => {
    const onCancel = vi.fn();
    const { container, rerender } = render(
      <ClonePrompt {...baseProps} onCancel={onCancel} isBusy />
    );

    const backdrop = container.querySelector("[data-ui-dialog-backdrop='true']");
    expect(backdrop).toBeTruthy();
    if (!backdrop) {
      throw new Error("Expected clone prompt backdrop");
    }
    fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();

    rerender(<ClonePrompt {...baseProps} onCancel={onCancel} isBusy={false} />);
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("handles Escape and Enter keyboard actions", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ClonePrompt {...baseProps} onCancel={onCancel} onConfirm={onConfirm} isBusy={false} />);

    const copyNameInput = screen.getByLabelText("Copy name");
    fireEvent.keyDown(copyNameInput, {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
    });
    fireEvent.keyDown(copyNameInput, { key: "Enter" });

    return waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it("preserves action button callbacks with the app design-system button adapter", () => {
    const onChooseCopiesFolder = vi.fn();
    const onClearCopiesFolder = vi.fn();
    const onUseSuggestedCopiesFolder = vi.fn();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ClonePrompt
        {...baseProps}
        onChooseCopiesFolder={onChooseCopiesFolder}
        onClearCopiesFolder={onClearCopiesFolder}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onChooseCopiesFolder).toHaveBeenCalledTimes(1);
    expect(onClearCopiesFolder).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    cleanup();

    render(
      <ClonePrompt
        {...baseProps}
        copiesFolder=""
        onUseSuggestedCopiesFolder={onUseSuggestedCopiesFolder}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Use suggested" }));

    expect(onUseSuggestedCopiesFolder).toHaveBeenCalledTimes(1);
  });

  it("keeps readonly path fields discoverable through explicit labels", () => {
    render(<ClonePrompt {...baseProps} />);

    expect((screen.getByLabelText("Copy name") as HTMLInputElement).value).toBe("repo-copy");
    expect((screen.getByLabelText("Copies folder") as HTMLTextAreaElement).value).toBe(
      "/tmp/copies"
    );
  });

  it("exposes the suggested readonly path when no copies folder has been chosen", () => {
    render(<ClonePrompt {...baseProps} copiesFolder="" />);

    expect((screen.getByLabelText("Suggested copies folder") as HTMLTextAreaElement).value).toBe(
      "/tmp/suggested"
    );
  });
});
