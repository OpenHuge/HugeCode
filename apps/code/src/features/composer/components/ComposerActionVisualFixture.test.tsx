// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComposerActionVisualFixture } from "./ComposerActionVisualFixture";

describe("ComposerActionVisualFixture", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the governed stop-action fixture states without the full composer surface", () => {
    render(<ComposerActionVisualFixture />);

    expect(screen.getByRole("heading", { name: "Composer Action Stop Fixture" })).toBeTruthy();
    expect(screen.getByText("Starting response")).toBeTruthy();
    expect(screen.getByText("Stop ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Starting response" }).getAttribute("disabled")).toBe(
      ""
    );
    expect(screen.getByRole("button", { name: "Stop" }).getAttribute("disabled")).toBeNull();
    expect(document.querySelectorAll('[data-stop-state="startup"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-stop-state="ready"]')).toHaveLength(1);
    expect(document.querySelectorAll(".composer-action-stop-square")).toHaveLength(2);
  });
});
