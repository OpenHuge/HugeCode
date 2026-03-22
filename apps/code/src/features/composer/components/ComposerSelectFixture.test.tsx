// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComposerSelectFixture } from "./ComposerSelectFixture";

describe("ComposerSelectFixture", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the fixture without showing remote backend controls by default", async () => {
    render(<ComposerSelectFixture />);

    expect(screen.getByRole("heading", { name: "Composer Select Fixture" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remote backend" })).toBeNull();
    expect(screen.getAllByText("GPT-5.4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chat").length).toBeGreaterThan(0);
    expect(screen.getByText("Worktree")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Branch & worktree" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText("Context usage 24.0k / 32.0k tokens (75%)")).toBeTruthy();
    });
  });
});
