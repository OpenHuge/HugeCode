// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsCodexAccountsNavigation } from "./SettingsCodexAccountsNavigation";

describe("SettingsCodexAccountsNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders shared badges for tab counts", () => {
    const { container } = render(
      <SettingsCodexAccountsNavigation
        activeTab="accounts"
        accountsCount={3}
        poolsCount={5}
        sharingCount={2}
        routingReadyCount={2}
        providerHealthCount={4}
        onTabChange={vi.fn()}
      />
    );

    expect(
      container.querySelectorAll('.apm-nav-badge[data-status-tone="default"][data-shape="chip"]')
        .length
    ).toBe(4);
  });

  it("changes tabs without promoting the active count into a local badge variant", () => {
    const onTabChange = vi.fn();
    const { container } = render(
      <SettingsCodexAccountsNavigation
        activeTab="health"
        accountsCount={1}
        poolsCount={2}
        sharingCount={0}
        routingReadyCount={3}
        providerHealthCount={4}
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(within(screen.getByRole("tablist")).getAllByRole("tab")[1] as HTMLElement);
    expect(onTabChange).toHaveBeenCalledWith("pools");
    expect(
      container.querySelector('.apm-nav-item.is-active .apm-nav-badge[data-status-tone="default"]')
    ).toBeTruthy();
  });
});
