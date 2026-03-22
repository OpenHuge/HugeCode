/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoreLoopClosureFixture } from "./CoreLoopClosureFixture";

describe("CoreLoopClosureFixture", () => {
  it("renders the core loop acceptance surface", () => {
    render(<CoreLoopClosureFixture />);

    expect(screen.getByText("Thread states")).toBeTruthy();
    expect(screen.getByText("Active thread")).toBeTruthy();
    expect(screen.getByText("Composer meta rail")).toBeTruthy();
    expect(screen.getByText("Runtime run list")).toBeTruthy();
    expect(screen.getByText("Review-ready continuity")).toBeTruthy();
  });
});
