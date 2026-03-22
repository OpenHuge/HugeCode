// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainAppCompactThreadConnectionChip } from "./MainAppCompactThreadConnectionChip";

describe("MainAppCompactThreadConnectionChip", () => {
  it("renders a shared badge contract for the live state", () => {
    const { container } = render(
      <MainAppCompactThreadConnectionChip show hasActiveThread connectionState="live" />
    );

    expect(screen.getByText("Live")).toBeTruthy();
    expect(
      container.querySelector(
        '.workspace-thread-chip[data-shape="chip"][data-status-tone="success"][data-workspace-chrome="pill"]'
      )
    ).toBeTruthy();
  });

  it("does not render when compact chrome is hidden or there is no active thread", () => {
    const { rerender, container } = render(
      <MainAppCompactThreadConnectionChip show={false} hasActiveThread connectionState="offline" />
    );

    expect(container.firstChild).toBeNull();

    rerender(
      <MainAppCompactThreadConnectionChip show hasActiveThread={false} connectionState="offline" />
    );
    expect(container.firstChild).toBeNull();
  });
});
