/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CoreLoopHeader,
  CoreLoopMetaRail,
  CoreLoopSection,
  CoreLoopStatePanel,
} from "./CoreLoopAdapters";

describe("CoreLoopAdapters", () => {
  it("renders header, section, state panel, and meta rail through a shared calm-dense grammar", () => {
    render(
      <>
        <CoreLoopHeader
          eyebrow="Conversation"
          title="Thread timeline"
          description="Timeline, composer, and runtime list share one surface grammar."
          signals={<span>Signals</span>}
        />
        <CoreLoopSection title="Run list" description="Runtime-backed mission visibility">
          <CoreLoopMetaRail>
            <span>Visible 2</span>
            <span>Filter all</span>
          </CoreLoopMetaRail>
          <CoreLoopStatePanel
            eyebrow="Loading thread"
            title="Restoring recent threads"
            description="Loading the latest thread for this workspace."
            checklistTitle="Launch sequence"
            steps={[
              { id: "load-history", label: "Load recent threads" },
              { id: "restore-context", label: "Restore context" },
              { id: "resume-thread", label: "Resume the conversation" },
            ]}
          />
        </CoreLoopSection>
      </>
    );

    expect(screen.getByText("Thread timeline")).toBeTruthy();
    expect(screen.getByText("Run list")).toBeTruthy();
    expect(screen.getByText("Visible 2")).toBeTruthy();
    expect(screen.getByText("Restoring recent threads")).toBeTruthy();
    expect(screen.getByText("Launch sequence")).toBeTruthy();
    expect(document.querySelector('[data-core-loop-header="true"]')).toBeTruthy();
    expect(document.querySelector('[data-core-loop-section="true"]')).toBeTruthy();
    expect(document.querySelector('[data-core-loop-meta-rail="true"]')).toBeTruthy();
    expect(document.querySelector('[data-core-loop-state-panel="true"]')).toBeTruthy();
  });
});
