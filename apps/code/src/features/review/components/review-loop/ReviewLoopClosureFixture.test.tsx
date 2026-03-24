// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewLoopClosureFixture } from "./ReviewLoopClosureFixture";

vi.mock("../../../../application/runtime/facades/runtimeRunRecordTruth", () => ({
  useRuntimeRunRecordTruth: () => ({
    record: null,
    loading: false,
    error: null,
  }),
}));

describe("ReviewLoopClosureFixture", () => {
  it("renders the unified review-loop acceptance surface", () => {
    render(<ReviewLoopClosureFixture />);

    expect(screen.getAllByText(/Mission triage/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Fallback routing review")).toBeTruthy();
    expect(screen.getByText("Blocking sub-agent observability")).toBeTruthy();
    expect(screen.getByText("Review decision rail")).toBeTruthy();
    expect(screen.getByText("Runtime continuity and handoff")).toBeTruthy();
    expect(screen.getByText("Inspector compatibility")).toBeTruthy();
  });
});
