// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsShortcutsSection } from "./SettingsShortcutsSection";

const SETTINGS_SHORTCUTS_TEST_TIMEOUT_MS = 10_000;

describe("SettingsShortcutsSection", () => {
  it(
    "renders the shared settings grammar and clears a shortcut",
    () => {
      const onClearShortcut = vi.fn();

      const { container } = render(
        <SettingsShortcutsSection
          shortcutDrafts={{
            model: "cmd+shift+m",
            access: "cmd+shift+a",
            reasoning: "cmd+shift+r",
            collaboration: "shift+tab",
            interrupt: "esc",
            newAgent: "cmd+n",
            newWorktreeAgent: "cmd+shift+n",
            newCloneAgent: "cmd+alt+n",
            archiveThread: "cmd+ctrl+a",
            projectsSidebar: "cmd+shift+p",
            contextRail: "cmd+shift+g",
            branchSwitcher: "cmd+b",
            debugPanel: "cmd+shift+d",
            terminal: "cmd+shift+t",
            cycleAgentNext: "cmd+ctrl+down",
            cycleAgentPrev: "cmd+ctrl+up",
            cycleWorkspaceNext: "cmd+shift+down",
            cycleWorkspacePrev: "cmd+shift+up",
          }}
          onShortcutKeyDown={vi.fn()}
          onClearShortcut={onClearShortcut}
        />
      );

      expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
      expect(
        screen.getByText("File", { selector: '[data-settings-field-group-title="true"]' })
      ).toBeTruthy();
      expect(
        screen.getByText("Composer", { selector: '[data-settings-field-group-title="true"]' })
      ).toBeTruthy();

      fireEvent.click(screen.getAllByRole("button", { name: "Clear" })[0]);

      expect(onClearShortcut).toHaveBeenCalledWith("newAgentShortcut");
    },
    SETTINGS_SHORTCUTS_TEST_TIMEOUT_MS
  );
});
