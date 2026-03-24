/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { flushBrowserMicrotasks } from "../../../test/asyncTestUtils";
import { CoreLoopClosureFixture } from "./CoreLoopClosureFixture";

describe("CoreLoopClosureFixture", () => {
  it("renders the core loop acceptance surface", async () => {
    render(<CoreLoopClosureFixture />);
    await flushBrowserMicrotasks();

    expect(screen.getByText("Thread states")).toBeTruthy();
    expect(screen.getByText("Active thread")).toBeTruthy();
    expect(screen.getByText("Composer meta rail")).toBeTruthy();
    expect(screen.getByText("Runtime run list")).toBeTruthy();
    expect(screen.getByText("Review-ready continuity")).toBeTruthy();
  });
});
