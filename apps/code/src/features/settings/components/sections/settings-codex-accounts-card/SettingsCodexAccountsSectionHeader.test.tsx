/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsCodexAccountsSectionHeader } from "./SettingsCodexAccountsSectionHeader";

afterEach(() => {
  cleanup();
});

describe("SettingsCodexAccountsSectionHeader", () => {
  it("uses the shared section-header grammar and icon-button actions", () => {
    const onRefresh = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <SettingsCodexAccountsSectionHeader
        title="Codex accounts"
        description="Review account health and default routing."
        onRefresh={onRefresh}
        refreshing={false}
        onClose={onClose}
      />
    );

    expect(
      container.querySelector('[data-family="text"][data-transform="uppercase"]')
    ).toBeTruthy();
    expect(container.querySelector('[data-family="text"][data-tone="faint"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Close section" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
