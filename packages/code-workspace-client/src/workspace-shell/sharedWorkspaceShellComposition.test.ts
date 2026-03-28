import { describe, expect, it, vi } from "vitest";
import {
  composeSharedWorkspaceShellState,
  deriveSharedWorkspaceShellFrameState,
  deriveSharedWorkspaceShellResolvedFocusState,
  deriveSharedWorkspaceShellActiveSection,
  deriveSharedWorkspaceShellBackgroundEnabled,
  SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE,
} from "./sharedWorkspaceShellComposition";

describe("deriveSharedWorkspaceShellActiveSection", () => {
  it("maps route selection kinds to shell sections", () => {
    expect(deriveSharedWorkspaceShellActiveSection({ kind: "none" })).toBe("home");
    expect(
      deriveSharedWorkspaceShellActiveSection({
        kind: "workspace",
        workspaceId: "workspace-1",
      })
    ).toBe("workspaces");
    expect(deriveSharedWorkspaceShellActiveSection({ kind: "missions" })).toBe("missions");
    expect(deriveSharedWorkspaceShellActiveSection({ kind: "review" })).toBe("review");
  });
});

describe("deriveSharedWorkspaceShellBackgroundEnabled", () => {
  it("keeps background hydration enabled for missions and review surfaces", () => {
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "missions",
        activationRequested: false,
        activationDeferred: false,
      })
    ).toBe(true);
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "review",
        activationRequested: false,
        activationDeferred: false,
      })
    ).toBe(true);
  });

  it("allows explicit activation and deferred activation to warm background data", () => {
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "home",
        activationRequested: true,
        activationDeferred: false,
      })
    ).toBe(true);
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "settings",
        activationRequested: false,
        activationDeferred: true,
      })
    ).toBe(true);
  });

  it("stays disabled for passive sections until background activation is requested", () => {
    expect(
      deriveSharedWorkspaceShellBackgroundEnabled({
        activeSection: "home",
        activationRequested: false,
        activationDeferred: false,
      })
    ).toBe(false);
  });
});

describe("composeSharedWorkspaceShellState", () => {
  it("stitches shell frame, data, and actions into a stable shared state shape", () => {
    const refreshWorkspaces = vi.fn(async () => undefined);
    const selectWorkspace = vi.fn();
    const refreshMissionSummary = vi.fn(async () => undefined);
    const refreshHostStartupStatus = vi.fn(async () => undefined);
    const navigateToSection = vi.fn();

    const state = composeSharedWorkspaceShellState({
      runtimeMode: "connected",
      platformHint: "desktop",
      routeSelection: { kind: "workspace", workspaceId: "workspace-1" },
      activeSection: "workspaces",
      catalogState: {
        workspaces: [{ id: "workspace-1", name: "Alpha", connected: true }],
        activeWorkspaceId: "workspace-1",
        activeWorkspace: { id: "workspace-1", name: "Alpha", connected: true },
        hasPendingWorkspaceSelection: false,
        loadState: "ready",
        error: null,
        refresh: refreshWorkspaces,
        selectWorkspace,
      },
      missionControlState: {
        summary: {
          workspaceLabel: "Alpha",
          tasksCount: 1,
          runsCount: 2,
          approvalCount: 1,
          reviewPacksCount: 1,
          connectedWorkspaceCount: 1,
          launchReadiness: {
            tone: "ready",
            label: "Launch readiness",
            detail: "Healthy",
          },
          continuityReadiness: {
            tone: "attention",
            label: "Continuity readiness",
            detail: "Needs review",
          },
          missionItems: [],
          reviewItems: [],
        },
        snapshot: null,
        loadState: "ready",
        error: null,
        refresh: refreshMissionSummary,
      },
      hostStartupState: {
        status: {
          tone: "ready",
          label: "Desktop host",
          detail: "Healthy",
        },
        loadState: "ready",
        error: null,
        refresh: refreshHostStartupStatus,
      },
      navigateToSection,
      accountHref: "/account",
      settingsFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Desktop app",
        title: "Settings",
        subtitle: "Workspace settings",
      },
    });

    expect(state.activeSection).toBe("workspaces");
    expect(state.activeWorkspace?.name).toBe("Alpha");
    expect(state.refreshWorkspaces).toBe(refreshWorkspaces);
    expect(state.selectWorkspace).toBe(selectWorkspace);
    expect(state.refreshMissionSummary).toBe(refreshMissionSummary);
    expect(state.refreshHostStartupStatus).toBe(refreshHostStartupStatus);
    expect(state.navigateToSection).toBe(navigateToSection);
    expect(state.missionSummary.workspaceLabel).toBe("Alpha");
    expect(state.accountHref).toBe("/account");
  });
});

describe("deriveSharedWorkspaceShellFrameState", () => {
  it("derives shell chrome state from the exported shell contract instead of hook internals", () => {
    const state = composeSharedWorkspaceShellState({
      runtimeMode: "connected",
      platformHint: "desktop",
      routeSelection: { kind: "workspace", workspaceId: "workspace-1" },
      activeSection: "workspaces",
      catalogState: {
        workspaces: [{ id: "workspace-1", name: "Alpha", connected: true }],
        activeWorkspaceId: "workspace-1",
        activeWorkspace: { id: "workspace-1", name: "Alpha", connected: true },
        hasPendingWorkspaceSelection: true,
        loadState: "refreshing",
        error: "Workspace catalog failed",
        refresh: vi.fn(async () => undefined),
        selectWorkspace: vi.fn(),
      },
      missionControlState: {
        summary: {
          workspaceLabel: "Alpha",
          tasksCount: 1,
          runsCount: 2,
          approvalCount: 1,
          reviewPacksCount: 1,
          connectedWorkspaceCount: 1,
          launchReadiness: {
            tone: "ready",
            label: "Launch readiness",
            detail: "Healthy",
          },
          continuityReadiness: {
            tone: "attention",
            label: "Continuity readiness",
            detail: "Needs review",
          },
          missionItems: [],
          reviewItems: [],
        },
        snapshot: null,
        loadState: "refreshing",
        error: "Mission summary failed",
        refresh: vi.fn(async () => undefined),
      },
      hostStartupState: {
        status: null,
        loadState: "refreshing",
        error: "Host status failed",
        refresh: vi.fn(async () => undefined),
      },
      navigateToSection: vi.fn(),
      accountHref: "/account",
      settingsFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Desktop app",
        title: "Settings",
        subtitle: "Workspace settings",
      },
    });

    const frameState = deriveSharedWorkspaceShellFrameState(state);

    expect(frameState.workspaceSelectValue).toBe("workspace-1");
    expect(frameState.workspaceSelectOptions[0]).toEqual({
      value: SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE,
      label: "Home overview",
    });
    expect(frameState.workspaceSelectOptions[1]).toEqual({
      value: "workspace-1",
      label: "Refreshing selected workspace...",
      disabled: true,
    });
    expect(frameState.refreshLabel).toBe("Refreshing shell");
    expect(frameState.shellRefreshing).toBe(true);
    expect(frameState.shellErrors.map((error) => error.title)).toEqual([
      "Workspace roster unavailable",
      "Mission summary unavailable",
      "Desktop host status unavailable",
    ]);
  });
});

describe("deriveSharedWorkspaceShellResolvedFocusState", () => {
  it("resolves the top review item when a focus target enters review without an explicit item id", () => {
    const state = composeSharedWorkspaceShellState({
      runtimeMode: "connected",
      platformHint: "desktop",
      routeSelection: { kind: "review" },
      activeSection: "review",
      catalogState: {
        workspaces: [{ id: "workspace-1", name: "Alpha", connected: true }],
        activeWorkspaceId: "workspace-1",
        activeWorkspace: { id: "workspace-1", name: "Alpha", connected: true },
        hasPendingWorkspaceSelection: false,
        loadState: "ready",
        error: null,
        refresh: vi.fn(async () => undefined),
        selectWorkspace: vi.fn(),
      },
      missionControlState: {
        summary: {
          workspaceLabel: "Alpha",
          tasksCount: 1,
          runsCount: 1,
          approvalCount: 0,
          reviewPacksCount: 2,
          connectedWorkspaceCount: 1,
          launchReadiness: {
            tone: "ready",
            label: "Launch readiness",
            detail: "Healthy",
          },
          continuityReadiness: {
            tone: "ready",
            label: "Continuity readiness",
            detail: "Stable",
          },
          missionItems: [
            {
              id: "mission-1",
              title: "Compile",
              workspaceName: "Alpha",
              statusLabel: "Running",
              tone: "active",
              detail: "In progress",
              highlights: [],
            },
          ],
          reviewItems: [
            {
              id: "review-1",
              title: "Lint",
              workspaceName: "Alpha",
              summary: "Failed lint",
              reviewStatusLabel: "Validation failed",
              validationLabel: "Failed",
              tone: "blocked",
              warningCount: 0,
            },
          ],
        },
        snapshot: null,
        loadState: "ready",
        error: null,
        refresh: vi.fn(async () => undefined),
      },
      hostStartupState: {
        status: null,
        loadState: "ready",
        error: null,
        refresh: vi.fn(async () => undefined),
      },
      navigateToSection: vi.fn(),
      accountHref: "/account",
      settingsFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Desktop app",
        title: "Settings",
        subtitle: "Workspace settings",
      },
    });

    expect(
      deriveSharedWorkspaceShellResolvedFocusState({
        state,
        focusTarget: {
          section: "review",
          itemId: null,
        },
      })
    ).toEqual({
      resolvedFocusTargetItemId: "review-1",
      focusedMissionId: null,
      focusedReviewId: "review-1",
    });
  });
});
