// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { baseSettings, chooseSelectOption } from "../SettingsView.test.shared";
import { SettingsComposerSection } from "./SettingsComposerSection";

describe("SettingsComposerSection", () => {
  it("renders through the shared settings grammar and preserves preset/toggle behavior", async () => {
    const onComposerPresetChange = vi.fn();
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <SettingsComposerSection
        appSettings={baseSettings}
        optionKeyLabel="Option"
        composerPresetLabels={{
          default: "Default (no helpers)",
          helpful: "Helpful",
          smart: "Smart",
        }}
        onComposerPresetChange={onComposerPresetChange}
        onUpdateAppSettings={onUpdateAppSettings}
      />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Presets", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Code fences", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Pasting", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Lists", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();

    await chooseSelectOption(screen, "Preset", "Smart");

    expect(onComposerPresetChange).toHaveBeenCalledWith("smart");

    const codeFenceRow = screen
      .getByText("Expand fences on Space")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!codeFenceRow) {
      throw new Error("Expected code fences row");
    }
    fireEvent.click(
      within(codeFenceRow).getByRole("switch", { name: "Toggle expand fences on Space" })
    );

    const pastingRow = screen
      .getByText("Auto-wrap multi-line paste")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!pastingRow) {
      throw new Error("Expected pasting row");
    }
    fireEvent.click(
      within(pastingRow).getByRole("switch", { name: "Toggle auto-wrap multi-line paste" })
    );

    const listRow = screen
      .getByText("Continue lists on Shift+Enter")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!listRow) {
      throw new Error("Expected lists row");
    }
    fireEvent.click(
      within(listRow).getByRole("switch", { name: "Toggle list continuation on Shift+Enter" })
    );

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ composerFenceExpandOnSpace: true })
      );
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ composerFenceAutoWrapPasteMultiline: true })
      );
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ composerListContinuation: true })
      );
    });
  });
});
