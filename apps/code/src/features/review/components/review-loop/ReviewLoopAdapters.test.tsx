// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ReviewActionRail,
  ReviewEvidenceList,
  ReviewLoopHeader,
  ReviewLoopSection,
  ReviewSignalGroup,
  ReviewSummaryCard,
} from "./ReviewLoopAdapters";

describe("ReviewLoopAdapters", () => {
  it("renders the shared review-loop grammar with stable data contracts", () => {
    const { container } = render(
      <div>
        <ReviewLoopHeader
          eyebrow="Review loop"
          title="Runtime triage"
          description="Unified detail grammar for runtime-backed review surfaces."
          signals={
            <ReviewSignalGroup>
              <span>Fallback routing</span>
            </ReviewSignalGroup>
          }
        />
        <ReviewLoopSection
          title="Summary"
          description="Operator summary and next action"
          actions={<button type="button">Refresh</button>}
        >
          <ReviewSummaryCard label="Needs action" value="3" detail="Approval and review blockers" />
          <ReviewActionRail>
            <button type="button">Open detail</button>
          </ReviewActionRail>
          <ReviewEvidenceList
            items={[
              { id: "trace", label: "Trace", detail: "trace-runtime-1" },
              { id: "checkpoint", label: "Checkpoint", detail: "checkpoint-runtime-1" },
            ]}
          />
        </ReviewLoopSection>
      </div>
    );

    expect(container.querySelector('[data-review-loop-header="true"]')).toBeTruthy();
    expect(container.querySelector('[data-review-loop-signals="true"]')).toBeTruthy();
    expect(container.querySelector('[data-review-loop-section="true"]')).toBeTruthy();
    expect(container.querySelector('[data-review-summary-card="true"]')).toBeTruthy();
    expect(container.querySelector('[data-review-action-rail="true"]')).toBeTruthy();
    expect(container.querySelector('[data-review-evidence-list="true"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(screen.getByText("Fallback routing")).toBeTruthy();
  });
});
