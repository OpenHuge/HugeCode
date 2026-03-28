// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SharedWorkspaceShellState } from "./sharedWorkspaceShellContracts";
import { EMPTY_SHARED_MISSION_CONTROL_SUMMARY } from "./sharedMissionControlSummary";
import {
  HomeOverviewSection,
  WorkspaceRosterSection,
  type ShellFocusTarget,
  type ShellSectionId,
} from "./sharedWorkspaceShellSections";

function createShellState(
  overrides: Partial<SharedWorkspaceShellState> = {}
): SharedWorkspaceShellState {
  const { missionSummary: missionSummaryOverrides, ...stateOverrides } = overrides;
  const missionSummary = {
    ...EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
    workspaceLabel: "Alpha",
    tasksCount: 2,
    runsCount: 1,
    approvalCount: 1,
    reviewPacksCount: 1,
    connectedWorkspaceCount: 1,
    launchReadiness: {
      tone: "ready" as const,
      label: "Launch readiness",
      detail: "Healthy",
    },
    continuityReadiness: {
      tone: "attention" as const,
      label: "Continuity readiness",
      detail: "Needs review",
    },
    missionItems: [
      {
        id: "mission-active",
        title: "Long compile",
        workspaceName: "Alpha",
        statusLabel: "Running",
        tone: "active" as const,
        detail: "Still compiling.",
        highlights: ["backend ready"],
      },
    ],
    reviewItems: [
      {
        id: "review-blocked",
        title: "Lint failure",
        workspaceName: "Alpha",
        summary: "Validation failed.",
        reviewStatusLabel: "Validation failed",
        validationLabel: "Failed",
        tone: "blocked" as const,
        warningCount: 0,
      },
    ],
    ...missionSummaryOverrides,
  };

  return {
    runtimeMode: "connected",
    platformHint: "web",
    routeSelection: { kind: "home" },
    activeSection: "home",
    workspaces: [
      { id: "workspace-1", name: "Alpha", connected: true },
      { id: "workspace-2", name: "Beta", connected: false },
    ],
    activeWorkspaceId: null,
    activeWorkspace: null,
    hasPendingWorkspaceSelection: false,
    workspaceLoadState: "ready",
    workspaceError: null,
    refreshWorkspaces: async () => undefined,
    selectWorkspace: () => undefined,
    navigateToSection: () => undefined,
    missionSnapshot: null,
    missionLoadState: "ready",
    missionError: null,
    refreshMissionSummary: async () => undefined,
    hostStartupStatus: null,
    hostStartupLoadState: "ready",
    hostStartupError: null,
    refreshHostStartupStatus: async () => undefined,
    accountHref: "/account",
    settingsFraming: {
      kickerLabel: "Preferences",
      contextLabel: "Desktop app",
      title: "Settings",
      subtitle: "Workspace settings",
    },
    ...stateOverrides,
    missionSummary,
  };
}

describe("HomeOverviewSection", () => {
  it("routes the highest-priority triage item through the shared focus-target contract", () => {
    const onNavigateSection = vi.fn<(section: ShellSectionId) => void>();
    const onOpenFocusTarget = vi.fn<(target: ShellFocusTarget) => void>();
    const onSelectWorkspace = vi.fn<(workspaceId: string | null) => void>();

    render(
      <HomeOverviewSection
        state={createShellState()}
        onNavigateSection={onNavigateSection}
        onOpenFocusTarget={onOpenFocusTarget}
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    const triageSection = screen
      .getByRole("heading", { level: 3, name: "Operator triage" })
      .closest("section");

    expect(triageSection).toBeTruthy();

    const triageButtons = within(triageSection as HTMLElement).getAllByRole("button");

    expect(triageButtons[0]?.textContent).toContain("Lint failure");
    expect(triageButtons[1]?.textContent).toContain("Long compile");

    fireEvent.click(triageButtons[0] as HTMLElement);

    expect(onOpenFocusTarget).toHaveBeenCalledWith({
      section: "review",
      itemId: "review-blocked",
    });
    expect(onNavigateSection).not.toHaveBeenCalled();
  });
});

describe("WorkspaceRosterSection", () => {
  it("shows the contract load state and delegates workspace selection through the callback", () => {
    const onSelectWorkspace = vi.fn<(workspaceId: string | null) => void>();

    render(
      <WorkspaceRosterSection
        state={createShellState({
          activeWorkspaceId: "workspace-1",
          activeWorkspace: { id: "workspace-1", name: "Alpha", connected: true },
          workspaceLoadState: "loading",
        })}
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    expect(screen.getByText("Hydrating workspace roster")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Home/i }));
    fireEvent.click(screen.getByRole("button", { name: /Beta/i }));

    expect(onSelectWorkspace).toHaveBeenNthCalledWith(1, null);
    expect(onSelectWorkspace).toHaveBeenNthCalledWith(2, "workspace-2");
  });
});
