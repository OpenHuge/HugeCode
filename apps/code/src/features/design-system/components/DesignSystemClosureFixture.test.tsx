/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DesignSystemClosureFixture } from "./DesignSystemClosureFixture";

afterEach(() => {
  cleanup();
});

describe("DesignSystemClosureFixture", () => {
  it("renders family-level closure evidence and opens overlay previews through explicit triggers", () => {
    render(<DesignSystemClosureFixture />);

    expect(screen.getByText("apps/code fixture host")).toBeTruthy();
    expect(screen.getByLabelText("Closure metadata")).toBeTruthy();
    expect(screen.getByText("Workspace chrome sample")).toBeTruthy();
    expect(screen.getByText("Fix runtime startup")).toBeTruthy();
    expect(screen.getByText("Settings section sample")).toBeTruthy();
    expect(screen.getByText("Inspector section sample")).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Closure overlay preview" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Closure panel preview" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview menu overlay" }));
    expect(screen.getByRole("menu", { name: "Closure overlay preview" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Preview panel overlay" }));
    expect(screen.getByRole("dialog", { name: "Closure panel preview" })).toBeTruthy();
  });
});
