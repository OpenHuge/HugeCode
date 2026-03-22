// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { baseSettings } from "../SettingsView.test.shared";
import { SettingsGitSection } from "./SettingsGitSection";

describe("SettingsGitSection", () => {
  it("renders through the shared settings grammar and toggles preload git diffs", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <SettingsGitSection
        appSettings={baseSettings}
        onUpdateAppSettings={onUpdateAppSettings}
        commitMessagePromptDraft={baseSettings.commitMessagePrompt}
        commitMessagePromptDirty={false}
        commitMessagePromptSaving={false}
        onSetCommitMessagePromptDraft={vi.fn()}
        onSaveCommitMessagePrompt={vi.fn().mockResolvedValue(undefined)}
        onResetCommitMessagePrompt={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Diff behavior", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Commit messages", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();

    const row = screen
      .getByText("Preload git diffs")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected preload git diffs row");
    }

    fireEvent.click(within(row).getByRole("switch", { name: "Preload git diffs" }));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ preloadGitDiffs: false })
      );
    });
  });
});
