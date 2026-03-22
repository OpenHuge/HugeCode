// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  actAndFlush,
  renderDisplaySection,
  renderEnvironmentsSection,
  tailscaleDaemonCommandPreviewMock,
  tailscaleDaemonStatusMock,
  tailscaleStatusMock,
} from "./SettingsView.test.shared";

describe("SettingsView Display", () => {
  it("updates the theme selection", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    fireEvent.click(screen.getByRole("button", { name: "Theme" }));
    fireEvent.click(screen.getByRole("option", { name: "Dark" }));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
    });
  }, 20_000);

  it("toggles remaining limits display", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const row = screen
      .getByText("Show remaining Codex limits")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected remaining limits row");
    }
    const toggle = within(row).getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ usageShowRemaining: true })
      );
    });
  });

  it("toggles file path visibility in messages", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const row = screen
      .getByText("Show file path in messages")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected file path visibility row");
    }
    const toggle = within(row).getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ showMessageFilePath: false })
      );
    });
  });

  it("toggles split chat and diff center panes", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const row = screen
      .getByText("Split chat and diff center panes")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected split center panes row");
    }
    const toggle = within(row).getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ splitChatDiffView: true })
      );
    });
  });

  it("toggles reduce transparency", async () => {
    const onToggleTransparency = vi.fn();
    await renderDisplaySection({ onToggleTransparency, reduceTransparency: false });

    const row = screen
      .getByText("Reduce transparency")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected reduce transparency row");
    }
    const toggle = within(row).getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onToggleTransparency).toHaveBeenCalledWith(true);
    });
  });

  it("commits interface scale on blur and enter with clamping", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const scaleInput = screen.getByLabelText("Interface scale");

    fireEvent.change(scaleInput, { target: { value: "500%" } });
    fireEvent.blur(scaleInput);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(expect.objectContaining({ uiScale: 3 }));
    });

    fireEvent.change(scaleInput, { target: { value: "3%" } });
    fireEvent.keyDown(scaleInput, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(expect.objectContaining({ uiScale: 0.1 }));
    });
  });

  it("commits font family changes on blur and enter", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const uiFontInput = screen.getByLabelText("UI font family");
    fireEvent.change(uiFontInput, { target: { value: "Avenir, sans-serif" } });
    fireEvent.blur(uiFontInput);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiFontFamily: "Avenir, sans-serif" })
      );
    });

    const codeFontInput = screen.getByLabelText("Code font family");
    fireEvent.change(codeFontInput, {
      target: { value: "JetBrains Mono, monospace" },
    });
    fireEvent.keyDown(codeFontInput, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codeFontFamily: "JetBrains Mono, monospace" })
      );
    });
  });

  it("resets font families to defaults", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const uiFontField = screen.getByText("UI font family", { selector: "label" }).parentElement;
    const codeFontField = screen.getByText("Code font family", { selector: "label" }).parentElement;
    if (!uiFontField || !codeFontField) {
      throw new Error("Expected font family field containers");
    }

    fireEvent.click(within(uiFontField).getByRole("button", { name: "Reset" }));
    fireEvent.click(within(codeFontField).getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          uiFontFamily: expect.stringContaining("system-ui"),
        })
      );
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          codeFontFamily: expect.stringContaining("ui-monospace"),
        })
      );
    });
  }, 15_000);

  it("updates code font size from the slider", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const slider = screen.getByLabelText("Code font size");
    fireEvent.change(slider, { target: { value: "14" } });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codeFontSize: 14 })
      );
    });
  });

  it("toggles notification sounds", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({
      onUpdateAppSettings,
      appSettings: { notificationSoundsEnabled: false },
    });

    const row = screen
      .getByText("Notification sounds")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected notification sounds row");
    }
    fireEvent.click(within(row).getByRole("switch"));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ notificationSoundsEnabled: true })
      );
    });
  });

  it("does not preload server runtime state while display settings are active", async () => {
    await renderDisplaySection();

    expect(tailscaleStatusMock).not.toHaveBeenCalled();
    expect(tailscaleDaemonCommandPreviewMock).not.toHaveBeenCalled();
    expect(tailscaleDaemonStatusMock).not.toHaveBeenCalled();
  });
});

describe("SettingsView Environments", () => {
  it("saves the setup script for the selected project", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    await renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    const sectionFrame = document.querySelector(
      '[data-settings-section-frame="true"]'
    ) as HTMLElement | null;
    expect(sectionFrame).toBeTruthy();
    if (!sectionFrame) {
      throw new Error("Expected environments section frame");
    }
    expect(within(sectionFrame).getByText("Environments")).toBeTruthy();
    expect(
      within(sectionFrame).getByText("Project setup", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    const textarea = screen.getByPlaceholderText("pnpm install");
    expect((textarea as HTMLTextAreaElement).value).toBe("echo one");

    fireEvent.change(textarea, { target: { value: "echo updated" } });
    await actAndFlush(() => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() => {
      expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
        worktreeSetupScript: "echo updated",
      });
    });
  });

  it("normalizes whitespace-only scripts to null", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    await renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    const textarea = screen.getByPlaceholderText("pnpm install");
    fireEvent.change(textarea, { target: { value: "   \n\t" } });
    await actAndFlush(() => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() => {
      expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
        worktreeSetupScript: null,
      });
    });
  });

  it("copies the setup script to the clipboard", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    try {
      await renderEnvironmentsSection();

      fireEvent.click(screen.getByRole("button", { name: "Copy" }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("echo one");
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(navigator, "clipboard", originalDescriptor);
      } else {
        const navigatorWithOptionalClipboard = navigator as Navigator & { clipboard?: Clipboard };
        delete navigatorWithOptionalClipboard.clipboard;
      }
    }
  });

  it("renders the empty state through the shared section frame when no projects exist", async () => {
    await renderEnvironmentsSection({ groupedWorkspaces: [] });

    expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(screen.getByText("No projects yet.")).toBeTruthy();
  });
});
