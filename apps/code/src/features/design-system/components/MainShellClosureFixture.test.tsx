/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MainShellClosureFixture } from "./MainShellClosureFixture";

const MAIN_SHELL_CLOSURE_TEST_TIMEOUT_MS = 15_000;

afterEach(() => {
  cleanup();
});

describe("MainShellClosureFixture", () => {
  it(
    "renders main-shell acceptance coverage with trigger-driven sidebar and composer menus",
    () => {
      render(<MainShellClosureFixture />);

      expect(screen.getByText("Main Shell Closure")).toBeTruthy();
      expect(screen.getByText("Topbar chrome")).toBeTruthy();
      expect(screen.getByText("Home controls")).toBeTruthy();
      expect(screen.queryByRole("menu", { name: "Sidebar user menu preview" })).toBeNull();
      expect(screen.queryByRole("menu", { name: "Composer branch menu preview" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
      expect(screen.getByRole("menu", { name: "Sidebar user menu preview" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Branch and worktree" }));
      expect(screen.getByRole("menu", { name: "Composer branch menu preview" })).toBeTruthy();
      expect(screen.getAllByText("feature/main-shell").length).toBeGreaterThanOrEqual(1);
    },
    MAIN_SHELL_CLOSURE_TEST_TIMEOUT_MS
  );
});
