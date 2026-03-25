// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { flushBrowserMicrotasks } from "../../../../test/asyncTestUtils";
import { ReviewLoopClosureFixture } from "./ReviewLoopClosureFixture";

vi.mock("../../../../application/runtime/facades/runtimeRunRecordTruth", () => ({
  useRuntimeRunRecordTruth: () => ({
    record: null,
    loading: false,
    error: null,
  }),
}));

describe("ReviewLoopClosureFixture", () => {
  it("renders the unified review-loop acceptance surface", async () => {
    render(<ReviewLoopClosureFixture />);
    await flushBrowserMicrotasks();

    expect(screen.getAllByText(/Mission triage/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Shared operator loop")).toBeTruthy();
    expect(screen.getByTestId("operator-loop-row-resume")).toBeTruthy();
    expect(screen.getByTestId("operator-loop-row-takeover")).toBeTruthy();
    expect(screen.getByText("Blocked review detail")).toBeTruthy();
    expect(screen.getByText("Takeover review detail")).toBeTruthy();
    expect(screen.getByText("Fallback boundary")).toBeTruthy();
  });
});
