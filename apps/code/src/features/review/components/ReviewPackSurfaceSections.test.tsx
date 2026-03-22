import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderRelaunchOptions, renderSubAgentSummary } from "./ReviewPackSurfaceSections";

describe("ReviewPackSurfaceSections", () => {
  it("renders sub-agent summaries through shared status-badge semantics", () => {
    const markup = renderToStaticMarkup(
      renderSubAgentSummary([
        {
          sessionId: "agent-1",
          scopeProfile: "review-pack",
          status: "running",
          summary: "Reviewing runtime evidence.",
          approvalState: "pending",
          checkpointState: "available",
          timedOutReason: null,
          interruptedReason: null,
          parentRunId: "run-1",
        },
      ])
    );

    expect(markup).toContain('data-status-tone="progress"');
    expect(markup).toContain("Reviewing runtime evidence.");
  });

  it("renders relaunch availability through shared status-badge semantics", () => {
    const markup = renderToStaticMarkup(
      renderRelaunchOptions([
        {
          id: "retry",
          label: "Retry with findings",
          enabled: false,
          detail: "Replay the run with the latest bounded findings.",
          disabledReason: "Waiting for runtime handoff.",
        },
      ])
    );

    expect(markup).toContain('data-status-tone="default"');
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("Waiting for runtime handoff.");
  });
});
