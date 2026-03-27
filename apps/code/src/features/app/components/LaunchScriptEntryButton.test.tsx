/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LaunchScriptEntry } from "../../../types";
import { LaunchScriptEntryButton } from "./LaunchScriptEntryButton";

const entry: LaunchScriptEntry = {
  id: "entry-1",
  label: "Dev server",
  icon: "terminal",
  script: "pnpm dev",
};

describe("LaunchScriptEntryButton", () => {
  it("keeps editor actions as non-submit buttons after migrating to the app design-system adapter", () => {
    const onCloseEditor = vi.fn();
    const onDelete = vi.fn();
    const onSave = vi.fn();

    render(
      <LaunchScriptEntryButton
        entry={entry}
        editorOpen
        draftScript="pnpm dev"
        draftIcon="terminal"
        draftLabel="Dev server"
        isSaving={false}
        error={null}
        onRun={vi.fn()}
        onOpenEditor={vi.fn()}
        onCloseEditor={onCloseEditor}
        onDraftChange={vi.fn()}
        onDraftIconChange={vi.fn()}
        onDraftLabelChange={vi.fn()}
        onSave={onSave}
        onDelete={onDelete}
      />
    );

    const dialog = screen.getByRole("dialog");
    const dialogQueries = within(dialog);
    const cancelButton = dialogQueries.getByRole("button", { name: "Cancel" });
    const deleteButton = dialogQueries.getByRole("button", { name: "Delete" });
    const saveButton = dialogQueries.getByRole("button", { name: "Save" });

    expect((cancelButton as HTMLButtonElement).type).toBe("button");
    expect((deleteButton as HTMLButtonElement).type).toBe("button");
    expect((saveButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(cancelButton);
    fireEvent.click(deleteButton);
    fireEvent.click(saveButton);

    expect(onCloseEditor).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  }, 10_000);
});
