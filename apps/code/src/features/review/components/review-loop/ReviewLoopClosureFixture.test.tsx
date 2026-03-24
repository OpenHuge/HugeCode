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
    expect(screen.getByText("Fallback routing review")).toBeTruthy();
    expect(screen.getByText("Blocking sub-agent observability")).toBeTruthy();
    expect(screen.getByText("Review decision rail")).toBeTruthy();
    expect(screen.getByText("Runtime continuity and handoff")).toBeTruthy();
    expect(screen.getByText("Inspector compatibility")).toBeTruthy();
  });
});
