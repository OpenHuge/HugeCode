// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerPlanFollowupPanel } from "./ComposerPlanFollowupPanel";

describe("ComposerPlanFollowupPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders plan preview lines separately so long plans can wrap inside the panel", () => {
    render(
      <ComposerPlanFollowupPanel
        artifact={{
          planItemId: "plan-1",
          threadId: "thread-1",
          title: "Execution plan",
          preview:
            "1. Inspect nested project root and locate package/scripts plus any browser/js runtime integration points\n2. Read surfaced config/source files that reference browser debugging or js_repl-style execution\nNote: confirm the real entrypoints before implementation.",
          body: "## Execution plan",
          awaitingFollowup: true,
        }}
        changeRequest=""
        onChangeRequest={vi.fn()}
      />
    );

    const lines = screen.getAllByTestId("plan-preview-line");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.textContent).toContain("Inspect nested project root");
    expect(lines[1]?.textContent).toContain("js_repl-style execution");
    expect(lines[2]?.textContent).toBe("Note: confirm the real entrypoints before implementation.");
    expect(screen.getByRole("textbox", { name: "Plan change request" })).toBeTruthy();
  });
});
