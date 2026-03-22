/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CopyableField,
  InspectorSectionHeader,
  RightPanelHeader,
  RightPanelShell,
} from "./RightPanelPrimitives";

afterEach(() => {
  cleanup();
});

describe("RightPanelPrimitives", () => {
  it("uses the app design-system button adapter for copy actions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<CopyableField label="Path" value="/tmp/workflow-report.json" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("/tmp/workflow-report.json");
  });

  it("renders shared text primitives for inspector copy hierarchy", () => {
    const { container } = render(
      <RightPanelHeader eyebrow="Runtime" title="Sync detail" subtitle="Last refresh 2m ago" />
    );

    const textNodes = container.querySelectorAll('[data-family="text"]');
    expect(textNodes.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[data-size="micro"][data-transform="uppercase"]')).toBeTruthy();
    expect(container.querySelector('[data-size="meta"][data-tone="strong"]')).toBeTruthy();
    expect(container.querySelector('[data-size="fine"][data-tone="muted"]')).toBeTruthy();
  });

  it("uses the shared section-header grammar for inspector section headings", () => {
    const { container } = render(
      <InspectorSectionHeader
        title="Artifacts"
        subtitle="Latest runtime-published evidence"
        actions={<button type="button">Open</button>}
      />
    );

    expect(
      container.querySelector('[data-family="text"][data-transform="uppercase"]')
    ).toBeTruthy();
    expect(container.querySelector('[data-review-loop-section="true"]')).toBeTruthy();
    expect(container.querySelector('[data-family="text"][data-tone="faint"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).not.toBeNull();
  });

  it("keeps the shell primitive landmark-neutral so layout decides the outer aside", () => {
    const { container } = render(
      <RightPanelShell data-testid="right-panel-shell">content</RightPanelShell>
    );

    expect(screen.getByTestId("right-panel-shell").tagName).toBe("DIV");
    expect(container.querySelector("aside")).toBeNull();
  });
});
