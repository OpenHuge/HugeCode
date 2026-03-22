// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../../types";
import { SettingsDisplaySection } from "./SettingsDisplaySection";

describe("SettingsDisplaySection", () => {
  it("toggles auto-generated thread titles", () => {
    const onUpdateAppSettings = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsDisplaySection
        appSettings={
          {
            theme: "system",
            usageShowRemaining: false,
            showMessageFilePath: true,
            threadTitleAutogenerationEnabled: false,
            uiFontFamily: "",
            codeFontFamily: "",
            codeFontSize: 11,
            notificationSoundsEnabled: true,
            systemNotificationsEnabled: true,
          } as unknown as AppSettings
        }
        reduceTransparency={false}
        scaleShortcutTitle=""
        scaleShortcutText=""
        scaleDraft="100%"
        uiFontDraft=""
        codeFontDraft=""
        codeFontSizeDraft={11}
        onUpdateAppSettings={onUpdateAppSettings}
        onToggleTransparency={vi.fn()}
        onSetScaleDraft={vi.fn<(value: SetStateAction<string>) => void>()}
        onCommitScale={vi.fn(async () => undefined)}
        onResetScale={vi.fn(async () => undefined)}
        onSetUiFontDraft={vi.fn<(value: SetStateAction<string>) => void>()}
        onCommitUiFont={vi.fn(async () => undefined)}
        onSetCodeFontDraft={vi.fn<(value: SetStateAction<string>) => void>()}
        onCommitCodeFont={vi.fn(async () => undefined)}
        onSetCodeFontSizeDraft={vi.fn<(value: SetStateAction<number>) => void>()}
        onCommitCodeFontSize={vi.fn(async () => undefined)}
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
      />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(screen.getByText("Display & Sound")).toBeTruthy();
    expect(
      screen.getByText("Display", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Sounds", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();

    const row = screen
      .getByText("Auto-generate new thread titles")
      .closest('[data-settings-field-row="toggle"]');
    expect(row).toBeTruthy();
    const button = within(row as HTMLElement).getByRole("switch");

    fireEvent.click(button);

    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ threadTitleAutogenerationEnabled: true })
    );
  });
});
