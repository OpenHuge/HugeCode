import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserAssessmentProxyFixture } from "./BrowserAssessmentProxyFixture";

describe("BrowserAssessmentProxyFixture", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/fixtures.html");
  });

  it("renders an iframe for a localized route target through the canonical proxy contract", () => {
    window.history.replaceState(
      {},
      "",
      "/fixtures.html?fixture=browser-assessment-proxy&browserAssessmentTargetKind=route&browserAssessmentTargetRoute=%2Fworkspace%2Falpha%3Ftab%3Dmission-control&browserAssessmentSelector=main"
    );

    render(<BrowserAssessmentProxyFixture />);

    const iframe = screen.getByTitle("Browser assessment target");
    expect(iframe.getAttribute("src")).toBe(
      "/workspace/alpha?tab=mission-control&__hugecode_browser_assessment=1"
    );
    expect(
      screen
        .getByText("Localized browser assessment target")
        .getAttribute("data-browser-assessment-proxy-state")
    ).toBeNull();
    expect(document.querySelector("[data-browser-assessment-proxy-state='ready']")).toBeTruthy();
  });

  it("blocks recursive proxy targets so the self-healing loop cannot recurse forever", () => {
    window.history.replaceState(
      {},
      "",
      "/fixtures.html?fixture=browser-assessment-proxy&browserAssessmentTargetKind=route&browserAssessmentTargetRoute=%2Ffixtures.html%3Ffixture%3Dbrowser-assessment-proxy"
    );

    render(<BrowserAssessmentProxyFixture />);

    expect(screen.getByText("Assessment target blocked")).toBeTruthy();
    expect(document.querySelector("[data-browser-assessment-proxy-state='blocked']")).toBeTruthy();
    expect(screen.queryByTitle("Browser assessment target")).toBeNull();
  });
});
