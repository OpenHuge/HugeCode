import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserAssessmentProxyFixture } from "./BrowserAssessmentProxyFixture";

describe("BrowserAssessmentProxyFixture", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/fixtures.html");
  });

  it("waits for the localized target to load before reporting the proxy as ready", async () => {
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
    expect(document.querySelector("[data-browser-assessment-proxy-state='loading']")).toBeTruthy();

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(document.querySelector("[data-browser-assessment-proxy-state='ready']")).toBeTruthy();
    });
  });

  it("honors the requested post-load delay before reporting the proxy as ready", async () => {
    window.history.replaceState(
      {},
      "",
      "/fixtures.html?fixture=browser-assessment-proxy&browserAssessmentTargetKind=route&browserAssessmentTargetRoute=%2Fworkspace%2Falpha&browserAssessmentWaitMs=250"
    );

    render(<BrowserAssessmentProxyFixture />);

    const iframe = screen.getByTitle("Browser assessment target");
    fireEvent.load(iframe);

    expect(document.querySelector("[data-browser-assessment-proxy-state='loading']")).toBeTruthy();

    await vi.advanceTimersByTimeAsync(249);
    expect(document.querySelector("[data-browser-assessment-proxy-state='ready']")).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    await waitFor(() => {
      expect(document.querySelector("[data-browser-assessment-proxy-state='ready']")).toBeTruthy();
    });
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
