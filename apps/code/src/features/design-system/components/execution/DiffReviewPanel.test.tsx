// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiffReviewPanel } from "../../../../design-system";

describe("DiffReviewPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps diff actions on button semantics and fires callbacks", () => {
    const onToggleExpanded = vi.fn();
    const onRevertAllChanges = vi.fn();

    render(
      <DiffReviewPanel
        title="Review worktree diff"
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        onRevertAllChanges={onRevertAllChanges}
        files={[{ path: "src/runtime.ts", status: "M" }]}
      />
    );

    const showDiffButton = screen.getByRole("button", { name: "Show diff" }) as HTMLButtonElement;
    const revertButton = screen.getByRole("button", {
      name: "Revert all changes",
    }) as HTMLButtonElement;

    expect(showDiffButton.type).toBe("button");
    expect(revertButton.type).toBe("button");

    fireEvent.click(showDiffButton);
    fireEvent.click(revertButton);

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onRevertAllChanges).toHaveBeenCalledTimes(1);
  });

  it("supports custom toggle labels", () => {
    render(
      <DiffReviewPanel
        title="Evidence diff"
        expanded={false}
        onToggleExpanded={() => {}}
        showToggleLabel="Show changed files"
        hideToggleLabel="Hide changed files"
      />
    );

    expect(screen.getByRole("button", { name: "Show changed files" })).toBeTruthy();
  });
});
