// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@ku0/design-system", () => ({
  StatusBadge: ({
    children,
    className,
    size,
    tone,
  }: {
    children: ReactNode;
    className?: string;
    size?: string;
    tone?: string;
  }) => (
    <div className={className} data-size={size} data-status-tone={tone ?? "default"}>
      {children}
    </div>
  ),
  Button: ({
    ariaLabel,
    children,
    className,
    onClick,
  }: {
    ariaLabel?: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button aria-label={ariaLabel} className={className} onClick={onClick} type="button">
      {children}
    </button>
  ),
  Dialog: ({
    ariaLabelledBy,
    backdropClassName,
    cardClassName,
    children,
    className,
    onBackdropClick,
  }: {
    ariaLabelledBy?: string;
    backdropClassName?: string;
    cardClassName?: string;
    children: ReactNode;
    className?: string;
    onBackdropClick?: () => void;
  }) => (
    <div
      className={className}
      data-overlay-root="dialog"
      role="dialog"
      aria-labelledby={ariaLabelledBy}
    >
      <button
        className={backdropClassName}
        data-overlay-phase="backdrop"
        onClick={onBackdropClick}
        type="button"
      />
      <div
        className={cardClassName}
        data-overlay-phase="surface"
        data-overlay-treatment="translucent"
      >
        {children}
      </div>
    </div>
  ),
  PanelNavItem: ({
    active,
    children,
    className,
    onClick,
  }: {
    active?: boolean;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button
      className={className}
      data-active={String(Boolean(active))}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  ),
  PanelNavList: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SplitPanel: ({
    className,
    leading,
    trailing,
  }: {
    className?: string;
    leading: ReactNode;
    trailing: ReactNode;
  }) => (
    <div className={className} data-split-panel="true">
      {leading}
      {trailing}
    </div>
  ),
  Surface: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import {
  PRIMARY_SETTINGS_SECTIONS,
  SettingsSidebarNav,
  SettingsViewShell,
} from "@ku0/code-workspace-client/settings-shell";
import type { SettingsShellFraming } from "@ku0/code-workspace-client/settings-shell";

const framing: SettingsShellFraming = {
  kickerLabel: "Gateway session",
  contextLabel: "Web workspace",
  title: "Workspace settings",
  subtitle: "Browser defaults for the connected runtime session.",
};

describe("shared settings shell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders platform framing and active section state", () => {
    render(
      <SettingsViewShell
        activeSection="display"
        framing={framing}
        useMobileMasterDetail={false}
        showMobileDetail={false}
        onClose={vi.fn()}
        onSelectSection={vi.fn()}
        onBackToSections={vi.fn()}
      >
        <div>Settings content</div>
      </SettingsViewShell>
    );

    expect(screen.getByText(framing.kickerLabel)).toBeTruthy();
    expect(screen.getByText(framing.contextLabel)).toBeTruthy();
    expect(screen.getByText(framing.title)).toBeTruthy();
    expect(screen.getByText(framing.subtitle)).toBeTruthy();
    expect(screen.getAllByText("Display & Sound").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps mobile master-detail markers and exposes the shared primary sections", () => {
    render(
      <SettingsViewShell
        activeSection="projects"
        framing={framing}
        useMobileMasterDetail
        showMobileDetail
        onClose={vi.fn()}
        onSelectSection={vi.fn()}
        onBackToSections={vi.fn()}
      >
        <div>Settings content</div>
      </SettingsViewShell>
    );

    expect(PRIMARY_SETTINGS_SECTIONS).toContain("codex");
    expect(
      document.body.querySelector(
        '[data-settings-scaffold="true"][data-mobile-master-detail="true"][data-detail-visible="true"]'
      )
    ).toBeTruthy();
    expect(document.body.querySelector('[data-settings-mobile-detail-header="true"]')).toBeTruthy();
  });

  it("keeps the shared settings chrome neutral instead of a branded header gradient", () => {
    const chromeSource = readFileSync(
      resolve(import.meta.dirname, "SettingsModalChrome.global.css.ts"),
      "utf8"
    );

    expect(chromeSource).toContain(
      'background: "color-mix(in srgb, var(--ds-surface-shell) 98%, var(--ds-surface-panel))"'
    );
    expect(chromeSource).not.toContain(
      "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--ds-brand-primary) 4%, transparent)"
    );
  });

  it("renders the shared settings navigation as a reusable shell primitive", () => {
    render(
      <SettingsSidebarNav activeSection="git" onSelectSection={vi.fn()} showDisclosure={false} />
    );

    expect(screen.getAllByRole("navigation", { name: "Settings sections" }).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText("Core workflow").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Advanced setup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Internal tools").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Git").length).toBeGreaterThan(0);
    expect(screen.queryByText("Features")).toBeNull();
  });

  it("keeps advanced and internal routes renderable through the shared nav", () => {
    render(
      <SettingsSidebarNav
        activeSection="features"
        onSelectSection={vi.fn()}
        showDisclosure={false}
      />
    );

    expect(screen.getAllByText("Features").length).toBeGreaterThan(0);
    expect(screen.queryByText("Open in")).toBeNull();
  });
});
