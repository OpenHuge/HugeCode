// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { type PanelTabId, PanelTabs } from "./PanelTabs";

function PanelTabsHarness() {
  const [active, setActive] = useState<PanelTabId>("git");
  return <PanelTabs active={active} onSelect={setActive} />;
}

describe("PanelTabs", () => {
  it("moves selection and focus with arrow keys", async () => {
    render(<PanelTabsHarness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.queryByLabelText("Atlas")).toBeNull();

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });

    await waitFor(() => {
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabs[1]);
    });

    fireEvent.keyDown(tabs[1], { key: "ArrowRight" });

    await waitFor(() => {
      expect(tabs[2].getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabs[2]);
    });
  });

  it("falls back to the first visible tab when the active value is no longer available", () => {
    render(<PanelTabs active={"atlas"} onSelect={() => undefined} />);

    const gitTab = screen
      .getAllByLabelText("Git")
      .find((tab) => tab.getAttribute("aria-selected") === "true");
    expect(gitTab).toBeDefined();
    expect(screen.queryByLabelText("Atlas")).toBeNull();
  });

  it("exposes shared tabs state markers on the panel tab shell", () => {
    const { container } = render(<PanelTabsHarness />);

    expect(container.querySelector('.panel-tabs[data-orientation="horizontal"]')).not.toBeNull();
    expect(container.querySelector('.panel-tabs[data-activation-mode="automatic"]')).not.toBeNull();
    expect(container.querySelector('.panel-tab[data-state="active"]')).not.toBeNull();
    expect(container.querySelector('.panel-tab[data-state="inactive"]')).not.toBeNull();
    expect(container.querySelector('.panel-tab[data-value="git"]')).not.toBeNull();
    expect(container.querySelector('.panel-tab[data-value="atlas"]')).toBeNull();
  });

  it("pins right-panel tabs to explicit rail-scoped width and no-wrap tokens", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../../styles/panel-tabs.css.ts"),
      "utf8"
    );

    expect(source).toContain('".panel-tabs .panel-tab"');
    expect(source).toContain('width: "max-content"');
    expect(source).toContain('"min-width": "64px"');
    expect(source).toContain('flex: "0 0 auto"');
    expect(source).toContain('"white-space": "nowrap"');
  });
});
