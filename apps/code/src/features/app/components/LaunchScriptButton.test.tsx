/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LaunchScriptButton } from "./LaunchScriptButton";

describe("LaunchScriptButton", () => {
  it("shows an add-action button and opens the new action editor when empty", () => {
    const onRun = vi.fn();
    const onOpenNew = vi.fn();

    render(
      <LaunchScriptButton
        launchScript={null}
        editorOpen={false}
        draftScript=""
        isSaving={false}
        error={null}
        onRun={onRun}
        onOpenEditor={vi.fn()}
        onCloseEditor={vi.fn()}
        onDraftChange={vi.fn()}
        onSave={vi.fn()}
        showNew
        onOpenNew={onOpenNew}
      />
    );

    const button = screen.getByRole("button", { name: "Add action" });
    expect(button.textContent?.trim()).toBe("");

    fireEvent.click(button);

    expect(onOpenNew).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("preserves editor action buttons after migrating to the app design-system adapter", () => {
    const onCloseEditor = vi.fn();
    const onOpenNew = vi.fn();
    const onSave = vi.fn();
    const onCreateNew = vi.fn();

    render(
      <LaunchScriptButton
        launchScript="pnpm dev"
        editorOpen
        draftScript="pnpm dev"
        isSaving={false}
        error={null}
        onRun={vi.fn()}
        onOpenEditor={vi.fn()}
        onCloseEditor={onCloseEditor}
        onDraftChange={vi.fn()}
        onSave={onSave}
        showNew
        newEditorOpen
        newDraftScript="pnpm lint"
        newDraftLabel="Lint"
        newError={null}
        onOpenNew={onOpenNew}
        onCloseNew={vi.fn()}
        onNewDraftChange={vi.fn()}
        onNewDraftIconChange={vi.fn()}
        onNewDraftLabelChange={vi.fn()}
        onCreateNew={onCreateNew}
      />
    );

    const dialogs = screen.getAllByRole("dialog");
    const editorSurface = dialogs.at(-1);
    if (!editorSurface) {
      throw new Error("Expected launch script editor surface");
    }
    const dialogQueries = within(editorSurface);

    fireEvent.click(
      dialogQueries.getAllByRole("button", { name: "Cancel" })[0] as HTMLButtonElement
    );
    fireEvent.click(dialogQueries.getByRole("button", { name: "New" }));
    fireEvent.click(dialogQueries.getByRole("button", { name: "Save" }));
    fireEvent.click(
      dialogQueries.getAllByRole("button", { name: "Create" })[0] as HTMLButtonElement
    );

    expect(onCloseEditor).toHaveBeenCalledTimes(1);
    expect(onOpenNew).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });
});
