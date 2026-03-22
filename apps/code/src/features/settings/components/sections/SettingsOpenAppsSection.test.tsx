// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsOpenAppsSection } from "./SettingsOpenAppsSection";

describe("SettingsOpenAppsSection", () => {
  it("renders through the shared settings grammar and adds an app", () => {
    const onAddOpenApp = vi.fn();

    const { container } = render(
      <SettingsOpenAppsSection
        openAppDrafts={[
          {
            id: "vscode",
            label: "VS Code",
            kind: "app",
            appName: "Visual Studio Code",
            command: null,
            args: [],
            argsText: "",
          },
        ]}
        openAppSelectedId="vscode"
        openAppIconById={{}}
        onOpenAppDraftChange={vi.fn()}
        onOpenAppKindChange={vi.fn()}
        onCommitOpenApps={vi.fn()}
        onMoveOpenApp={vi.fn()}
        onDeleteOpenApp={vi.fn()}
        onAddOpenApp={onAddOpenApp}
        onSelectOpenAppDefault={vi.fn()}
      />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Menu entries", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add app" }));

    expect(onAddOpenApp).toHaveBeenCalled();
  });

  it("uses shared status badge affordance for incomplete entries", () => {
    render(
      <SettingsOpenAppsSection
        openAppDrafts={[
          {
            id: "custom-command",
            label: "",
            kind: "command",
            appName: null,
            command: "",
            args: [],
            argsText: "",
          },
        ]}
        openAppSelectedId="custom-command"
        openAppIconById={{}}
        onOpenAppDraftChange={vi.fn()}
        onOpenAppKindChange={vi.fn()}
        onCommitOpenApps={vi.fn()}
        onMoveOpenApp={vi.fn()}
        onDeleteOpenApp={vi.fn()}
        onAddOpenApp={vi.fn()}
        onSelectOpenAppDefault={vi.fn()}
      />
    );

    expect(screen.getByText("Incomplete")).toBeTruthy();
    const defaultRadios = screen.getAllByRole("radio", { name: /default/i });
    expect((defaultRadios.at(-1) as HTMLInputElement | undefined)?.disabled).toBe(true);
  });

  it("renders finder drafts with the folder icon even for custom ids", () => {
    const { container } = render(
      <SettingsOpenAppsSection
        openAppDrafts={[
          {
            id: "explorer-custom",
            label: "Explorer",
            kind: "finder",
            appName: null,
            command: null,
            args: [],
            argsText: "",
          },
        ]}
        openAppSelectedId="explorer-custom"
        openAppIconById={{}}
        onOpenAppDraftChange={vi.fn()}
        onOpenAppKindChange={vi.fn()}
        onCommitOpenApps={vi.fn()}
        onMoveOpenApp={vi.fn()}
        onDeleteOpenApp={vi.fn()}
        onAddOpenApp={vi.fn()}
        onSelectOpenAppDefault={vi.fn()}
      />
    );

    const icon = container.querySelector('[data-open-app-icon="finder"]');
    expect(icon?.tagName.toLowerCase()).toBe("svg");
  });
});
