// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsViewShell } from "@ku0/code-workspace-client/settings-shell";

const desktopFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Appearance, projects, runtime, and Codex defaults for this app.",
};

const webFraming = {
  kickerLabel: "Gateway session",
  contextLabel: "Web workspace",
  title: "Workspace settings",
  subtitle: "Browser defaults for the connected runtime session.",
};

describe("SettingsViewShell", () => {
  it("renders desktop framing through the shared modal chrome header", () => {
    render(
      <SettingsViewShell
        activeSection="display"
        framing={desktopFraming}
        useMobileMasterDetail={false}
        showMobileDetail={false}
        onClose={vi.fn()}
        onSelectSection={vi.fn()}
        onBackToSections={vi.fn()}
      >
        <div>Settings content</div>
      </SettingsViewShell>
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      document.body.querySelector('.settings-overlay--chatgpt[data-overlay-root="dialog"]')
    ).toBeTruthy();
    expect(
      document.body.querySelector(
        '.settings-window--chatgpt[data-overlay-phase="surface"][data-overlay-treatment="translucent"]'
      )
    ).toBeTruthy();
    expect(
      document.body.querySelector('.settings-kicker[data-size="md"][data-status-tone="default"]')
    ).toBeTruthy();
    expect(
      document.body.querySelector('.settings-context-chip[data-status-tone="default"]')
    ).toBeTruthy();
    expect(
      document.body.querySelector(
        '.settings-active-pill[data-size="md"][data-status-tone="progress"]'
      )
    ).toBeTruthy();
    expect(screen.getByText(desktopFraming.kickerLabel)).toBeTruthy();
    expect(screen.getByText(desktopFraming.contextLabel)).toBeTruthy();
    expect(screen.getByText(desktopFraming.title)).toBeTruthy();
    expect(screen.getByText(desktopFraming.subtitle)).toBeTruthy();
    expect(document.body.querySelector('[data-settings-scaffold="true"]')).toBeTruthy();
    expect(document.body.querySelector('[data-split-panel="true"]')).toBeTruthy();
    expect(document.body.querySelector('[data-settings-sidebar-nav="true"]')).toBeTruthy();
    expect(document.body.querySelector('[data-settings-content-frame="true"]')).toBeTruthy();
  });

  it("renders web framing when the host supplies browser-specific copy", () => {
    render(
      <SettingsViewShell
        activeSection="projects"
        framing={webFraming}
        useMobileMasterDetail={false}
        showMobileDetail={false}
        onClose={vi.fn()}
        onSelectSection={vi.fn()}
        onBackToSections={vi.fn()}
      >
        <div>Settings content</div>
      </SettingsViewShell>
    );

    expect(screen.getByText(webFraming.kickerLabel)).toBeTruthy();
    expect(screen.getByText(webFraming.contextLabel)).toBeTruthy();
    expect(screen.getByText(webFraming.title)).toBeTruthy();
    expect(screen.getByText(webFraming.subtitle)).toBeTruthy();
  });

  it("marks mobile master-detail state through the shared split shell", () => {
    render(
      <SettingsViewShell
        activeSection="projects"
        framing={desktopFraming}
        useMobileMasterDetail
        showMobileDetail
        onClose={vi.fn()}
        onSelectSection={vi.fn()}
        onBackToSections={vi.fn()}
      >
        <div>Settings content</div>
      </SettingsViewShell>
    );

    expect(
      document.body.querySelector(
        '[data-settings-scaffold="true"][data-mobile-master-detail="true"][data-detail-visible="true"]'
      )
    ).toBeTruthy();
    expect(document.body.querySelector('[data-settings-mobile-detail-header="true"]')).toBeTruthy();
  });
});
