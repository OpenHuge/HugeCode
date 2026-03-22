/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GitDiffViewerPlaceholder } from "./GitDiffViewerPlaceholder";

afterEach(() => {
  cleanup();
});

describe("GitDiffViewerPlaceholder", () => {
  it("surfaces repository guidance before a git root is available", () => {
    render(
      <GitDiffViewerPlaceholder isLoading={false} error={null} hasRepositoryContext={false} />
    );

    expect(screen.getByText("Repository not selected")).toBeTruthy();
    expect(
      screen.getByText(
        "Choose a repository-backed workspace or Git root before inspecting diff output."
      )
    ).toBeTruthy();
  });

  it("keeps the clean-worktree copy when a repository is selected", () => {
    render(<GitDiffViewerPlaceholder isLoading={false} error={null} hasRepositoryContext={true} />);

    expect(screen.getByText("Working tree is clean")).toBeTruthy();
    expect(
      screen.getByText("No local changes were detected for the current workspace.")
    ).toBeTruthy();
  });

  it("shows a lightweight loading state without mounting the full diff viewer", () => {
    render(<GitDiffViewerPlaceholder isLoading error={null} hasRepositoryContext={true} />);

    expect(screen.getByText("Loading diff...")).toBeTruthy();
  });

  it("surfaces diff errors directly", () => {
    render(
      <GitDiffViewerPlaceholder
        isLoading={false}
        error="Unable to load diff output."
        hasRepositoryContext={true}
      />
    );

    expect(screen.getByText("Unable to load diff output.")).toBeTruthy();
  });
});
